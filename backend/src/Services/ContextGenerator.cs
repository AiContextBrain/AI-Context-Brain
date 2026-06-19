using AiContextBrain.Dtos;
using AiContextBrain.Data;
using AiContextBrain.Models;
using System.Text;

namespace AiContextBrain.Services;

public class ContextGenerator : IContextGenerator
{
    private readonly IProjectMemoryService _memoryService;
    private readonly ApplicationDbContext _dbContext;

    public ContextGenerator(IProjectMemoryService memoryService, ApplicationDbContext dbContext)
    {
        _memoryService = memoryService;
        _dbContext = dbContext;
    }

    public async Task<string> GenerateContextAsync(string projectPath, int maxTokens = 8000, string? userId = null, UserPlan? plan = null)
    {
        var memory = await _memoryService.GetProjectMemoryAsync(projectPath, userId);
        if (memory == null)
        {
            return "# AI Context Brain Context\n\nNo project memory found. Scan the project first so AI Context Brain can build living project memory.";
        }

        if (plan == null)
        {
            plan = UserPlan.Free;
            if (userId != null)
            {
                var user = await _dbContext.Users.FindAsync(userId);
                if (user != null)
                {
                    plan = user.Plan;
                }
            }
        }

        maxTokens = Math.Clamp(maxTokens, 1000, 32000);
        var sections = BuildContextSections(memory, plan.Value);
        return CompressContextSemantically(sections, maxTokens);
    }

    public async Task<string> GenerateAiInstructionsAsync(string projectPath, string? userId = null)
    {
        var memory = await _memoryService.GetProjectMemoryAsync(projectPath, userId);
        if (memory == null)
        {
            return "# AI Context Brain Instructions\n\nRead `.ai-context.md` first. Preserve existing architecture and avoid hardcoded secrets.";
        }

        var rules = BuildDynamicRules(memory).Take(14).ToList();
        var modules = memory.Metrics.ModuleMap?.Take(8).ToList() ?? new();
        var importantFiles = memory.Metrics.ImportantFiles?.Take(10).ToList() ?? new();

        var sb = new StringBuilder();
        sb.AppendLine($"# AI Instructions for {memory.Name}");
        sb.AppendLine();
        sb.AppendLine("Use the generated `.ai-context.md` as the source of truth before editing this repository.");
        sb.AppendLine();
        sb.AppendLine("## Project Summary");
        sb.AppendLine($"- Purpose: {InferPurpose(memory)}");
        sb.AppendLine($"- Architecture: {Known(memory.ArchitectureType)}");
        sb.AppendLine($"- Frameworks: {Known(memory.Framework)}");
        sb.AppendLine($"- Database: {Known(memory.DatabaseType)}");
        sb.AppendLine($"- Authentication: {Known(memory.AuthSystem)}");
        sb.AppendLine();
        sb.AppendLine("## Required AI Workflow and Project Rules");
        foreach (var rule in rules)
        {
            sb.AppendLine($"- {rule}");
        }

        if (modules.Any())
        {
            sb.AppendLine();
            sb.AppendLine("## Module Boundaries");
            foreach (var module in modules)
            {
                sb.AppendLine($"- {module.Name}: {module.Purpose} Key files: {JoinInline(module.KeyFiles.Take(4))}.");
            }
        }

        if (importantFiles.Any())
        {
            sb.AppendLine();
            sb.AppendLine("## High-Risk Files");
            foreach (var file in importantFiles)
            {
                sb.AppendLine($"- `{file.Path}`: {file.AiBehavior}");
            }
        }

        if (memory.ArchitectureRules.Any(r => r.IsActive))
        {
            sb.AppendLine();
            sb.AppendLine("## Active Architecture Guard Rules");
            foreach (var rule in memory.ArchitectureRules.Where(r => r.IsActive).Take(20))
            {
                sb.AppendLine($"- {rule.Name} ({rule.Severity}, {rule.RuleType}): {rule.Pattern}");
                if (!string.IsNullOrWhiteSpace(rule.AutoFixSuggestion))
                {
                    sb.AppendLine($"  Suggested fix: {rule.AutoFixSuggestion}");
                }
            }
        }

        return sb.ToString();
    }

    public Task<string> PreviewContextAsync(string projectPath, int maxTokens, string? userId = null, UserPlan? plan = null)
    {
        return GenerateContextAsync(projectPath, maxTokens, userId, plan);
    }

    public Task<string> GenerateCompressedContextAsync(string projectPath, string? userId = null)
    {
        return GenerateContextAsync(projectPath, 2000, userId, null);
    }

    public Task<string> GenerateArchitectureContextAsync(string projectPath, string? userId = null)
    {
        return GenerateContextAsync(projectPath, 4000, userId, null);
    }

    public Task<string> GenerateCodingContextAsync(string projectPath, string? userId = null)
    {
        return GenerateContextAsync(projectPath, 4000, userId, null);
    }

    private List<ContextSection> BuildContextSections(ProjectMemoryDto memory, UserPlan plan)
    {
        var sections = new List<ContextSection>
        {
            new("00 Header", 1, BuildHeader(memory)),
            new("01 Project Identity", 1, BuildProjectIdentity(memory)),
            new("02 Business Domain and Goals", 1, BuildBusinessDomain(memory)),
            new("03 AI Readiness and Detection Confidence", 1, BuildConfidenceSection(memory)),
            new("04 Architecture Style and Data Flow", 1, BuildArchitectureSection(memory, plan)),
            new("05 Frontend Backend and API Relationship", 1, BuildApiRelationshipSection(memory)),
            new("06 Authentication Database and Environment", 1, BuildRuntimeSection(memory)),
            new("07 Folder Structure", 1, BuildFolderStructureSection(memory, plan)),
            new("08 Dependency Graph and Package Summary", 2, BuildDependencySection(memory, plan)),
            new("09 AI Coding Rules", 1, BuildRulesSection(memory, plan)),
            new("10 Compression and Omissions", 3, BuildCompressionPolicySection(memory))
        };

        if (plan != UserPlan.Free)
        {
            sections.Add(new("11 Important Modules", 2, BuildModuleSection(memory)));
            sections.Add(new("12 Important Files and Editing Risks", 2, BuildImportantFilesSection(memory)));
            if (memory.Metrics.RouteMap?.Any() == true) sections.Add(new("13 Route and Endpoint Map", 2, BuildRouteMapSection(memory)));
            if (memory.Metrics.ServiceGraph?.Any() == true) sections.Add(new("14 Service Graph", 2, BuildServiceGraphSection(memory)));
            if (memory.Metrics.EntityMap?.Any() == true) sections.Add(new("15 Entity and Database Map", 2, BuildEntityMapSection(memory)));
            if (memory.Metrics.DtoMap?.Any() == true) sections.Add(new("16 DTO and Request Map", 2, BuildDtoMapSection(memory)));
            if (memory.Metrics.AiProviderMap?.Any() == true) sections.Add(new("17 AI Provider Map", 2, BuildAiProviderMapSection(memory)));
            if (memory.Metrics.PlanEnforcementMap?.Any() == true) sections.Add(new("18 Plan and Usage Enforcement", 2, BuildPlanEnforcementSection(memory)));
            if (memory.Metrics.ExtensionExportMap?.Any() == true) sections.Add(new("19 Extension Export Map", 2, BuildExtensionExportSection(memory)));
            if (memory.Metrics.TestBuildMap?.Any() == true) sections.Add(new("20 Testing and Build Map", 3, BuildTestBuildSection(memory)));
            sections.Add(new("21 Living Memory Evolution", 2, BuildLivingMemorySection(memory)));
            sections.Add(new("22 Architecture Guard Rules", 2, BuildGuardSection(memory)));
        }
        else
        {
            sections.Add(new("11 Basic Editing Guidance and Export Instructions", 1, BuildFreeEditingAndExportSection(memory)));
            sections.Add(new("12 Known Risks and Unknowns", 1, BuildFreeRisksAndUnknownsSection(memory)));
        }

        return sections;
    }

