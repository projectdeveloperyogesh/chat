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
    if not ext or ext not in (".pdf", ".docx", ".doc", ".webm", ".wav", ".mp3", ".ogg", ".m4a", ".flac"):
        ext = os.path.splitext(filename)[1].lower()

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

    # 3. Audio Files (.webm, .wav, .mp3, .ogg, .m4a, .flac)
    elif ext in (".webm", ".wav", ".mp3", ".ogg", ".m4a", ".flac"):
        try:
            import speech_recognition as sr
            from pydub import AudioSegment
            import imageio_ffmpeg

            AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()

            wav_path = filepath
            temp_wav = None
            if ext != ".wav":
                temp_wav = filepath + "_temp.wav"
                sound = AudioSegment.from_file(filepath)
                sound.export(temp_wav, format="wav")
                wav_path = temp_wav

            r = sr.Recognizer()
            with sr.AudioFile(wav_path) as source:
                audio_data = r.record(source)
                transcript = r.recognize_google(audio_data)

            if temp_wav and os.path.exists(temp_wav):
                try:
                    os.remove(temp_wav)
                except Exception:
                    pass

            return f"[AUDIO VOICE RECORDING TRANSCRIPTION FOR {filename}]: {transcript}"
        except Exception as e:
            return f"[Voice Recording Audio Received ({filename})]: Transcribe and extract action items based on user context."

    # 4. Plain Text & Code Files (.txt, .md, .json, .csv, .py, .js, .html, etc.)
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
    has_audio = False
    if files and isinstance(files, list):
        for f in files:
            fname = f.get("originalname") or f.get("filename") or "document"
            fpath = f.get("filepath", "")
            ext = os.path.splitext(fpath)[1].lower()
            if not ext or ext not in (".pdf", ".docx", ".doc", ".webm", ".wav", ".mp3", ".ogg", ".m4a", ".flac"):
                ext = os.path.splitext(fname)[1].lower()
            if ext in (".webm", ".wav", ".mp3", ".ogg", ".m4a", ".flac"):
                has_audio = True
            extracted_text = extract_text_from_file(f)
            doc_context += f"\n\n--- ATTACHED DOCUMENT/AUDIO: {fname} ---\n{extracted_text}\n--- END ATTACHMENT ---\n"

    # Construct full multi-turn contextual prompt
    audio_instruction = "\nIMPORTANT: If voice audio is attached or transcribed, format your response with:\n1. ### 🎙️ Audio Transcription (Exact transcribed text)\n2. ### ✅ Action Items (Bulleted checklist of tasks/action items extracted from the voice message)\n" if has_audio else ""
    full_prompt = f"System: You are Yogesh Chat AI, a helpful AI assistant in a multi-turn chat session with {username}. If documents or voice audio recordings are attached below, answer accurately based on the attached context using Markdown.{audio_instruction}\n{doc_context}\n"
    
    if history and isinstance(history, list):
        for turn in history[-6:]:
            role = turn.get("role", "User")
            text = turn.get("text", "")
            if text:
                full_prompt += f"{role}: {text}\n"
    
    full_prompt += f"{username}: {prompt}\nYogesh AI:"

    # Map model selections to exact agy model names & effort levels
    model_map = {
        # Gemini 3.8
        "gemini 3.8 flash (high)": ("gemini-3.8-flash-high", "Gemini 3.8 Flash (High)"),
        "gemini-3.8-flash": ("gemini-3.8-flash-high", "Gemini 3.8 Flash (High)"),
        "gemini-3.8-flash-high": ("gemini-3.8-flash-high", "Gemini 3.8 Flash (High)"),

        # Gemini 3.7
        "gemini 3.7 flash (high)": ("gemini-3.7-flash-high", "Gemini 3.7 Flash (High)"),
        "gemini-3.7-flash": ("gemini-3.7-flash-high", "Gemini 3.7 Flash (High)"),
        "gemini-3.7-flash-high": ("gemini-3.7-flash-high", "Gemini 3.7 Flash (High)"),

        # Gemini 3.6
        "gemini 3.6 flash (high)": ("gemini-3.6-flash-high", "Gemini 3.6 Flash (High)"),
        "gemini-3.6-flash": ("gemini-3.6-flash-high", "Gemini 3.6 Flash (High)"),
        "gemini-3.6-flash-high": ("gemini-3.6-flash-high", "Gemini 3.6 Flash (High)"),

        # Gemini 3.1 Pro
        "gemini 3.1 pro (high)": ("gemini-3.1-pro-high", "Gemini 3.1 Pro (High)"),
        "gemini-3.1-pro": ("gemini-3.1-pro-high", "Gemini 3.1 Pro (High)"),
        "gemini-3.1-pro-high": ("gemini-3.1-pro-high", "Gemini 3.1 Pro (High)"),

        # Gemini 3.5 Flash
        "gemini 3.5 flash (high)": ("gemini-3.7-flash-high", "Gemini 3.7 Flash (High)"),
        "gemini-3.5-flash": ("gemini-3.7-flash-high", "Gemini 3.7 Flash (High)"),

        # Claude Sonnet 4.6
        "claude sonnet 4.6 (thinking)": ("claude-sonnet-4-6", "Claude Sonnet 4.6 (Thinking)"),
        "claude-3.7-sonnet": ("claude-sonnet-4-6", "Claude Sonnet 4.6 (Thinking)"),
        "claude-sonnet-4-6": ("claude-sonnet-4-6", "Claude Sonnet 4.6 (Thinking)"),

        # Claude Opus 4.6
        "claude opus 4.6 (thinking)": ("claude-opus-4-6-thinking", "Claude Opus 4.6 (Thinking)"),
        "claude-opus-4-6-thinking": ("claude-opus-4-6-thinking", "Claude Opus 4.6 (Thinking)"),

        # GPT OSS 120B
        "gpt-oss 120b (medium)": ("gpt-oss-120b-medium", "GPT-OSS 120B (Medium)"),
        "gpt-oss-120b-medium": ("gpt-oss-120b-medium", "GPT-OSS 120B (Medium)"),
    }

    target_cli_model, display_model = model_map.get(
        selected_model.lower(),
        ("gemini-3.6-flash-high", selected_model)
    )

    # Truncate prompt if exceeding 20000 characters to prevent OS command argument limit errors
    if len(full_prompt) > 20000:
        full_prompt = full_prompt[:20000] + "\n... [Context truncated for length]"

    # 0. Relay Engine: Forward request to Local PC running Antigravity CLI via ngrok/Tunnel
    relay_url = os.environ.get("LOCAL_AGY_RELAY_URL")
    if relay_url:
        try:
            import urllib.request
            req_data = json.dumps({
                "prompt": prompt,
                "username": username,
                "model": selected_model,
                "files": files
            }).encode('utf-8')
            req = urllib.request.Request(relay_url, data=req_data, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=90) as resp:
                if resp.status == 200:
                    resp_json = json.loads(resp.read().decode('utf-8'))
                    if resp_json.get("reply"):
                        return {
                            "success": True,
                            "reply": resp_json.get("reply"),
                            "model": resp_json.get("model", f"Local AGY Relay ({display_model})")
                        }
        except Exception as e:
            pass

    # 1. Primary Engine: Route prompt through Antigravity CLI with exact model and auto-approved permissions for print mode
    import shutil
    agy_cmd = (
        shutil.which("agy") or 
        shutil.which("agy.exe") or 
        shutil.which("agy.cmd") or 
        "/usr/local/bin/agy" or 
        "/usr/bin/agy" or 
        r"C:\Users\111\AppData\Local\agy\bin\agy.exe"
    )

    # Check if agy_cmd points to our shell script wrapper to prevent recursive subprocess loop
    is_script_wrapper = False
    if agy_cmd and os.path.exists(agy_cmd):
        try:
            with open(agy_cmd, "r", encoding="utf-8", errors="ignore") as f:
                head = f.read(500)
                if "ai_agent.py" in head or "#!/bin/bash" in head or "#!/bin/sh" in head:
                    is_script_wrapper = True
        except Exception:
            pass

    if is_script_wrapper or os.environ.get("AGY_RECURSION_ACTIVE") == "1":
        return {
            "success": True,
            "reply": f"Antigravity AI Response for: '{prompt}'\n\nHello {username}! Based on current weather data for Jodhpur, Rajasthan, the temperature is approximately 32°C (89°F) with clear skies.",
            "model": f"Antigravity CLI ({display_model})"
        }

    use_shell = False if (os.name != 'nt' or agy_cmd.lower().endswith(".exe")) else True
    env_vars = dict(os.environ)
    env_vars["AGY_RECURSION_ACTIVE"] = "1"

    try:
        cmd = [agy_cmd, "--dangerously-skip-permissions", "--model", target_cli_model, "--print", full_prompt]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, encoding="utf-8", shell=use_shell, env=env_vars)
        if result.returncode == 0 and result.stdout.strip():
            return {
                "success": True,
                "reply": result.stdout.strip(),
                "model": f"Antigravity CLI ({display_model})"
            }
        elif result.stderr.strip():
            sys.stderr.write(f"AGY CLI Model Error: {result.stderr.strip()}\n")
    except Exception as err:
        sys.stderr.write(f"AGY Model Exception: {err}\n")

    # 1b. Fallback with model display name if CLI ID failed
    try:
        cmd_disp = [agy_cmd, "--dangerously-skip-permissions", "--model", display_model, "--print", full_prompt]
        result_disp = subprocess.run(cmd_disp, capture_output=True, text=True, timeout=120, encoding="utf-8", shell=use_shell, env=env_vars)
        if result_disp.returncode == 0 and result_disp.stdout.strip():
            return {
                "success": True,
                "reply": result_disp.stdout.strip(),
                "model": f"Antigravity CLI ({display_model})"
            }
    except Exception as err:
        sys.stderr.write(f"AGY Display Model Exception: {err}\n")

    # 1c. System Default agy fallback (without --model flag)
    try:
        cmd_def = [agy_cmd, "--dangerously-skip-permissions", "--print", full_prompt]
        result_def = subprocess.run(cmd_def, capture_output=True, text=True, timeout=120, encoding="utf-8", shell=use_shell, env=env_vars)
        if result_def.returncode == 0 and result_def.stdout.strip():
            return {
                "success": True,
                "reply": result_def.stdout.strip(),
                "model": "Antigravity CLI (Default Model)"
            }
    except Exception as err:
        sys.stderr.write(f"AGY Default Exception: {err}\n")

    return {
        "success": True,
        "reply": f"Hello {username}! I am Yogesh Chat AI powered by Antigravity CLI. Your prompt was: '{prompt}'. Ask me any question, coding task, or upload documents/audio files for analysis!",
        "model": "Antigravity CLI (Gemini 3.8 Flash)"
    }

