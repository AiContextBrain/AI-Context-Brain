# AI Context Brain

> **Public Beta Notice**
> AI Context Brain is currently in Public Beta.
> Some features may evolve and minor bugs may exist.
> We actively improve the product based on user feedback.

AI Context Brain is a developer tool designed to capture codebase structure and context, facilitating better project understanding for AI coding assistants. Available as a VS Code extension, it runs local scans and generates optimized context and rule files for Cursor, Claude Code, GitHub Copilot, and Windsurf.

---

## Product Film

The cinematic film introduces the product promise and brand:

[Watch the cinematic product film](https://aicontextbrain.me/videos/ads-film.mp4)

---

## Real Product Workflow

The real workflow is shown separately from the film so developers can inspect the actual extension and dashboard behavior.

Core flow:

1. Scan Repository
2. Generate Context
3. Explain with Project Memory
4. Export AI IDE Context
5. Review Dashboard
6. Track Usage Statistics

[Watch the real product demo](https://aicontextbrain.me/videos/demo-aicontextbrain.mp4)

[View the real workflow on the website](https://aicontextbrain.me/#product-demo)

---

## Marketplace Visuals

The Marketplace listing prioritizes real extension and dashboard visuals:

* Scan Repository
* Generate Context
* Explain
* Export
* Dashboard
* Usage Statistics

---

## ✨ What Problem It Solves

AI assistants often lose project context when prompts get long, when context windows fill up, or when models restart. Developers waste tokens and time copy-pasting directory structures, re-explaining frameworks, and manually reminding AI tools of architecture rules or coding conventions.

AI Context Brain addresses this by maintaining a structured, compressed local codebase snapshot. It translates this snapshot into format-specific instructions that direct your AI coding assistant, helping it write code that fits your project rules.

---

## 🚀 Key Features

*   **Intelligent Local Scanning**: Auto-detects frameworks (Next.js, React, ASP.NET Core, Python, Go, Node.js), dependency maps, and overall folder layouts.
*   **🔒 `.brainignore` File Exclusion**: Prevent context bloat. Define exact glob patterns (merging `.gitignore` rules and custom patterns) to automatically filter large files or build assets.
*   **⚡ SHA-256 Incremental Scanning**: Caches file hashes under `.brain-cache/hashes.json` to only scan added, modified, or deleted files, avoiding full project scans.
*   **🏗️ Custom Architecture Rules Engine**: Define rules using 6 structured types (Regex, Folder Restriction, Content Forbidden, Import Restriction, Naming Paradigm, File Size Limit) with Error, Warning, and Info severity levels.
*   **📡 Background File Watcher**: A debounced file watcher that automatically schedules incremental scans in the background as you edit code.
*   **🔧 QuickFix "Fix with AI"**: VS Code QuickFix integration that connects to the backend API to suggest code corrections for rule violations.

---

## 🎮 Available Commands

| Command | Description |
|---------|-------------|
| `AI Context Brain: Login` | Log in securely to your account |
| `AI Context Brain: Register` | Create a new account |
| `AI Context Brain: Scan Project` | Perform local scanning and hash check |
| `AI Context Brain: Generate Context` | Manually write `.ai-context.md` |
| `AI Context Brain: Quick Copy Context` | Copy generated context markdown to clipboard |
| `AI Context Brain: Export AI IDE Context` | Export rules to `.cursorrules`, `.windsurfrules`, `CLAUDE.md`, etc. |
| `AI Context Brain: Check Login Status` | Check current connection status |
| `AI Context Brain: New Project Wizard` | Initialize a new workspace with a default `.brainignore` |
| `AI Context Brain: Show Roadmap` | Display project roadmap and progress |
| `AI Context Brain: Logout` | Sign out of session |

---

## ⚙️ Extension Settings

Add these custom configurations under your VS Code `settings.json`:

```json
{
  "aiContextBrain.apiUrl": "https://api.aicontextbrain.me",
  "aiContextBrain.webUrl": "https://aicontextbrain.me",
  "aiContextBrain.autoScan": false,
  "aiContextBrain.autoExportOnScan": true,
  "aiContextBrain.autoSync": true,
  "aiContextBrain.autoSyncDebounceSeconds": 30
}
```

---

## 🆚 Comparison with Native Context Features

| Feature | AI Context Brain | Copilot / Cursor Native |
|---------|:---:|:---:|
| **Local codebase mapping** | ✅ | ❌ |
| **SHA-256 Incremental sync** | ✅ | ❌ |
| **Real-time Architecture Guard** | ✅ | ❌ |
| **QuickFix "Fix with AI"** | ✅ | ❌ |
| **Multi-IDE exports** | Generates files for Cursor, Claude Code, Windsurf, Copilot | Natively single-IDE bound |
| **Free Tier Included** | ✅ | ✅ |

Team collaboration is the paid tier for shared project memory, member roles and aligned AI context across collaborators.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔗 Links

*   🌐 **Website:** [aicontextbrain.me](https://aicontextbrain.me)
*   **GitHub Repository:** [AiContextBrain/AI-Context-Brain](https://github.com/AiContextBrain/AI-Context-Brain)
*   🐛 **Issues:** [GitHub Issues](https://github.com/AiContextBrain/AI-Context-Brain/issues)
*   📧 **Support:** [support@aicontextbrain.me](mailto:support@aicontextbrain.me)
