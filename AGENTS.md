# Agent Guidelines & Project Rules

This document defines coding guidelines, environment rules, and operational context for AI agentic assistants (Antigravity, Cursor, Copilot, etc.) working on this repository.

---

## 🛠️ Operational & Environment Rules

1. **Powershell Execution Policy Workaround**:
   - On Windows environments where PowerShell script execution is restricted, invoke `npm` commands via `cmd /c npm <command>` (e.g. `cmd /c npm install`).

2. **Port Handling**:
   - The default server port is set to `3000`. `server.js` contains automatic fallback port logic to handle `EADDRINUSE` by listening on `3001` or the next free port. Do not hardcode fixed port assumptions in tests without reading `server.address().port`.

3. **Git Hygiene**:
   - Never commit `node_modules/` or user-uploaded files in `uploads/` (except `uploads/.gitkeep`). Ensure `.gitignore` is preserved.
   - Do not commit plain-text credentials or API tokens into git config or remote URLs.

---

## 🏗️ Architecture & Code Conventions

1. **Backend (`server.js`)**:
   - Maintain pure CommonJS (`require`) syntax unless converting the entire project to ESM.
   - Express static files served from `public/` and `/uploads` served from `uploads/`.
   - Socket.IO handles state mapping for `activeUsers` (`Map`) and `typingUsers` (`Set`).
   - File uploads handled via `POST /api/upload` (Multer). Maximum file size limit: 50MB.

2. **Frontend (`public/`)**:
   - Keep client logic self-contained in `public/app.js` using modular event handler patterns.
   - Design system lives in `public/style.css`. Use CSS custom properties (`var(--accent-primary)`, `var(--bg-glass)`, etc.) for theme consistency. Do not introduce ad-hoc utility classes or inline style overrides unless necessary for dynamic user colors.
   - Sanitize all user inputs before rendering into the DOM using `escapeHTML()` to prevent XSS vulnerabilities.

3. **File Category Extensions**:
   - Categorize uploaded files (`image`, `video`, `audio`, `document`, `archive`, `code`, `other`) based on MIME type and extension for proper UI badge and preview rendering.
