# AI Context Brain Instructions

## Generation Metadata
- Plan: Pro
- Context Capacity Applied: 100% of selected allowance
- Source: template
- Context History Saved: yes
- Validation Warnings: Duplicated content detected: "- Editing risk: changes can affect project memory quality or..."; Duplicated content detected: "- Editing risk: UI plan exposure can drift from backend enfo..."; Duplicated content detected: "- Purpose: Entity managed by DbContext"; Context uses 27 % of the available max context size. Additional architecture metadata may be available after deep scan improvements.

# AI Instructions for AI-Context-Memory

Use the generated `.ai-context.md` as the source of truth before editing this repository.

## Project Summary
- Purpose: Application organized around Authentication, Projects, Context Generation, Architecture Guard.
- Architecture: Standard
- Frameworks: ASP.NET Core, Vite
- Database: PostgreSQL
- Authentication: JWT Auth + refresh token rotation

## Required AI Workflow and Project Rules
- Read `.ai-context.md` before editing and use it as the source of truth for architecture and project memory.
- Do not hardcode secrets, tokens, connection strings, provider keys, webhook secrets, or email credentials.
- Reuse existing services, controllers, hooks, context providers, and extension command patterns before adding new abstractions.
- Keep server-side authorization, tenant/project scoping, and plan enforcement in backend code; UI checks are only an additional guard.
- When changing API contracts, update the dashboard, extension client, tests, and documentation together.
- Prefer incremental, focused changes and verify with the available build/test commands.
- Match existing React component state patterns and keep UI feature visibility aligned with backend plan flags.
- Use dependency injection, async EF Core APIs, DTO validation, migrations for schema changes, and explicit HTTP error responses.
- Preserve the existing auth flow (JWT Auth + refresh token rotation) and never bypass token validation in project, memory, or update endpoints.
- Treat PostgreSQL persistence changes as schema-affecting; add migrations and update seed/self-healing paths when needed.
- Honor architecture guard rule `Repository Pattern`: Data access through repositories.
- Honor architecture guard rule `Dependency Injection`: Use DI container.

## Module Boundaries
- Authentication: User registration, login, JWT/refresh token management, email verification, and password reset. Key files: `web-dashboard/src/context/AuthContext.tsx`, `web-dashboard/src/pages/Authorize.tsx`, `web-dashboard/src/pages/AuthLayout.tsx`, `backend/src/Controllers/AuthController.cs`.
- Projects: Project CRUD, scan uploads, context generation triggers, and context history management. Key files: `backend/ai_project_brain.db`, `vscode-extension/src/providers/projectTreeProvider.ts`, `vscode-extension/src/commands/showProjectMemory.ts`, `vscode-extension/src/commands/scanProject.ts`.
- Context Generation: Builds optimized .ai-context.md and AI_INSTRUCTIONS.md from project memory with semantic compression. Key files: `vscode-extension/src/services/contextExportService.ts`, `backend/src/Services/IContextGenerator.cs`, `backend/src/Services/ContextValidator.cs`, `backend/src/Services/ContextGenerator.cs`.
- Architecture Guard: Validates codebase against architecture rules with 6 rule paradigms and AI-powered fix suggestions. Key files: `vscode-extension/src/services/architectureGuard.ts`, `backend/src/Services/ArchitectureGuard.cs`, `backend/src/Services/IArchitectureGuard.cs`, `backend/src/Controllers/ArchitectureGuardController.cs`.
- Billing & Payments: Paddle subscription lifecycle, plan enforcement, delayed cancellation, and usage metering. Key files: `backend/src/Services/BillingReconciliationService.cs`, `backend/src/Controllers/PaymentController.cs`, `backend/Data/Migrations/20260610120000_EnsurePlanBillingTeamSchema.cs`.
- Email / Notifications: Transactional email via Resend API for verification, password reset, and admin test emails. Key files: `backend/src/Services/IEmailService.cs`, `backend/src/Services/EmailService.cs`, `web-dashboard/src/pages/VerifyEmail.tsx`, `backend/src/Models/EmailConfig.cs`.
- AI Providers: Google Gemini-only runtime analysis with ordered free-first/paid-fallback keys, cooldown, bounded explain caching, and emergency disable. IDE names in exports are targets, not backend AI providers. Key files: `backend/src/Services/AIAnalysisService.cs`, `backend/src/Services/HybridAIAnalysisService.cs`.
- Team Workspace: Shared project workspaces with Owner/Admin/Member/Viewer roles and project sharing. Key files: `backend/src/Controllers/TeamController.cs`, `backend/Data/Migrations/20260610120000_EnsurePlanBillingTeamSchema.cs`.
- Wizard Safety: Link the cloud project before creating local files, reject unsafe blueprint paths, preserve existing README/config files, scan real repository metadata before context generation, and never spend AI usage for blueprint-only previews. Key files: `web-dashboard/src/components/ProjectSetupWizard.tsx`, `vscode-extension/src/commands/newProjectWizard.ts`.

## High-Risk Files
- `scratch-smtp/Program.cs`: Keep startup configurations modular; register newly created services explicitly with proper lifetimes.
- `vscode-extension/src/extension.ts`: Follow VS Code API lifecycle guidelines; dispose registered items properly.
- `web-dashboard/package.json`: Maintain correct version scopes; do not add redundant libraries.
- `web-dashboard/tsconfig.json`: Strict typing is enabled. Avoid using "any".
- `web-dashboard/.env.example`: Document any new environment variables here.
- `web-dashboard/src/pages/Dashboard.tsx`: Maintain consistent CSS variables and responsive flex/grid wrappers.
- `backend/src/Controllers/ProjectController.cs`: Always authorize requests and sanitize path strings before disk reads.
- `backend/src/Services/ProjectMemoryService.cs`: Utilize EF Core async methods; ensure transaction scopes are handled properly.
- `backend/src/Data/ApplicationDbContext.cs`: Perform database migrations on changes.

## Active Architecture Guard Rules
- Repository Pattern (Warning, Regex): Data access through repositories
- Dependency Injection (Warning, Regex): Use DI container

## Required AI Workflow
- Read .ai-context.md before implementing changes.
- Preserve architecture rules, naming rules, import rules, and folder boundaries.
- Prefer existing services and modules over new abstractions.
- Do not hardcode secrets, tokens, connection strings, or provider keys.
- Keep changes scoped and verify builds/tests when possible.