    private string BuildHeader(ProjectMemoryDto memory)
    {
        return string.Join('\n', new[]
        {
            "# AI Context Brain Optimized Context",
            "",
            $"Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC",
            $"Project: {memory.Name}",
            $"Root: `{memory.ProjectPath}`",
            $"Last Scan: {FormatDate(memory.LastScanDate)}",
            "",
            "This is Living Project Memory for AI coding assistants. It explains what matters, why it matters, and how to edit safely."
        });
    }

    private string BuildProjectIdentity(ProjectMemoryDto memory)
    {
        var sb = Section("Project Identity");
        sb.AppendLine($"- Purpose: {InferPurpose(memory)}");
        sb.AppendLine($"- Project type: {GetProjectType(memory)}");
        sb.AppendLine($"- Primary architecture: {Known(memory.ArchitectureType)}");
        sb.AppendLine($"- Primary framework stack: {Known(memory.Framework)}");
        sb.AppendLine($"- Scale: {memory.Metrics.FilesCount:N0} files, {memory.Metrics.LinesOfCode:N0} lines, {memory.Metrics.FoldersCount:N0} folders.");
        if (!string.IsNullOrWhiteSpace(memory.SemanticSummary))
        {
            sb.AppendLine($"- Stored semantic summary: {memory.SemanticSummary}");
        }
        sb.AppendLine("- Main AI outcome: better code generation with fewer repeated explanations and less architecture drift.");
        return sb.ToString();
    }

    private string BuildBusinessDomain(ProjectMemoryDto memory)
    {
        var modules = memory.Metrics.ModuleMap?.Select(m => m.Name).ToList() ?? new();
        var deps = memory.Metrics.Dependencies.Take(10).ToList();
        var sb = Section("Business Domain and Goals");
        sb.AppendLine($"- Inferred domain: {InferDomain(memory, modules, deps)}");
        sb.AppendLine("- Product goal: preserve a compact, accurate representation of repository structure, decisions, risks, and AI instructions.");
        sb.AppendLine("- Users affected by changes: developers using the web dashboard, the VS Code extension, and connected AI coding tools.");
        sb.AppendLine($"- Core capabilities present: {JoinInline(new[] { Known(memory.Framework), Known(memory.ArchitectureType), Known(memory.DatabaseType), Known(memory.AuthSystem) }.Where(x => x != "Unknown"))}.");
        sb.AppendLine("- Useful AI behavior: explain proposed changes in terms of project memory, not isolated files.");
        return sb.ToString();
    }

    private string BuildConfidenceSection(ProjectMemoryDto memory)
    {
        var confidence = CalculateDetectionConfidence(memory);
        var quality = CalculateQualityScore(memory);
        var sb = new StringBuilder();
        sb.AppendLine("## Detection Confidence");
        sb.AppendLine($"- Quality score: {quality.Overall}/100.");
        sb.AppendLine($"- AI readiness: {confidence.AiReadiness}/100.");
        sb.AppendLine($"- Framework confidence: {confidence.Framework}/100.");
        sb.AppendLine($"- Architecture confidence: {confidence.Architecture}/100.");
        sb.AppendLine($"- Dependencies confidence: {confidence.Dependencies}/100.");
        sb.AppendLine($"- Database confidence: {confidence.Database}/100.");
        sb.AppendLine($"- Authentication confidence: {confidence.Authentication}/100.");
        sb.AppendLine($"- Modules confidence: {confidence.Modules}/100.");
        if (confidence.LowConfidenceWarnings.Any())
        {
            sb.AppendLine("- Warnings:");
            foreach (var warning in confidence.LowConfidenceWarnings.Take(8))
            {
                sb.AppendLine($"  - {warning}");
            }
        }
        return sb.ToString();
    }

    private string BuildArchitectureSection(ProjectMemoryDto memory, UserPlan plan)
    {
        var summary = memory.Metrics.ArchitectureSummary;
        var sb = Section("Architecture Style and Data Flow");
        sb.AppendLine($"- Detected style: {summary?.Style ?? Known(memory.ArchitectureType)}.");
        sb.AppendLine($"- Data flow: {summary?.DataFlowDescription ?? InferDataFlow(memory)}");

        if (plan == UserPlan.Free)
        {
            sb.AppendLine($"- Basic Architecture Summary: Backend built with {Known(memory.Framework)} following {Known(memory.ArchitectureType)} patterns, using {Known(memory.DatabaseType)} database persistence{(string.IsNullOrWhiteSpace(memory.AuthSystem) ? "" : $" and {memory.AuthSystem} auth")}.");
        }
        else
        {
            sb.AppendLine($"- Business logic: {summary?.BusinessLogicLocation ?? InferBusinessLogicLocation(memory)}");
            sb.AppendLine($"- UI logic: {summary?.UiLogicLocation ?? InferUiLocation(memory)}");
            sb.AppendLine($"- API logic: {summary?.ApiLogicLocation ?? InferApiLocation(memory)}");
            sb.AppendLine($"- Configuration: {summary?.ConfigLocation ?? "Environment variables, appsettings files, package metadata, and deployment config."}");
            sb.AppendLine("- Editing principle: change the owner layer first, then update callers/adapters rather than crossing boundaries from UI to persistence.");
        }
        return sb.ToString();
    }

