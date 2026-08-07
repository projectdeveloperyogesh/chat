# NexusChat - Real-Time Chat & File Sharing Application

A modern, high-performance real-time chat application built with **Node.js**, **Express**, **Socket.IO**, and **Multer**, featuring a dark glassmorphism user interface and file-sharing capabilities.

---

## 🌟 Key Features

- 💬 **Real-Time Messaging**: Multi-user instant chat powered by WebSockets (Socket.IO).
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

## 🛠️ Built With

- **Backend**: Node.js, Express, Socket.IO, Multer, CORS
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 Glassmorphism
- **Icons & Fonts**: FontAwesome 6, Google Fonts (Inter & Outfit)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
