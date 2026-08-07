# Yogesh Chat - Real-Time Chat & File Sharing Application

A modern, high-performance real-time chat application built with **Node.js**, **Express**, **Socket.IO**, and **Multer**, featuring a dark glassmorphism user interface and file-sharing capabilities.

---

## 🌟 Key Features

- 💬 **Normal Chat (`# global-lounge`)**: Multi-user instant chat powered by WebSockets (Socket.IO).
- 🤖 **AI Assistant Chat (`🤖 # ai-assistant`)**: Integrated AI channel powered by a **Python AI Bridge** (`ai_agent.py`) using Gemini AI models (`gemini-2.5-flash`).
- 🗑️ **Message & File Deletion**: Delete messages or uploaded files in real-time, automatically removing files from server disk storage.
- 📁 **Instant File Sharing**:
  - Drag-and-drop file upload zone & attachment selector.
  - Supports documents, code snippets, ZIP archives, images, audio, and video files (up to 50MB).
  - High-speed local storage handling via Multer.
- 🎬 **Rich Media Previews**:
  - Fullscreen lightbox viewer for images.
  - Embedded HTML5 video player.
  - Embedded HTML5 audio player.
  - Formatted file cards with file size indicators and download buttons.
- ⚡ **Interactive Experience**:
  - Real-time typing indicators (`"User is typing..."`).
  - Active user counter and stacked avatar display.
  - System notifications when users join or leave.
  - Mobile-responsive sidebar drawer.
- 🎨 **Modern Aesthetics**: Sleek dark mode glassmorphism theme built with modern CSS custom properties and micro-animations.

---

## 🏗️ Project Structure

```text
chat/
├── public/
│   ├── index.html       # Single-page client app & DOM structure
│   ├── style.css        # Glassmorphism design system & responsive layout
│   └── app.js           # Client-side Socket.IO logic & file staging
├── uploads/             # Directory where shared files are stored
├── server.js            # Express server, Socket.IO & Multer upload endpoints
├── package.json         # Dependencies & startup scripts
├── .gitignore           # Excluded directories (node_modules, uploads/*)
├── AGENTS.md            # Agent guidelines and project rules for AI assistants
└── README.md            # Project documentation and running instructions
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) installed on your machine.

Verify installation by running:
```bash
node -v
npm -v
```

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/projectdeveloperyogesh/chat.git
   cd chat
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Running the Application

- **Start Production Server**:
  ```bash
  npm start
  ```

- **Start Development Mode (Auto-reload on Node 18+)**:
  ```bash
  npm run dev
  ```

Once started, open your web browser and navigate to:
👉 **`http://localhost:3000`** *(or `http://localhost:3001` if port 3000 is occupied)*.

To test multi-user chat, open the URL in a second browser window or tab!

---

## 🔌 Public REST API Reference (`v1`)

Yogesh Chat provides a public REST API engine allowing external applications, Python scripts, cURL commands, and third-party tools to connect programmatically.

- **Base URL**: `http://localhost:3000/api/v1` (or Network IP: `http://192.168.29.112:3000/api/v1`)

### Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/status` | Server health, active user count, and available AI models |
| `POST` | `/api/v1/ai/chat` | Send an AI prompt, select models, and receive JSON responses |
| `GET` | `/api/v1/ai/sessions` | Retrieve list of AI discussion threads |
| `POST` | `/api/v1/messages` | Broadcast a message to the Global Lounge chat room via WebSockets |
| `GET` | `/api/v1/messages` | Retrieve Global Lounge chat history |

---

### Code Examples

#### 1. cURL Example (AI Chat Prompt)

```bash
curl -X POST http://localhost:3000/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing in 1 sentence",
    "model": "Gemini 3.6 Flash (High)",
    "username": "ExternalApp"
  }'
```

#### 2. Python Example (Send AI Prompt & Follow-up)

```python
import requests

# Send AI prompt
url = "http://localhost:3000/api/v1/ai/chat"
payload = {
    "prompt": "Tell me 3 top programming languages",
    "model": "Gemini 3.1 Pro (High)",
    "username": "PythonScript"
}

res = requests.post(url, json=payload).json()
print("AI Response:", res["reply"])

# Continue multi-turn conversation
session_id = res["sessionId"]
followup = requests.post(url, json={
    "prompt": "Why is the first one popular?",
    "sessionId": session_id
}).json()

print("AI Follow-up:", followup["reply"])
```

#### 3. JavaScript / Node.js Example (Broadcast Message to Chat)

```javascript
fetch("http://localhost:3000/api/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "🚀 Server deployment completed successfully!",
    username: "DeployBot"
  })
})
.then(res => res.json())
.then(data => console.log("Message Broadcast Result:", data));
```

---

## 🛠️ Built With

- **Backend**: Node.js, Express, Socket.IO, Multer, CORS
- **AI Bridge**: Python 3.13, Antigravity CLI (`agy`), `pypdf`, `python-docx`
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 Glassmorphism
- **Icons & Fonts**: FontAwesome 6, Google Fonts (Inter & Outfit)

---

## 📄 License

MIT License. Built for **Yogesh Chat**.
