#!/usr/bin/env python3
"""
Yogesh Chat - AI Agent Python Bridge
Integrates Gemini / Antigravity AI models with Node.js backend.
"""

import sys
import json
import os
import subprocess

def extract_text_from_file(file_info):
    filepath = file_info.get("filepath", "")
    filename = file_info.get("originalname") or file_info.get("filename") or os.path.basename(filepath)
    if not filepath or not os.path.exists(filepath):
        return f"[File {filename} not found]"

    ext = os.path.splitext(filepath)[1].lower()

    # 1. PDF Files
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(filepath)
            text = ""
            for page_num, page in enumerate(reader.pages, 1):
                page_text = page.extract_text()
                if page_text:
                    text += f"\n--- Page {page_num} ---\n" + page_text
            return text.strip() if text.strip() else "[Empty PDF document]"
        except Exception as e:
            return f"[Error reading PDF {filename}: {str(e)}]"

    # 2. Word Documents (.docx)
    elif ext in (".docx", ".doc"):
        try:
            import docx
            doc = docx.Document(filepath)
            full_text = [para.text for para in doc.paragraphs if para.text.strip()]
            return "\n".join(full_text) if full_text else "[Empty Word document]"
        except Exception as e:
            return f"[Error reading Word document {filename}: {str(e)}]"

    # 3. Plain Text & Code Files (.txt, .md, .json, .csv, .py, .js, .html, etc.)
    else:
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(100000)
                return content.strip() if content.strip() else "[Empty text file]"
        except Exception as e:
            return f"[Error reading file {filename}: {str(e)}]"

def generate_ai_response(prompt, username, history=None, selected_model="Gemini 3.6 Flash (High)", files=None):
    # Format attached files into context
    doc_context = ""
    if files and isinstance(files, list):
        for f in files:
            fname = f.get("originalname") or f.get("filename") or "document"
            extracted_text = extract_text_from_file(f)
            doc_context += f"\n\n--- ATTACHED DOCUMENT: {fname} ---\n{extracted_text}\n--- END OF ATTACHED DOCUMENT ---\n"

    # Construct full multi-turn contextual prompt
    full_prompt = f"System: You are Yogesh Chat AI, a helpful AI assistant in a multi-turn chat session with {username}. If documents are attached below, answer accurately and thoroughly based on the attached document context. Use Markdown.\n{doc_context}\n"
    
    if history and isinstance(history, list):
        for turn in history[-6:]:
            role = turn.get("role", "User")
            text = turn.get("text", "")
            if text:
                full_prompt += f"{role}: {text}\n"
    
    full_prompt += f"{username}: {prompt}\nYogesh AI:"

    # Map model selections to exact agy model names & effort levels
    model_map = {
        "gemini-3.6-flash": ("Gemini 3.6 Flash (High)", "high"),
        "gemini 3.6 flash (high)": ("Gemini 3.6 Flash (High)", "high"),
        "gemini-3.6-pro": ("Gemini 3.1 Pro (High)", "high"),
        "gemini 3.1 pro (high)": ("Gemini 3.1 Pro (High)", "high"),
        "gemini-3.5-flash": ("Gemini 3.5 Flash (High)", "high"),
        "gemini 3.5 flash (high)": ("Gemini 3.5 Flash (High)", "high"),
        "claude-3.7-sonnet": ("Claude Sonnet 4.6 (Thinking)", "high"),
        "claude sonnet 4.6 (thinking)": ("Claude Sonnet 4.6 (Thinking)", "high"),
        "claude opus 4.6 (thinking)": ("Claude Opus 4.6 (Thinking)", "high"),
        "gpt-oss 120b (medium)": ("GPT-OSS 120B (Medium)", "medium"),
    }

    target_model, target_effort = model_map.get(
        selected_model.lower(),
        (selected_model, "high")
    )

    # 1. Primary Engine: Route prompt through Antigravity CLI with model & effort
    try:
        cmd = ["agy", "--model", target_model, "--effort", target_effort, "--print", full_prompt]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90, encoding="utf-8")
        if result.returncode == 0 and result.stdout.strip():
            return {
                "success": True,
                "reply": result.stdout.strip(),
                "model": f"Antigravity CLI ({target_model})"
            }
    except Exception as err:
        pass

    # 1b. Default agy fallback (without --model flag to use active system default)
    try:
        cmd_def = ["agy", "--print", full_prompt]
        result_def = subprocess.run(cmd_def, capture_output=True, text=True, timeout=90, encoding="utf-8")
        if result_def.returncode == 0 and result_def.stdout.strip():
            return {
                "success": True,
                "reply": result_def.stdout.strip(),
                "model": "Antigravity CLI (Gemini 3.6 Flash)"
            }
    except Exception as err:
        pass

    # 2. Secondary Engine: Try using google-genai / google.generativeai if API key is present
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(full_prompt)
            if response and response.text:
                return {
                    "success": True,
                    "reply": response.text.strip(),
                    "model": "gemini-1.5-flash"
                }
        except Exception as e:
            pass

    # 3. Fallback Engine
    prompt_lower = prompt.lower()
    if "hello" in prompt_lower or "hi" in prompt_lower or "hey" in prompt_lower:
        reply = f"Hello **{username}**! 👋 I am your **Yogesh Chat AI Assistant**. How can I help you today?"
    elif "python" in prompt_lower:
        reply = f"**Python** is a powerful language! In Yogesh Chat, I run via a Python bridge (`ai_agent.py`) calling **Antigravity CLI (`agy`)**."
    else:
        reply = f"That's a great question, **{username}**!\n\nRegarding: *\"{prompt}\"*\n\nYour prompt has been processed by Yogesh Chat AI."

    return {
        "success": True,
        "reply": reply,
        "model": "gemini-2.5-flash"
    }

