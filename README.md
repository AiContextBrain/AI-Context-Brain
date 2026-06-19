# AI Context Brain

> **Public Beta Notice**
> AI Context Brain is currently in Public Beta.
> Some features may evolve and minor bugs may exist.
> We actively improve the product based on user feedback.

AI Context Brain is a tool designed to capture codebase structure and context, facilitating better project understanding for AI coding assistants. Available as a VS Code extension, it runs local scans and generates optimized context and rule files for Cursor, Claude Code, GitHub Copilot, and Windsurf.

---

## 1. Cinematic Teaser

The launch film is designed to create excitement and introduce the core promise:

[Watch the AI Context Brain cinematic product film](https://aicontextbrain.me/videos/ads-film.mp4)

---

## 2. Real Product Workflow

The product workflow is intentionally separated from the cinematic film so users can see what actually happens in the product:

1. Repository Scan
2. Context Generation
3. Explain with Project Memory
4. Export to AI IDEs
5. Dashboard review
6. Usage statistics and plan enforcement

[Watch the real product demo](https://aicontextbrain.me/videos/demo-aicontextbrain.mp4)

[View the real workflow section on the website](https://aicontextbrain.me/#product-demo)

---

## 3. Screenshots

The website and Marketplace should use real UI captures rather than marketing renders. Prioritized screenshot/GIF coverage:

* Scan Repository
* Generate Context
* Explain with Project Memory
* Export AI IDE Context
* Dashboard and usage statistics

---

## 4. Features

AI assistants often lose project context when prompts get long, when context windows fill up, or when models restart. AI Context Brain addresses this by maintaining a structured, compressed local codebase snapshot and translating it into format-specific instructions for AI coding assistants.

*   **Intelligent Local Scanning**: Auto-detects frameworks (Next.js, React, ASP.NET Core, Python, Go, Node.js), dependency maps, and overall folder layouts.
*   **`.brainignore` Support**: Exclude assets, binary files, or logs from context scans recursively.
*   **Incremental Scanning**: Tracks local file hashes (`.brain-cache/hashes.json`) via SHA-256 to sync only added, modified, or deleted files, avoiding full project re-scans.
*   **Architecture Guard**: Validates codebase constraints locally based on 6 rule paradigms (Regex, Folder Restriction, Content Forbidden, Import Restriction, Naming Paradigm, File Size Limit) with Error, Warning, and Info severity levels.
*   **AI Suggest Fix (QuickFix)**: VS Code QuickFix integration that connects to the backend API to suggest code corrections for rule violations.
*   **Background File Watcher**: A debounced file watcher that automatically schedules incremental scans in the background as you edit code.
*   **Context History & Comparison**: The web dashboard tracks previous context versions, allowing you to view historical diffs and restore older versions.
*   **Team Workspaces**: Share project memory, roles and AI guardrails with other team members in a shared dashboard workspace (requires Team subscription).

---

## 5. Installation

1. **Local Scan**: The VS Code extension scans your local project directory.
2. **Analysis & Filtering**: It filters out build artifacts, assets, and ignored items using your `.gitignore` and `.brainignore` rules.
3. **Context Generation**: It gathers framework details, folder structure, database types, and libraries, then builds a structured project memory.
4. **Targeted Export**: It exports optimized rule files (like `.cursorrules`, `CLAUDE.md`, `.windsurfrules`, or `.github/copilot-instructions.md`) directly into your workspace.

---

### VS Code Extension
1. Search for `AI Context Brain` in the VS Code Marketplace and install it.
2. Run `AI Context Brain: Register` or `AI Context Brain: Login` from the Command Palette to authenticate.
3. Open a workspace and run `AI Context Brain: Scan Project` to build your first local context.

### Local Development / Self-Hosting Setup

For developers wanting to run the codebase locally:

#### 1. Backend Server Setup (.NET 9 + PostgreSQL)
```bash
cd backend
dotnet restore
dotnet build
dotnet ef database update
dotnet run
```
*Defaults to port 5001.*

#### 2. VS Code Extension Setup (TypeScript)
```bash
cd vscode-extension
npm install
npm run compile
```
*Press F5 inside VS Code to launch the Extension Development Host.*

#### 3. Web Dashboard Setup (React + Vite)
```bash
cd web-dashboard
npm install
npm run dev
```
*Runs on port 3000.*

---

## 6. Roadmap

See [ROADMAP.md](ROADMAP.md) for the public roadmap.

---

## Support & Links
*   **Website & Dashboard**: [aicontextbrain.me](https://aicontextbrain.me)
*   **GitHub Repository**: [AiContextBrain/AI-Context-Brain](https://github.com/AiContextBrain/AI-Context-Brain)
*   **Support**: [support@aicontextbrain.me](mailto:support@aicontextbrain.me)
*   **Issue Tracker**: [GitHub Issues](https://github.com/AiContextBrain/AI-Context-Brain/issues)