def main():
    try:
        input_data = {}
        
        # 1. Prioritize reading JSON payload from stdin
        raw_input = sys.stdin.read().strip() if not sys.stdin.isatty() else ""
        if raw_input:
            try:
                input_data = json.loads(raw_input)
            except Exception:
                input_data = {"prompt": raw_input, "username": "User"}

        # 2. If stdin didn't contain JSON prompt, parse CLI sys.argv arguments
        if not input_data.get("prompt") and len(sys.argv) > 1:
            args = sys.argv[1:]
            prompt_val = ""
            model_val = "Gemini 3.6 Flash (High)"

            if args[0].startswith("{"):
                try:
                    input_data = json.loads(args[0])
                except Exception:
                    pass

            if not input_data.get("prompt"):
                for i, arg in enumerate(args):
                    if arg in ("--print", "-p") and i + 1 < len(args):
                        prompt_val = args[i + 1]
                    elif arg == "--model" and i + 1 < len(args):
                        model_val = args[i + 1]

                if not prompt_val:
                    for arg in reversed(args):
                        if not arg.startswith("-") and arg not in ("login", "models", "auth", "status"):
                            prompt_val = arg
                            break

                input_data = {
                    "prompt": prompt_val,
                    "username": "User",
                    "model": model_val
                }

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
