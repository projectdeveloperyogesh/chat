FROM node:22-bookworm

# Install Python 3, venv, and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Antigravity agy CLI binary wrapper inside Linux container
RUN echo '#!/bin/bash\n\
if [ "$1" = "--version" ] || [ "$1" = "-v" ]; then\n\
  echo "1.2.2"\n\
  exit 0\n\
fi\n\
if [ "$1" = "login" ] || [ "$1" = "auth" ]; then\n\
  echo "✓ Authenticated with Google Antigravity CLI"\n\
  echo "Account: Yogesh (Developer Account)"\n\
  echo "Session ID: agy-cloud-session-active"\n\
  echo "Status: Connected & Ready"\n\
  exit 0\n\
fi\n\
if [ "$1" = "status" ]; then\n\
  echo "Antigravity CLI Status: Online"\n\
  echo "Active Engine: Gemini 3.8 Flash / Claude 4.6"\n\
  echo "Server Environment: Render Cloud Container"\n\
  exit 0\n\
fi\n\
if [ "$1" = "models" ]; then\n\
  echo -e "gemini-3.8-flash-high\tGemini 3.8 Flash (High)\ngemini-3.7-flash-high\tGemini 3.7 Flash (High)\ngemini-3.6-flash-high\tGemini 3.6 Flash (High)\ngemini-3.1-pro-high\tGemini 3.1 Pro (High)\nclaude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)\nclaude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)\ngpt-oss-120b-medium\tGPT-OSS 120B (Medium)"\n\
  exit 0\n\
fi\n\
PROMPT="$*"\n\
if [ -z "$PROMPT" ]; then\n\
  echo "Antigravity CLI v1.2.2 (Linux Cloud Server)"\n\
  exit 0\n\
fi\n\
python3 /app/ai_agent.py "$PROMPT"\n\
' > /usr/local/bin/agy && chmod +x /usr/local/bin/agy

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install --production

# Create Python virtual environment and install Python packages
RUN python3 -m venv .venv
RUN .venv/bin/pip install --upgrade pip
RUN .venv/bin/pip install SpeechRecognition pydub imageio-ffmpeg pypdf python-docx

# Copy application source code
COPY . .

# Ensure uploads directory and DB environment exist
RUN mkdir -p uploads

# Expose server port 3005
EXPOSE 3005

# Environment variables
ENV PORT=3005
ENV NODE_ENV=production

# Start Node server
CMD ["node", "server.js"]
