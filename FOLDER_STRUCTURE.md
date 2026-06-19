# AI Context Brain - Folder Structure

## Project Root

```
AI Context Brain/
├── ARCHITECTURE.md           # System architecture documentation
├── DATABASE_SCHEMA.md        # Database schema documentation
├── FOLDER_STRUCTURE.md       # This file
├── MVP_ROADMAP.md           # MVP development roadmap
├── vscode-extension/         # VSCode Extension
│   ├── package.json         # Extension manifest
│   ├── tsconfig.json        # TypeScript configuration
│   ├── .eslintrc.js         # ESLint configuration (optional)
│   └── src/
│       ├── extension.ts     # Main extension entry point
│       ├── commands/
│       │   ├── scanProject.ts
│       │   ├── showProjectMemory.ts
│       │   ├── generateContext.ts
│       │   └── newProjectWizard.ts
│       ├── services/
│       │   ├── backendService.ts
│       │   └── architectureGuard.ts
│       ├── providers/
│       │   └── projectTreeProvider.ts
│       └── utils/
│           └── helpers.ts   # Utility functions
├── backend/                  # ASP.NET Core Backend
│   ├── AiContextBrain.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── src/
│       ├── Controllers/
│       │   ├── ProjectController.cs
│       │   └── HealthController.cs
│       ├── Services/
│       │   ├── IRepositoryScanner.cs
│       │   ├── RepositoryScanner.cs
│       │   ├── IProjectMemoryService.cs
│       │   ├── ProjectMemoryService.cs
│       │   ├── IContextGenerator.cs
│       │   ├── ContextGenerator.cs
│       │   ├── IArchitectureGuard.cs
│       │   └── ArchitectureGuard.cs
│       ├── Models/
│       │   ├── Project.cs
│       │   ├── ArchitectureRule.cs
│       │   ├── CodingConvention.cs
│       │   ├── SystemDecision.cs
│       │   ├── ProjectScan.cs
│       │   └── FrameworkPattern.cs
│       ├── Data/
│       │   └── ApplicationDbContext.cs
│       ├── Dtos/
│       │   ├── ScanResult.cs
│       │   └── ProjectMemoryDto.cs
│       └── Utils/
│           └── TokenOptimizer.cs
├── Migrations/              # EF Core Migrations
└── Tests/                   # Unit/Integration Tests
```

## Key Files Overview

### VSCode Extension
- `extension.ts` - Extension activation and command registration
- `commands/` - Individual command implementations
- `services/` - Backend communication and local services
- `providers/` - Tree view and UI providers

### Backend API
- `Program.cs` - Application entry point and DI setup
- `Controllers/` - REST API endpoints
- `Services/` - Business logic implementation
- `Models/` - Entity Framework models
- `Data/` - Database context configuration
- `Dtos/` - Data transfer objects

## Getting Started

1. Install backend dependencies: `dotnet restore` in `/backend`
2. Install extension dependencies: `npm install` in `/vscode-extension`
3. Set up PostgreSQL database
4. Run database migrations: `dotnet ef database update`
5. Start backend: `dotnet run` in `/backend`
6. Test extension: `F5` in VSCode with extension folder open
