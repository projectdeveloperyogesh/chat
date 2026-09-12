#!/usr/bin/env python3
"""
Local AGY Relay Server
Runs on Local PC to execute Antigravity CLI (agy) for Cloud-hosted deployments.
"""

import os
import json
import subprocess
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("RELAY_PORT", 4000))

class AGYRelayHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        try:
            req_json = json.loads(post_data) if post_data else {}
            prompt = req_json.get("prompt", "").strip()
            username = req_json.get("username", "User")
            model = req_json.get("model", "Gemini 3.8 Flash (High)")
            files = req_json.get("files", [])

            # Import generate_ai_response from local ai_agent
            from ai_agent import generate_ai_response
            res = generate_ai_response(prompt, username, None, model, files)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "online", "service": "Local AGY Relay"}).encode('utf-8'))

def run():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, AGYRelayHandler)
    print(f"Local AGY Relay Server running on port {PORT}")
    print(f"Point your cloud server environment variable LOCAL_AGY_RELAY_URL to your public tunnel URL")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
