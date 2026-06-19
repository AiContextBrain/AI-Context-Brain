# AI Context Brain Architecture

AI Context Brain is a developer infrastructure platform for AI Context Optimization. Its primary goal is to make AI assistants understand a codebase through living project memory, optimized context files, architecture rules, and IDE-ready exports.

## System Overview

The product is composed of three main layers:

- **VS Code / Cursor / Windsurf Extension:** scans the local workspace, detects project structure, sends metadata to the backend, generates `.ai-context.md`, and exports editor-specific instruction files.
- **Backend API:** stores tenant-scoped project memory, enforces auth and plan limits, generates optimized context, manages context history, evaluates architecture rules, and coordinates billing state.
- **Web Dashboard:** provides onboarding, project memory views, plan usage, billing management, settings persistence, team workspaces, and context history workflows.

## Core Data Flow

1. The extension scans the local repository and applies `.brainignore` filtering.
2. The extension sends project metadata to the backend with the authenticated user token.
3. The backend stores memory under `UserId + ProjectId` and enforces plan-specific limits.
4. Context generation uses the backend context generator, optional Hybrid AI, validation, quality scoring, and context history.
5. The extension writes `.ai-context.md`, `AI_INSTRUCTIONS.md`, and editor-specific exports from the optimized backend response.

## Security Model

- All sensitive project endpoints require token authentication.
- Project access is scoped by owner or active team sharing permissions.
- Passwords use PBKDF2 hashing and refresh tokens are rotated.
- API access, Hybrid AI, context history, diff/restore, and team workspace behavior are enforced server-side by plan.
- Secrets and provider keys must be supplied by environment variables, not committed config files.

## Plan Boundaries

- **Free:** 3 project memories, 50 monthly context refreshes, 2,000 optimized context tokens, IDE exports, and basic instructions.
- **Pro:** 999 project memories, 500 monthly context refreshes, 32,000 optimized context tokens, context history, diff/restore, Hybrid AI, priority generation, API access, and advanced exports.
- **Team:** Pro capabilities plus shared team workspace, shared memory/context, project sharing, role-based access, and up to 10 members.

## Main Modules

- `backend/src/Controllers`: authenticated HTTP endpoints for auth, project memory, context, teams, billing, feedback, settings, and architecture guard.
- `backend/src/Services`: project memory, context generation, validation, Hybrid AI, semantic analysis, email, billing reconciliation, and scanning support.
- `web-dashboard/src`: dark SaaS dashboard, landing/pricing pages, onboarding, settings, billing, and project memory UI.
- `vscode-extension/src`: extension activation, scan command, context generation command, IDE export command, file watcher, architecture diagnostics, and API client.

## Context Quality Contract

Generated context must explain why files, modules, rules, dependencies, and architecture decisions matter. It should favor correctness, usefulness, architecture understanding, token efficiency, and maintainability over raw output size.