    private string BuildApiRelationshipSection(ProjectMemoryDto memory)
    {
        var modules = memory.Metrics.ModuleMap ?? new();
        var hasClient = modules.Any(m => m.Name.Contains("Dashboard", StringComparison.OrdinalIgnoreCase))
            || memory.Framework.Contains("React", StringComparison.OrdinalIgnoreCase)
            || memory.Framework.Contains("Vite", StringComparison.OrdinalIgnoreCase)
            || memory.Framework.Contains("Next", StringComparison.OrdinalIgnoreCase);
        var hasApi = modules.Any(m => m.Name.Contains("API", StringComparison.OrdinalIgnoreCase))
            || memory.Framework.Contains("ASP.NET", StringComparison.OrdinalIgnoreCase)
            || memory.Framework.Contains("Express", StringComparison.OrdinalIgnoreCase)
            || memory.Framework.Contains("FastAPI", StringComparison.OrdinalIgnoreCase);

        var sb = Section("Frontend Backend and API Relationship");
        sb.AppendLine($"- Frontend detected: {(hasClient ? "yes" : "not explicit")}.");
        sb.AppendLine($"- Backend/API detected: {(hasApi ? "yes" : "not explicit")}.");
        sb.AppendLine("- Expected request path: UI or extension command -> authenticated backend endpoint -> service layer -> persistence/AI provider -> response to client.");
        sb.AppendLine("- API editing risk: keep endpoint names, request DTOs, auth checks, tenant/project scoping, and plan enforcement aligned with clients.");
        sb.AppendLine("- Client editing risk: keep UI feature exposure in sync with backend plan flags; hide or disable unavailable actions instead of only warning later.");
        return sb.ToString();
    }

    private string BuildRuntimeSection(ProjectMemoryDto memory)
    {
        var tech = memory.Metrics.TechStack;
        var sb = Section("Authentication Database and Environment");
        sb.AppendLine($"- Authentication: {FormatDetectedTech(tech?.Auth, Known(memory.AuthSystem))}.");
        sb.AppendLine($"- Database: {FormatDetectedTech(tech?.Database, Known(memory.DatabaseType))}.");
        sb.AppendLine($"- ORM/data access: {FormatDetectedTech(tech?.Orm, InferOrm(memory))}.");
        sb.AppendLine($"- Package manager: {FormatDetectedTech(tech?.PackageManager, InferPackageManager(memory))}.");
        sb.AppendLine($"- Deployment: {FormatDetectedTech(tech?.Deployment, "Not explicit") }.");
        sb.AppendLine("- Environment rule: secrets must stay in environment variables or managed secret storage; never write provider keys into generated context or repo files.");
        return sb.ToString();
    }

    private string BuildModuleSection(ProjectMemoryDto memory)
    {
        var sb = Section("Important Modules");
        var modules = memory.Metrics.ModuleMap;
        if (modules == null || !modules.Any())
        {
            sb.AppendLine("- No explicit module map was saved. Treat the repository as a standard application until a richer scan is available.");
            sb.AppendLine($"- Inferred core module: {GetProjectType(memory)} built with {Known(memory.Framework)}.");
            return sb.ToString();
        }

        foreach (var module in modules.Take(14))
        {
            sb.AppendLine($"### {module.Name}");
            sb.AppendLine($"- Why it matters: {module.Purpose}");
            sb.AppendLine($"- Key files: {JoinInline(module.KeyFiles.Take(8))}.");
            sb.AppendLine($"- Depends on: {JoinInline(module.Dependencies.Take(8))}.");
            sb.AppendLine($"- Current status: {module.Status}.");
            sb.AppendLine($"- Risk level: {(string.IsNullOrWhiteSpace(module.RiskLevel) ? "Medium" : module.RiskLevel)}.");
            sb.AppendLine($"- Editing guidance: {(string.IsNullOrWhiteSpace(module.EditingGuidance) ? "preserve this module boundary; place new behavior beside its closest existing responsibility." : module.EditingGuidance)}");
            sb.AppendLine();
        }
        return sb.ToString();
    }

    private string BuildImportantFilesSection(ProjectMemoryDto memory)
    {
        var sb = Section("Important Files and Editing Risks");
        var files = memory.Metrics.ImportantFiles;
        if (files == null || !files.Any())
        {
            sb.AppendLine("- Important file map is missing from the saved scan payload. Use dependency, module, and folder data to identify entrypoints before editing.");
            return sb.ToString();
        }

        var moduleFiles = memory.Metrics.ModuleMap?.SelectMany(m => m.KeyFiles).Distinct().ToList() ?? new();
        foreach (var file in files.Take(16))
        {
            sb.AppendLine($"### `{file.Path}`");
            sb.AppendLine($"- Why it exists: {file.Importance}");
            sb.AppendLine($"- Responsibility: {InferResponsibility(file)}");
            sb.AppendLine($"- Editing risk: {InferEditingRisk(file)}");
            sb.AppendLine($"- Related files: {JoinInline(FindRelatedFiles(file.Path, moduleFiles).Take(5))}.");
            sb.AppendLine($"- AI recommendation: {file.AiBehavior}");
            sb.AppendLine();
        }
        return sb.ToString();
    }

    // ── Pro/Team Architecture-Aware Section Builders ──

