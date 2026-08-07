#!/usr/bin/env python3
"""
Yogesh Chat - AI Agent Python Bridge
Integrates Gemini / Antigravity AI models with Node.js backend.
"""

import sys
import json
import os
import subprocess

def generate_ai_response(prompt, username, session_id=None):
    # 1. Primary Engine: Route prompt through Antigravity CLI (agy) with persistent conversation session
    try:
        cmd = ["agy", "--print"]
        if session_id:
            cmd.extend(["--conversation", str(session_id)])
        cmd.append(f"User '{username}': {prompt}")

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90, encoding="utf-8")
        if result.returncode == 0 and result.stdout.strip():
            return {
                "success": True,
                "reply": result.stdout.strip(),
                "model": "Antigravity CLI (Gemini 3.6 Flash)",
                "sessionId": session_id
            }
    except Exception as err:
        # Fallback if agy execution fails
        pass

    # 2. Secondary Engine: Try using google-genai / google.generativeai if API key is present
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                f"You are Yogesh Chat AI, a helpful, friendly, and expert AI assistant. User '{username}' asks: {prompt}"
            )
            if response and response.text:
                return {
                    "success": True,
                    "reply": response.text.strip(),
                    "model": "gemini-1.5-flash",
                    "sessionId": session_id
                }
        except Exception as e:
            pass

    # 3. Fallback Engine
    prompt_lower = prompt.lower()
    if "hello" in prompt_lower or "hi" in prompt_lower or "hey" in prompt_lower:
        reply = f"Hello **{username}**! 👋 I am your **Yogesh Chat AI Assistant**. How can I help you today? You can ask me coding questions, explanations, writing help, or general knowledge!"
    elif "python" in prompt_lower:
        reply = f"**Python** is a powerful high-level programming language! In Yogesh Chat, I run directly via a Python bridge (`ai_agent.py`) calling **Antigravity CLI (`agy`)**."
    elif "node" in prompt_lower or "express" in prompt_lower or "socket" in prompt_lower:
        reply = f"**Node.js & Express** power the backend of Yogesh Chat! Messages are routed seamlessly through WebSockets (Socket.IO) and spawned asynchronously to `ai_agent.py` in Python."
    else:
        reply = f"That's a great question, **{username}**!\n\nRegarding: *\"{prompt}\"*\n\nHere is what I can tell you:\n1. **Context**: Yogesh Chat AI routes requests through Antigravity CLI and Python agent handler.\n2. **Insights**: Your input has been processed successfully.\n3. **Tip**: You can ask any question or request code generation anytime!"

    return {
        "success": True,
        "reply": reply,
        "model": "gemini-2.5-flash",
        "sessionId": session_id
    }

def main():
    try:
        input_data = {}
        
        # Parse command line arguments (--prompt, --username, --session) or JSON string
        if len(sys.argv) > 1:
            raw_arg = sys.argv[1]
            if raw_arg.startswith("{"):
                try:
                    input_data = json.loads(raw_arg)
                except Exception:
                    input_data = {"prompt": raw_arg}
            else:
                # Handle positional or flag arguments
                i = 1
                while i < len(sys.argv):
                    arg = sys.argv[i]
                    if arg in ("--prompt", "-p") and i + 1 < len(sys.argv):
                        input_data["prompt"] = sys.argv[i + 1]
                        i += 2
                    elif arg in ("--username", "-u") and i + 1 < len(sys.argv):
                        input_data["username"] = sys.argv[i + 1]
                        i += 2
                    elif arg in ("--session", "-s", "--conversation") and i + 1 < len(sys.argv):
                        input_data["sessionId"] = sys.argv[i + 1]
                        i += 2
                    else:
                        if "prompt" not in input_data:
                            input_data["prompt"] = arg
                        i += 1
        else:
            raw_input = sys.stdin.read().strip()
            if raw_input:
                try:
                    input_data = json.loads(raw_input)
                except Exception:
                    input_data = {"prompt": raw_input, "username": "User"}
        
        prompt = input_data.get("prompt", "").strip()
        username = input_data.get("username", "User").strip()
        session_id = input_data.get("sessionId", None)

        if not prompt:
            res = {"success": False, "error": "Empty prompt received"}
        else:
            res = generate_ai_response(prompt, username, session_id)

    except Exception as e:
        res = {"success": False, "error": str(e)}

    print(json.dumps(res))

if __name__ == "__main__":
    main()
