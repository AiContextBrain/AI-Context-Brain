# AI Context Brain — Product Roadmap

This document outlines the current feature footprint and our upcoming development initiatives. Features are designed to integrate seamlessly between our cloud backend services and the local developer IDE environment.

---

## ✅ Shipped Features

These capabilities are fully completed, tested, and actively available in the current release:

### 1. Context Optimization & Filtering
*   **Intelligent Project Scanning**: Automatic detection of active frameworks, top-level directories, auth systems, databases, and dependencies.
*   **🔒 `.brainignore` Exclusions**: Recursively filters build folders, log files, dependencies, and media assets using glob syntax (merging `.gitignore` rules) to prevent context token bloat.
*   **⚡ SHA-256 Incremental Scanning**: Caches files under `.brain-cache/hashes.json` to only compute shifts on modified, added, or deleted files, drastically reducing token usage.

### 2. Architecture & Design Enforcement
*   **🏗️ Custom Rules Engine (Architecture Guard)**: Live background validation of workspace constraints with 6 key rules:
    *   *Regex*: Match pattern restrictions across codebase paths.
    *   *FolderRestriction*: Ensure specific modules or layers live only in specified paths.
    *   *ContentForbidden*: Block banned methods or libraries (e.g. direct database query in controller, direct DOM manipulation).
    *   *ImportRestriction*: Prevent illegal imports between layers.
    *   *NamingConvention*: Enforce file casing (PascalCase, camelCase) and suffixes.
    *   *FileSizeLimit*: Restrict maximum line counts per file to enforce modularity.
*   **🔧 Fix with AI (QuickFix)**: VS Code action provider calling backend `/suggest-fix` endpoint to suggest or apply code modifications instantly.
*   **📡 Real-Time File Watcher**: Auto-syncs workspace context in the background using debounced file change detectors.

### 3. Editor & Web Dashboard Core
*   **Universal Configuration Exporter**: Synchronizes context rules by generating native configuration files (`.cursorrules`, `.windsurfrules`, `CLAUDE.md`, `.github/copilot-instructions.md`, etc.).
*   **Live Sidebar Project Tree View**: Explore codebase structures, frameworks, active rules, and coding conventions directly within the editor.
*   **Web Dashboard Portal**: Centralized hub to manage registered projects, inspect scans, view history logs, toggle rule sets, and configure billing profiles.
*   **Secure Authentication flow**: Seamless browser-based authorization (`/authorize` route) to bind local extensions to your backend account.

---

## 🟡 Planned Features

These initiatives represent our active roadmap priorities:

### 1. Semantic Codebase Analysis
*   **Vectored Codebase Embeddings**: Move beyond basic metrics to perform deep semantic code search and indexing using local vector storage.
*   **Architecture Review Agent**: Periodic background review of project files to deliver critiques, pinpoint circular dependencies, and recommend refactoring recipes.
*   **AI Chat Panel**: Ask questions about your code architecture directly inside the IDE sidebar using localized project memory context.

### 2. Expanding Multi-IDE Footprint
*   **JetBrains IDE Suite Plugin**: Bring project memory mapping, Architecture Guard, and auto-fixes to IntelliJ, WebStorm, PyCharm, and Rider.
*   **Neovim Lua Plugin**: Highly optimized plugin supporting custom rule checks and context exports for terminal power-users.
*   **Claude Code Terminal Integrations**: Direct command line scripts to feed context dynamically during high-priority agentic runs.

### 3. Team & Enterprise Sync
*   **Shared Project Memory**: Coordinate coding conventions and custom guard rules across all engineering members of a repository automatically.
*   **SAML & Single Sign-On (SSO)**: Enterprise-grade authentication configuration via Okta, Entra ID, or Google Workspace.
*   **Self-Hosted Enterprise Deployments**: Package and deploy the PostgreSQL database, .NET API server, and Vite Web Dashboard internally via secure Docker Compose.