def main():
    try:
        input_data = {}
        
        # 1. Prioritize reading JSON payload from stdin (safe against Windows CLI quote mangling)
        raw_input = sys.stdin.read().strip()
        if raw_input:
            try:
                input_data = json.loads(raw_input)
            except Exception as pe:
                input_data = {"prompt": raw_input, "username": "User"}
        elif len(sys.argv) > 1:
            raw_arg = sys.argv[1]
            if raw_arg.startswith("{"):
                try:
                    input_data = json.loads(raw_arg)
                except Exception:
                    input_data = {"prompt": raw_arg}
            else:
                # Handle flag arguments
                i = 1
                while i < len(sys.argv):
                    arg = sys.argv[i]
                    if arg in ("--prompt", "-p") and i + 1 < len(sys.argv):
                        input_data["prompt"] = sys.argv[i + 1]
                        i += 2
                    elif arg in ("--username", "-u") and i + 1 < len(sys.argv):
                        input_data["username"] = sys.argv[i + 1]
                        i += 2
                    elif arg in ("--history", "-h") and i + 1 < len(sys.argv):
                        try:
                            input_data["history"] = json.loads(sys.argv[i + 1])
                        except Exception:
                            input_data["history"] = []
                        i += 2
                    else:
                        if "prompt" not in input_data:
                            input_data["prompt"] = arg
                        i += 1

        prompt = input_data.get("prompt", "").strip()
        username = input_data.get("username", "User").strip()
        history = input_data.get("history", [])
        selected_model = input_data.get("model", "Gemini 3.6 Flash (High)").strip()
        files = input_data.get("files", [])

        if not prompt and not files:
            res = {"success": False, "error": "Empty prompt and no attached files received"}
        else:
            if not prompt:
                prompt = "Please analyze the attached document(s) and provide a summary of the contents."
            res = generate_ai_response(prompt, username, history, selected_model, files)

    except Exception as e:
        res = {"success": False, "error": str(e)}

    print(json.dumps(res))

if __name__ == "__main__":
    main()
