FROM node:20-bookworm

# Install Python 3, venv, and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

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