    private string BuildRouteMapSection(ProjectMemoryDto memory)
    {
        var sb = Section("Route and Endpoint Map");
        var routes = memory.Metrics.RouteMap;
        if (routes == null || !routes.Any())
        {
            sb.AppendLine("- Route map data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        var grouped = routes.GroupBy(r => r.Controller).OrderBy(g => g.Key);
        foreach (var group in grouped)
        {
            sb.AppendLine($"### {group.Key}");
            foreach (var route in group.Take(12))
            {
                sb.AppendLine($"- **{route.HttpMethod}** `{route.Route}` — Auth: {route.AuthRequirement ?? "Unknown"}. {route.Purpose}");
            }
            sb.AppendLine();
        }
        sb.AppendLine("- Editing rule: when changing routes, update all clients (dashboard, extension, tests) that reference the endpoint.");
        return sb.ToString();
    }

    private string BuildServiceGraphSection(ProjectMemoryDto memory)
    {
        var sb = Section("Service Graph");
        var services = memory.Metrics.ServiceGraph;
        if (services == null || !services.Any())
        {
            sb.AppendLine("- Service graph data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        foreach (var service in services.Take(16))
        {
            var deps = service.DependsOn.Any() ? string.Join(" -> ", service.DependsOn.Take(6)) : "no detected dependencies";
            sb.AppendLine($"- **{service.Name}** -> {deps}");
            sb.AppendLine($"  File: `{service.Path}`");
        }
        sb.AppendLine();
        sb.AppendLine("- Editing rule: when modifying a service, check its dependents and callers. Inject new dependencies through the constructor.");
        return sb.ToString();
    }

    private string BuildEntityMapSection(ProjectMemoryDto memory)
    {
        var sb = Section("Entity and Database Map");
        var entities = memory.Metrics.EntityMap;
        if (entities == null || !entities.Any())
        {
            sb.AppendLine("- Entity map data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        foreach (var entity in entities.Take(16))
        {
            sb.AppendLine($"### {entity.Name}");
            sb.AppendLine($"- Purpose: {entity.TablePurpose ?? "Domain entity"}");
            if (entity.Relationships.Any())
            {
                sb.AppendLine($"- Relationships: {string.Join(", ", entity.Relationships.Take(6))}");
            }
            sb.AppendLine($"- File: `{entity.Path}`");
            sb.AppendLine();
        }
        sb.AppendLine("- ⚠️ Schema editing warning: add EF Core migrations for any entity changes. Test with `dotnet ef database update`.");
        return sb.ToString();
    }

    private string BuildDtoMapSection(ProjectMemoryDto memory)
    {
        var sb = Section("DTO and Request Map");
        var dtos = memory.Metrics.DtoMap;
        if (dtos == null || !dtos.Any())
        {
            sb.AppendLine("- DTO map data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        foreach (var dto in dtos.Take(20))
        {
            sb.AppendLine($"- **{dto.Name}** — Used by: {dto.UsedBy ?? "Unknown"}. Purpose: {dto.Purpose}. File: `{dto.Path}`");
        }
        sb.AppendLine();
        sb.AppendLine("- Editing rule: when modifying DTOs, update all serialization consumers (controllers, clients, tests).");
        return sb.ToString();
    }

    private string BuildAiProviderMapSection(ProjectMemoryDto memory)
    {
        var sb = Section("AI Provider Map");
        var providers = memory.Metrics.AiProviderMap;
        if (providers == null || !providers.Any())
        {
            sb.AppendLine("- AI provider map data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        foreach (var provider in providers.OrderBy(p => p.FallbackOrder ?? 99))
        {
            sb.AppendLine($"### {provider.ProviderName}");
            sb.AppendLine($"- Fallback order: {provider.FallbackOrder ?? 0}");
            sb.AppendLine($"- Environment variables: {JoinInline(provider.EnvVarNames)}");
            sb.AppendLine($"- File: `{provider.Path}`");
            sb.AppendLine();
        }
        sb.AppendLine("- 🔒 Safety rule: NEVER expose API keys in code, context files, logs, or client responses. Use environment variables only.");
        return sb.ToString();
    }

    private string BuildPlanEnforcementSection(ProjectMemoryDto memory)
    {
        var sb = Section("Plan and Usage Enforcement");
        var enforcement = memory.Metrics.PlanEnforcementMap;
        if (enforcement == null || !enforcement.Any())
        {
            sb.AppendLine("- Plan enforcement map data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        var grouped = enforcement.GroupBy(e => e.Type).OrderBy(g => g.Key);
        foreach (var group in grouped)
        {
            sb.AppendLine($"### {group.Key}s");
            foreach (var item in group.Take(10))
            {
                sb.AppendLine($"- **{item.Name}** — File: `{item.Path}`{(item.Value != null ? $" Value: {item.Value}" : "")}");
            }
            sb.AppendLine();
        }
        sb.AppendLine("- Editing rule: plan limits must be enforced server-side. Client-side checks are only UI guards.");
        return sb.ToString();
    }

    private string BuildExtensionExportSection(ProjectMemoryDto memory)
    {
        var sb = Section("Extension Export Map");
        var exports = memory.Metrics.ExtensionExportMap;
        if (exports == null || !exports.Any())
        {
            sb.AppendLine("- Extension export map data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        foreach (var export in exports)
        {
            sb.AppendLine($"- **{export.TargetEditor}**: `{export.FilePath}` — {export.Description}");
        }
        sb.AppendLine();
        sb.AppendLine("- These files are auto-generated by AI Context Brain. Manual edits will be overwritten on next export.");
        return sb.ToString();
    }

    private string BuildTestBuildSection(ProjectMemoryDto memory)
    {
        var sb = Section("Testing and Build Map");
        var items = memory.Metrics.TestBuildMap;
        if (items == null || !items.Any())
        {
            sb.AppendLine("- Test/build map data is missing from the saved scan payload. Refresh the project memory with the current scanner.");
            return sb.ToString();
        }

        var grouped = items.GroupBy(i => i.Type).OrderBy(g => g.Key);
        foreach (var group in grouped)
        {
            sb.AppendLine($"### {group.Key}");
            foreach (var item in group.Take(8))
            {
                sb.AppendLine($"- **{item.Name}**: `{item.Command}` (path: `{item.Path}`)");
            }
            sb.AppendLine();
        }
        sb.AppendLine("- Recommended verification: run all build and test commands before finalizing changes.");
        return sb.ToString();
    }

    private string BuildDependencySection(ProjectMemoryDto memory, UserPlan plan)
    {
        var deps = memory.Metrics.Dependencies;
        var sb = Section(plan == UserPlan.Free ? "Key Dependencies" : "Dependency Graph and Package Summary");
        if (!deps.Any())
        {
            sb.AppendLine("- Dependency metadata is missing from the saved scan payload.");
            return sb.ToString();
        }

        var limit = plan == UserPlan.Free ? 6 : 24;
        var grouped = deps
            .GroupBy(ClassifyDependency)
            .OrderBy(g => g.Key)
            .ToList();

        foreach (var group in grouped)
        {
            sb.AppendLine($"- {group.Key}: {JoinInline(group.Take(limit))}.");
        }

        if (plan != UserPlan.Free)
        {
            sb.AppendLine("- Dependency editing rule: add packages only when existing framework utilities cannot solve the problem cleanly.");
        }
        return sb.ToString();
    }

    private string BuildLivingMemorySection(ProjectMemoryDto memory)
    {
        var sb = Section("Living Memory Evolution");
        sb.AppendLine($"- Last scan: {FormatDate(memory.LastScanDate)}.");
        sb.AppendLine($"- Scan fingerprint: {memory.ScanFingerprint ?? "not available"}.");
        sb.AppendLine($"- Current memory includes {memory.ArchitectureRules.Count} architecture rules, {memory.CodingConventions.Count} coding conventions, and {memory.SystemDecisions.Count} recorded decisions.");
        if (memory.SystemDecisions.Any())
        {
            sb.AppendLine("- Recent decisions:");
            foreach (var decision in memory.SystemDecisions.OrderByDescending(d => d.DecisionDate).Take(8))
            {
                sb.AppendLine($"  - {decision.Title}: {decision.Decision}");
            }
        }
        sb.AppendLine("- Update strategy: after structural changes, refresh project memory so future AI sessions inherit the new architecture.");
        return sb.ToString();
    }

    private string BuildRulesSection(ProjectMemoryDto memory, UserPlan plan)
    {
        var sb = Section(plan == UserPlan.Free ? "Basic AI Coding Rules" : "AI Coding Rules");
        var rules = BuildDynamicRules(memory);
        var limit = plan == UserPlan.Free ? 6 : 14;
        foreach (var rule in rules.Take(limit))
        {
            sb.AppendLine($"- {rule}");
        }
        return sb.ToString();
    }

    private string BuildFolderStructureSection(ProjectMemoryDto memory, UserPlan plan)
    {
        var sb = Section("Folder Structure");
        if (memory.FolderStructure == null || !memory.FolderStructure.Any())
        {
            sb.AppendLine("- No folder structure detected.");
            return sb.ToString();
        }

        var folders = memory.FolderStructure.OrderBy(f => f).ToList();
        if (plan == UserPlan.Free)
        {
            sb.AppendLine("- Top-level directories:");
            var topLevel = folders
                .Where(f => !f.Contains('/') && !f.Contains('\\'))
                .Take(25)
                .ToList();
            foreach (var folder in topLevel)
            {
                sb.AppendLine($"  - `/{folder}`");
            }
        }
        else
        {
            sb.AppendLine("- Full directory structure:");
            foreach (var folder in folders.Take(100))
            {
                sb.AppendLine($"  - `/{folder}`");
            }
            if (folders.Count > 100)
            {
                sb.AppendLine($"  - ... and {folders.Count - 100} more subdirectories.");
            }
        }
        return sb.ToString();
    }

    private string BuildFreeEditingAndExportSection(ProjectMemoryDto memory)
    {
        var sb = Section("Basic Editing Guidance and Export Instructions");
        sb.AppendLine("### Editing Guidance");
        sb.AppendLine("- Reuse existing functions and classes before proposing new packages or helpers.");
        sb.AppendLine("- Keep modifications small and self-contained; verify the project still builds before declaring a task complete.");
        sb.AppendLine("- Do not write debug console statements or hardcode passwords/tokens.");
        sb.AppendLine();
        sb.AppendLine("### Export Instructions");
        sb.AppendLine("- Generate or refresh the `.ai-context.md` file using the VS Code extension whenever core architecture rules or directories change.");
        sb.AppendLine("- Load this optimized context into your AI assistant (e.g. Cursor, Claude Code, GitHub Copilot) to kickstart your programming sessions.");
        sb.AppendLine();
        sb.AppendLine("### Security Notes");
        sb.AppendLine("- 🔒 Never hardcode connection strings, JWT secrets, OAuth tokens, or third-party client credentials. Always pull them from environment configuration.");
        return sb.ToString();
    }

    private string BuildFreeRisksAndUnknownsSection(ProjectMemoryDto memory)
    {
        var sb = Section("Known Risks and Unknowns");
        var confidence = CalculateDetectionConfidence(memory);

        if (confidence.LowConfidenceWarnings.Any())
        {
            sb.AppendLine("- Current detection anomalies:");
            foreach (var warning in confidence.LowConfidenceWarnings.Take(4))
            {
                sb.AppendLine($"  - {warning}");
            }
        }
        else
        {
            sb.AppendLine("- No major framework or stack detection conflicts were identified during the scan.");
        }

        sb.AppendLine("- Code drift risk: AI may propose patterns matching legacy components unless guided by the active framework conventions.");
        return sb.ToString();
    }

    private string BuildGuardSection(ProjectMemoryDto memory)
    {
        var sb = Section("Architecture Guard Rules");
        var rules = memory.ArchitectureRules.Where(r => r.IsActive).ToList();
        if (!rules.Any())
        {
            sb.AppendLine("- No active architecture guard rules were saved.");
            sb.AppendLine("- Default guard expectation: keep naming, import direction, folder ownership, file size, and security boundaries consistent.");
            return sb.ToString();
        }

        foreach (var rule in rules.Take(20))
        {
            sb.AppendLine($"- {rule.Name} ({rule.Severity}, {rule.RuleType}): {rule.Pattern}");
            if (!string.IsNullOrWhiteSpace(rule.Description))
            {
                sb.AppendLine($"  Why it matters: {rule.Description}");
            }
            if (!string.IsNullOrWhiteSpace(rule.AutoFixSuggestion))
            {
                sb.AppendLine($"  Suggested fix: {rule.AutoFixSuggestion}");
            }
        }
        return sb.ToString();
    }

    private string BuildCompressionPolicySection(ProjectMemoryDto memory)
    {
        var sb = Section("Compression and Omissions");
        sb.AppendLine("- Priority retained: project identity, architecture, coding rules, important modules, important files, dependencies, then folder metadata.");
        sb.AppendLine("- Compression style: semantic section-level reduction. Low-priority details are summarized before truncation.");
        sb.AppendLine("- Omitted when needed: long folder trees, repeated dependency lists, low-confidence metadata, and verbose file metrics.");
        sb.AppendLine("- AI usefulness check: this context should be sufficient to implement a new feature without re-explaining the repository from scratch.");
        return sb.ToString();
    }

    private string CompressContextSemantically(List<ContextSection> sections, int maxTokens)
    {
        var maxChars = Math.Max(4000, maxTokens * 4);
        var full = string.Join("\n\n", sections.Select(s => s.Content.Trim())) + "\n";
        if (full.Length <= maxChars)
        {
            return full;
        }

        var sb = new StringBuilder();
        var omitted = new List<string>();
        var budget = (int)(maxChars * 0.94);

        foreach (var section in sections.OrderBy(s => s.Priority).ThenBy(s => s.Title))
        {
            var content = section.Content.Trim();
            var remaining = budget - sb.Length;
            if (remaining <= 600)
            {
                omitted.Add(section.Title);
                continue;
            }

            if (content.Length + 2 <= remaining)
            {
                sb.AppendLine(content);
                sb.AppendLine();
                continue;
            }

            if (section.Priority <= 1)
            {
                sb.AppendLine(SummarizeSection(content, Math.Max(700, remaining - 400)));
                sb.AppendLine();
            }
            else
            {
                omitted.Add(section.Title);
            }
        }

        sb.AppendLine("## Compression Report");
        sb.AppendLine($"- Max context size applied: {maxTokens:N0} tokens.");
        sb.AppendLine("- Compression/Omitted: semantic budget was reached.");
        sb.AppendLine($"- Omitted sections: {(omitted.Any() ? string.Join(", ", omitted) : "none; high-priority sections were summarized")}.");
        sb.AppendLine("- Ask AI to request a fresh context export after major refactors or package changes.");
        return sb.ToString();
    }

    private static string SummarizeSection(string content, int maxChars)
    {
        if (content.Length <= maxChars) return content;
        var lines = content.Split('\n');
        var title = lines.FirstOrDefault() ?? "## Summary";
        var important = lines
            .Skip(1)
            .Where(l => l.StartsWith("- ") || l.StartsWith("### "))
            .Take(18)
            .ToList();

        var sb = new StringBuilder();
        sb.AppendLine(title);
        foreach (var line in important)
        {
            if (sb.Length + line.Length > maxChars) break;
            sb.AppendLine(line);
        }
        sb.AppendLine("- Compressed/Omitted: additional details were summarized because of the max context size limit.");
        return sb.ToString();
    }

    private List<string> BuildDynamicRules(ProjectMemoryDto memory)
    {
        var rules = new List<string>
        {
            "Read `.ai-context.md` before editing and use it as the source of truth for architecture and project memory.",
            "Do not hardcode secrets, tokens, connection strings, provider keys, webhook secrets, or email credentials.",
            "Reuse existing services, controllers, hooks, context providers, and extension command patterns before adding new abstractions.",
            "Keep server-side authorization, tenant/project scoping, and plan enforcement in backend code; UI checks are only an additional guard.",
            "When changing API contracts, update the dashboard, extension client, tests, and documentation together.",
            "Prefer incremental, focused changes and verify with the available build/test commands."
        };

        if (memory.ArchitectureType.Contains("Clean", StringComparison.OrdinalIgnoreCase))
        {
            rules.Add("Preserve Clean Architecture direction: presentation calls application services; domain stays independent of infrastructure.");
        }
        if (memory.ArchitectureType.Contains("MVC", StringComparison.OrdinalIgnoreCase))
        {
            rules.Add("Keep controllers thin; put reusable business behavior in services/models rather than duplicating logic in actions.");
        }
        if (memory.Framework.Contains("React", StringComparison.OrdinalIgnoreCase) || memory.Framework.Contains("Vite", StringComparison.OrdinalIgnoreCase))
        {
            rules.Add("Match existing React component state patterns and keep UI feature visibility aligned with backend plan flags.");
        }
        if (memory.Framework.Contains("ASP.NET", StringComparison.OrdinalIgnoreCase) || memory.Framework.Contains(".NET", StringComparison.OrdinalIgnoreCase))
        {
            rules.Add("Use dependency injection, async EF Core APIs, DTO validation, migrations for schema changes, and explicit HTTP error responses.");
        }
        if (memory.AuthSystem is not ("Unknown" or "Not detected" or ""))
        {
            rules.Add($"Preserve the existing auth flow ({memory.AuthSystem}) and never bypass token validation in project, memory, or update endpoints.");
        }
        if (memory.DatabaseType is not ("Unknown" or "Not detected" or ""))
        {
            rules.Add($"Treat {memory.DatabaseType} persistence changes as schema-affecting; add migrations and update seed/self-healing paths when needed.");
        }

        foreach (var rule in memory.ArchitectureRules.Where(r => r.IsActive).Take(8))
        {
            rules.Add($"Honor architecture guard rule `{rule.Name}`: {rule.Pattern}.");
        }

        return rules.Distinct().ToList();
    }

    private ContextQualityReport CalculateQuality(ProjectMemoryDto memory) => CalculateQualityScore(memory);

    public DetectionConfidence CalculateDetectionConfidence(ProjectMemoryDto? memory)
    {
        var result = new DetectionConfidence();
        if (memory == null)
        {
            result.LowConfidenceWarnings.Add("No project memory provided.");
            return result;
        }

        result.Framework = ScoreKnown(memory.Framework, 100, 20);
        result.Architecture = ScoreKnown(memory.ArchitectureType, 96, 30);
        result.Dependencies = memory.Metrics.Dependencies.Any() ? 100 : 10;
        result.Database = ScoreKnown(memory.DatabaseType, 92, 42);
        result.Authentication = ScoreKnown(memory.AuthSystem, 87, 25);
        result.Modules = memory.Metrics.ModuleMap?.Count >= 5 ? 95 : memory.Metrics.ModuleMap?.Any() == true ? 75 : 50;
        result.AiReadiness = (result.Framework + result.Architecture + result.Dependencies + result.Database + result.Authentication + result.Modules) / 6;

        if (result.Database < 60) result.LowConfidenceWarnings.Add("Database detection confidence is low; verify configuration and dependency files.");
        if (result.Authentication < 60) result.LowConfidenceWarnings.Add("Authentication detection confidence is low; verify middleware and token flow.");
        if (result.Modules < 70) result.LowConfidenceWarnings.Add("Module map is sparse; run a full scan to improve AI usefulness.");
        if (result.Dependencies < 60) result.LowConfidenceWarnings.Add("Dependency metadata is sparse; make sure package files are included in scan.");
        if (memory.Metrics.RouteMap == null || !memory.Metrics.RouteMap.Any()) result.LowConfidenceWarnings.Add("Route/endpoint map is missing from the saved scan payload; API surface is not documented.");
        if (memory.Metrics.ServiceGraph == null || !memory.Metrics.ServiceGraph.Any()) result.LowConfidenceWarnings.Add("Service graph is missing from the saved scan payload; dependency chains are not documented.");

        return result;
    }

    public ContextQualityReport CalculateQualityScore(ProjectMemoryDto? memory)
    {
        var report = new ContextQualityReport();
        if (memory == null)
        {
            report.Overall = 0;
            report.Unknowns.Add("No project memory was provided.");
            return report;
        }

        AddScore(report, "Architecture", ScoreKnown(memory.ArchitectureType, 100, 20), $"Architecture: {Known(memory.ArchitectureType)}");
        AddScore(report, "Framework", ScoreKnown(memory.Framework, 100, 20), $"Framework: {Known(memory.Framework)}");
        AddScore(report, "Dependencies", memory.Metrics.Dependencies.Any() ? 100 : 15, $"{memory.Metrics.Dependencies.Count} dependencies parsed.");
        AddScore(report, "Database", ScoreKnown(memory.DatabaseType, 100, 10), $"Database: {Known(memory.DatabaseType)}");
        AddScore(report, "Authentication", ScoreKnown(memory.AuthSystem, 100, 10), $"Authentication: {Known(memory.AuthSystem)}");
        AddScore(report, "Modules", memory.Metrics.ModuleMap?.Count >= 5 ? 100 : memory.Metrics.ModuleMap?.Any() == true ? Math.Min(100, memory.Metrics.ModuleMap.Count * 20) : 15, $"{memory.Metrics.ModuleMap?.Count ?? 0} modules mapped.");
        AddScore(report, "ImportantFiles", memory.Metrics.ImportantFiles?.Any() == true ? Math.Min(100, memory.Metrics.ImportantFiles.Count * 12) : 15, $"{memory.Metrics.ImportantFiles?.Count ?? 0} important files mapped.");
        AddScore(report, "FileStructure", memory.FolderStructure.Any() ? Math.Min(100, memory.FolderStructure.Count * 4) : 10, $"{memory.FolderStructure.Count} folder entries.");
        // Pro/Team architecture-aware scoring
        AddScore(report, "RouteMap", memory.Metrics.RouteMap?.Any() == true ? Math.Min(100, memory.Metrics.RouteMap.Count * 10) : 10, $"{memory.Metrics.RouteMap?.Count ?? 0} routes detected.");
        AddScore(report, "ServiceGraph", memory.Metrics.ServiceGraph?.Any() == true ? Math.Min(100, memory.Metrics.ServiceGraph.Count * 15) : 10, $"{memory.Metrics.ServiceGraph?.Count ?? 0} services graphed.");
        AddScore(report, "EntityMap", memory.Metrics.EntityMap?.Any() == true ? Math.Min(100, memory.Metrics.EntityMap.Count * 15) : 10, $"{memory.Metrics.EntityMap?.Count ?? 0} entities detected.");
        AddScore(report, "DtoMap", memory.Metrics.DtoMap?.Any() == true ? Math.Min(100, memory.Metrics.DtoMap.Count * 10) : 15, $"{memory.Metrics.DtoMap?.Count ?? 0} DTOs detected.");
        AddScore(report, "AiProviders", memory.Metrics.AiProviderMap?.Any() == true ? 100 : 50, $"{memory.Metrics.AiProviderMap?.Count ?? 0} AI providers detected.");
        AddScore(report, "PlanEnforcement", memory.Metrics.PlanEnforcementMap?.Any() == true ? 100 : 50, $"{memory.Metrics.PlanEnforcementMap?.Count ?? 0} enforcement points detected.");
        AddScore(report, "ExtensionExports", memory.Metrics.ExtensionExportMap?.Any() == true ? 100 : 50, $"{memory.Metrics.ExtensionExportMap?.Count ?? 0} export targets detected.");
        AddScore(report, "TestBuildConfigs", memory.Metrics.TestBuildMap?.Any() == true ? 100 : 20, $"{memory.Metrics.TestBuildMap?.Count ?? 0} build/test configs detected.");

        report.Overall = (int)Math.Round(report.Scores.Values.Average(s => s.Score));
        foreach (var score in report.Scores.Where(s => s.Value.Score >= 80))
        {
            report.Strengths.Add($"{score.Key} is strong.");
        }
        foreach (var score in report.Scores.Where(s => s.Value.Score < 50))
        {
            report.Unknowns.Add($"{score.Key} needs richer scan data.");
        }

        return report;
    }

    private static void AddScore(ContextQualityReport report, string name, int score, string detail)
    {
        report.Scores[name] = new CategoryScore
        {
            Score = score,
            Status = score >= 90 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "poor",
            Detail = detail
        };
    }

    private static int ScoreKnown(string? value, int known, int unknown)
    {
        return string.IsNullOrWhiteSpace(value) || value.Equals("Unknown", StringComparison.OrdinalIgnoreCase) || value.Equals("Not detected", StringComparison.OrdinalIgnoreCase)
            ? unknown
            : known;
    }

    private static StringBuilder Section(string title)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"## {title}");
        return sb;
    }

    private static string Known(string? value)
    {
        return string.IsNullOrWhiteSpace(value) || value is "Unknown" or "Not detected"
            ? "fresh scan required"
            : value;
    }

    private static string JoinInline(IEnumerable<string> values)
    {
        var list = values.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct().Take(30).ToList();
        return list.Any() ? string.Join(", ", list.Select(v => $"`{v}`")) : "not available in scan payload";
    }

    private static string FormatDate(DateTime value)
    {
        return value == DateTime.MinValue ? "not available" : $"{value:yyyy-MM-dd HH:mm:ss} UTC";
    }

    private static string FormatDetectedTech(DetectedTech? tech, string fallback)
    {
        return tech == null || string.IsNullOrWhiteSpace(tech.Name)
            ? fallback
            : $"{tech.Name} ({Math.Round(tech.Confidence * 100)}% confidence)";
    }

    private static string GetProjectType(ProjectMemoryDto memory)
    {
        var framework = memory.Framework;
        if (framework.Contains("React", StringComparison.OrdinalIgnoreCase) || framework.Contains("Vue", StringComparison.OrdinalIgnoreCase) || framework.Contains("Angular", StringComparison.OrdinalIgnoreCase) || framework.Contains("Next", StringComparison.OrdinalIgnoreCase))
            return "web frontend or full-stack JavaScript application";
        if (framework.Contains("ASP.NET", StringComparison.OrdinalIgnoreCase) || framework.Contains(".NET", StringComparison.OrdinalIgnoreCase) || framework.Contains("Express", StringComparison.OrdinalIgnoreCase) || framework.Contains("FastAPI", StringComparison.OrdinalIgnoreCase))
            return "backend API or full-stack service platform";
        if (memory.Metrics.ModuleMap?.Count > 1)
            return "multi-module software workspace";
        return "software codebase";
    }

    private static string InferPurpose(ProjectMemoryDto memory)
    {
        var moduleNames = memory.Metrics.ModuleMap?.Select(m => m.Name).ToList() ?? new();
        if (moduleNames.Any(m => m.Contains("IDE", StringComparison.OrdinalIgnoreCase)) && moduleNames.Any(m => m.Contains("API", StringComparison.OrdinalIgnoreCase)))
            return "AI context optimization platform that scans local repositories, builds living project memory, and exports assistant-ready instructions.";
        if (moduleNames.Any())
            return $"Application organized around {string.Join(", ", moduleNames.Take(4))}.";
        return $"Application built with {Known(memory.Framework)} using {Known(memory.ArchitectureType)} patterns.";
    }

    private static string InferDomain(ProjectMemoryDto memory, List<string> modules, List<string> dependencies)
    {
        var text = $"{memory.Name} {string.Join(' ', modules)} {string.Join(' ', dependencies)}".ToLowerInvariant();
        if (text.Contains("context") || text.Contains("ai") || text.Contains("copilot") || text.Contains("cursor"))
            return "developer tooling for AI-assisted software development";
        if (text.Contains("payment") || text.Contains("billing") || text.Contains("paddle"))
            return "subscription SaaS with billing and account management";
        if (text.Contains("dashboard") || text.Contains("admin"))
            return "SaaS dashboard and operational management";
        return "general software product domain inferred from repository structure";
    }

    private static string InferDataFlow(ProjectMemoryDto memory)
    {
        if (memory.Metrics.ModuleMap?.Any(m => m.Name.Contains("IDE", StringComparison.OrdinalIgnoreCase)) == true)
        {
            return "IDE extension scans local files, uploads project metadata to the backend, backend stores project memory, then optimized context is returned to IDE and dashboard clients.";
        }
        return "Client or command entrypoints call backend/API/service layers, which coordinate persistence, rules, and generated context output.";
    }

    private static string InferBusinessLogicLocation(ProjectMemoryDto memory) => memory.Framework.Contains(".NET", StringComparison.OrdinalIgnoreCase)
        ? "C# service classes and controller orchestration."
        : "Service modules, route handlers, or application-layer functions.";

    private static string InferUiLocation(ProjectMemoryDto memory) => memory.Framework.Contains("React", StringComparison.OrdinalIgnoreCase) || memory.Framework.Contains("Vite", StringComparison.OrdinalIgnoreCase)
        ? "React pages/components and shared context providers."
        : "UI layer not explicit in current scan.";

    private static string InferApiLocation(ProjectMemoryDto memory) => memory.Framework.Contains(".NET", StringComparison.OrdinalIgnoreCase)
        ? "ASP.NET Core controllers and middleware."
        : "Route/controller modules inferred from framework.";

    private static string InferOrm(ProjectMemoryDto memory)
    {
        var deps = string.Join(' ', memory.Metrics.Dependencies).ToLowerInvariant();
        if (deps.Contains("entityframework")) return "Entity Framework Core";
        if (deps.Contains("prisma")) return "Prisma";
        if (deps.Contains("mongoose")) return "Mongoose";
        if (deps.Contains("sqlalchemy")) return "SQLAlchemy";
        return "Not explicit";
    }

    private static string InferPackageManager(ProjectMemoryDto memory)
    {
        var deps = string.Join(' ', memory.Metrics.Dependencies).ToLowerInvariant();
        if (deps.Contains("nuget:") || memory.Framework.Contains(".NET", StringComparison.OrdinalIgnoreCase)) return "NuGet";
        if (memory.Framework.Contains("Node", StringComparison.OrdinalIgnoreCase) || memory.Framework.Contains("React", StringComparison.OrdinalIgnoreCase) || memory.Framework.Contains("Vite", StringComparison.OrdinalIgnoreCase)) return "npm/pnpm/yarn";
        return "Not explicit";
    }

    private static string InferResponsibility(ImportantFileDetails file)
    {
        var category = file.Category.ToLowerInvariant();
        if (category.Contains("entry")) return "bootstraps runtime, command registration, dependency injection, or application startup.";
        if (category.Contains("config")) return "defines project configuration, scripts, dependencies, compiler settings, or runtime options.";
        if (category.Contains("controller")) return "exposes and validates backend request/response behavior.";
        if (category.Contains("service")) return "contains reusable business logic and integration boundaries.";
        if (category.Contains("ui")) return "coordinates visible user workflows and frontend state.";
        return "contains high-impact project behavior identified by scan metadata.";
    }

    private static string InferEditingRisk(ImportantFileDetails file)
    {
        var path = file.Path.ToLowerInvariant();
        if (path.Contains("auth") || path.Contains("program.cs") || path.Contains("controller"))
            return "security, API compatibility, middleware order, or tenant isolation can regress.";
        if (path.Contains("package.json") || path.Contains("csproj"))
            return "dependency, script, and build behavior can change across the workspace.";
        if (path.Contains("dashboard") || path.Contains(".tsx"))
            return "UI plan exposure can drift from backend enforcement if not checked.";
        return "changes can affect project memory quality or downstream AI exports.";
    }

    private static IEnumerable<string> FindRelatedFiles(string filePath, List<string> moduleFiles)
    {
        var directory = Path.GetDirectoryName(filePath)?.Replace('\\', '/');
        return moduleFiles
            .Where(f => !f.Equals(filePath, StringComparison.OrdinalIgnoreCase))
            .Where(f => string.IsNullOrWhiteSpace(directory) || f.Replace('\\', '/').Contains(directory, StringComparison.OrdinalIgnoreCase))
            .DefaultIfEmpty("nearest module files from scan metadata");
    }

    private static string ClassifyDependency(string dep)
    {
        var lower = dep.ToLowerInvariant();
        if (lower.Contains("react") || lower.Contains("vite") || lower.Contains("router")) return "frontend";
        if (lower.Contains("entityframework") || lower.Contains("npgsql") || lower.Contains("sqlite") || lower.Contains("sql")) return "database";
        if (lower.Contains("jwt") || lower.Contains("identity") || lower.Contains("auth")) return "authentication";
        if (lower.Contains("test") || lower.Contains("xunit") || lower.Contains("jest") || lower.Contains("playwright")) return "testing";
        if (lower.Contains("openai") || lower.Contains("gemini") || lower.Contains("ai")) return "ai provider";
        return "runtime";
    }

    private sealed record ContextSection(string Title, int Priority, string Content);
}
