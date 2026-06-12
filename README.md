<div align="center">

<br />

# 🧠 AI Context Brain

### Make every AI assistant understand your codebase.

AI Context Brain is a codebase context optimization platform.<br/>
It scans your project, understands its architecture, and exports optimized context<br/>
so AI coding tools write code that actually fits your project.

<br />

[![VS Code Marketplace](https://img.shields.io/badge/VS_Code-Install_Extension-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=ai-project-brain.ai-project-brain)
[![Website](https://img.shields.io/badge/Website-aicontextbrain.me-ffffff?style=for-the-badge&logo=google-chrome&logoColor=black)](https://aicontextbrain.me)
[![Dashboard](https://img.shields.io/badge/Dashboard-Open_App-8b5cf6?style=for-the-badge&logo=safari&logoColor=white)](https://app.aicontextbrain.me)

<br />

<img src="https://img.shields.io/badge/status-Public_Beta-a855f7?style=flat-square" />
<img src="https://img.shields.io/badge/platform-VS_Code-007ACC?style=flat-square&logo=visual-studio-code&logoColor=white" />
<img src="https://img.shields.io/badge/backend-.NET_9-512BD4?style=flat-square&logo=dotnet&logoColor=white" />
<img src="https://img.shields.io/badge/license-Proprietary-gray?style=flat-square" />

</div>

---

## The Problem

AI coding assistants are powerful — but they don't know your project.

Every time you start a conversation, the AI has **zero memory** of your architecture, conventions, database schemas, or team rules. Developers end up:

- 📋 Copy-pasting the same files over and over
- 🔁 Re-explaining project structure in every prompt
- 🐛 Getting suggestions that violate their coding conventions
- ⏳ Wasting time correcting AI-generated code that doesn't fit

**AI Context Brain fixes this.**

---

## How It Works

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Your Code   │ ──▶ │  Smart Scanner   │ ──▶ │ Context Optimizer │ ──▶ │  AI Gets Memory  │
│              │     │                  │     │                   │     │                  │
│ Frameworks   │     │ Detects stack,   │     │ Compresses into   │     │ Cursor, Copilot, │
│ Conventions  │     │ patterns, deps,  │     │ optimized context │     │ Claude, Windsurf │
│ Architecture │     │ DB, auth, APIs   │     │ per AI tool       │     │ all understand   │
└──────────────┘     └──────────────────┘     └───────────────────┘     └──────────────────┘
```

1. **Scan** — The VS Code extension scans your local project
2. **Understand** — Detects frameworks, architecture, database, auth patterns, dependencies
3. **Optimize** — Generates compressed, structured project context
4. **Export** — Writes tool-specific rule files directly into your workspace

---

## Supported AI Tools

| AI Tool | Export Format | Auto-Sync |
|:--------|:------------|:---------:|
| **Cursor** | `.cursor/rules/` | ✅ |
| **GitHub Copilot** | `.github/copilot-instructions.md` | ✅ |
| **Claude Code** | `CLAUDE.md` | ✅ |
| **Windsurf** | `.windsurf/rules/` | ✅ |
| **OpenAI Codex** | `AGENTS.md` | ✅ |
| **Aider** | `CONVENTIONS.md` | ✅ |

---

## Key Features

### 🔍 Intelligent Scanning
Auto-detects your tech stack — frameworks (Next.js, React, ASP.NET, Python, Go, Node.js), databases (PostgreSQL, MongoDB, SQLite), auth systems (JWT, OAuth), and dependency graphs.

### 🏗️ Architecture Awareness
Extracts route maps, service graphs, entity models, DTO structures, and module relationships. Your AI assistant gets a deep understanding of how your codebase is organized.

### 🛡️ Architecture Guard
Define and enforce coding rules across your project with 6 rule types:
- **Regex Rules** — Pattern matching validation
- **Folder Restriction** — Enforce file placement conventions
- **Content Forbidden** — Block hardcoded secrets, TODO markers
- **Import Restriction** — Control dependency usage
- **Naming Paradigm** — Enforce naming conventions
- **File Size Limit** — Keep files maintainable

### 🔄 Background Auto-Sync
A file watcher detects changes and automatically triggers incremental scans. Your context stays fresh without manual effort.

### 📜 Context History
Track every version of your generated context. Compare diffs between versions and restore older snapshots when needed.

### 👥 Team Workspaces
Share project memory, conventions, and architecture rules with your team. Supports Owner, Admin, Member, and Viewer roles with invitation management.

### 🤖 AI Explain
Select any code block and get an explanation powered by your project memory — the AI understands the code *in context* of your architecture.

---

## Getting Started

### 1. Install the Extension
Search for **"AI Context Brain"** in the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ai-project-brain.ai-project-brain) and install it.

### 2. Create an Account
Run `AI Context Brain: Register` from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

### 3. Scan Your Project
Open your project workspace and run `AI Context Brain: Scan Project`. The extension builds your project memory locally.

### 4. Generate Context
Run `AI Context Brain: Generate Context` to create optimized AI context files, then export to your preferred AI tool.

---

## Plans

| Feature | Free | Pro | Team |
|:--------|:----:|:---:|:----:|
| **Price** | $0 | $9/mo | $29/mo |
| **Project Memories** | 3 | Unlimited | Unlimited |
| **Context Refreshes / Month** | 50 | 500 | 1,000 |
| **AI Requests / Month** | 20 | 100 | 500 |
| **Context Depth** | Basic (~2k) | Deep (~32k) | Deep (~32k) |
| **Context History & Diff** | — | ✅ | ✅ |
| **Architecture Guard** | — | ✅ | ✅ |
| **Priority AI** | — | ✅ | ✅ |
| **API Access** | — | ✅ | ✅ |
| **Team Workspace** | — | — | ✅ |
| **Up to 10 Members** | — | — | ✅ |
| **Shared Project Memory** | — | — | ✅ |

[**View Plans →**](https://aicontextbrain.me)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend API** | .NET 9 (C#), PostgreSQL |
| **VS Code Extension** | TypeScript |
| **Web Dashboard** | React + Vite + TypeScript |
| **AI Providers** | Google Gemini, OpenAI GPT-4 (Hybrid) |
| **Email** | Resend API |
| **Payments** | Paddle |
| **Hosting** | Railway |

---

## Links

| | |
|---|---|
| 🌐 **Website** | [aicontextbrain.me](https://aicontextbrain.me) |
| 📊 **Dashboard** | [app.aicontextbrain.me](https://app.aicontextbrain.me) |
| 🧩 **VS Code Extension** | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ai-project-brain.ai-project-brain) |
| 🐛 **Issues & Feedback** | [GitHub Issues](https://github.com/AiContextBrain/AI-Context-Brain/issues) |
| 📧 **Support** | [support@aicontextbrain.me](mailto:support@aicontextbrain.me) |
| 🐙 **GitHub Org** | [github.com/AiContextBrain](https://github.com/AiContextBrain) |

---

<div align="center">

### ⚠️ Public Beta

AI Context Brain is currently in **Public Beta**.<br/>
Some features may evolve and minor bugs may exist.<br/>
We actively improve the product based on user feedback.

<br />

**Built with ❤️ by the AI Context Brain Team**

*Stop repeating yourself to AI. Give it memory.*

</div>
