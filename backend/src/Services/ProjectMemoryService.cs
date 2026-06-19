using AiContextBrain.Data;
using AiContextBrain.Dtos;
using AiContextBrain.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AiContextBrain.Services;

public class ProjectMemoryService : IProjectMemoryService
{
    private readonly ApplicationDbContext _context;

    public ProjectMemoryService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ProjectMemoryDto?> GetProjectMemoryAsync(string projectPath, string? userId = null)
    {
        var query = _context.Projects
            .Include(p => p.ArchitectureRules)
            .Include(p => p.CodingConventions)
            .Include(p => p.SystemDecisions)
            .Include(p => p.Scans.OrderByDescending(s => s.ScanDate).Take(1))
            .AsQueryable();

        query = string.IsNullOrEmpty(userId)
            ? query.Where(p => p.Path == projectPath && p.UserId == null)
            : query.Where(p => p.Path == projectPath && p.UserId == userId);

        var project = await query.FirstOrDefaultAsync();

        if (project == null)
        {
            return null;
        }

        var lastScan = project.Scans.FirstOrDefault();
        var scanData = lastScan != null ? JsonSerializer.Deserialize<ProjectMetrics>(lastScan.ScanData) : new ProjectMetrics();

        var folderStructure = new List<string>();
        try { folderStructure = JsonSerializer.Deserialize<List<string>>(lastScan?.FolderStructureJson ?? "[]") ?? new(); } catch {}

        return new ProjectMemoryDto
        {
            Name = project.Name,
            ProjectPath = project.Path,
            Framework = project.Framework ?? "Unknown",
            ArchitectureType = project.ArchitectureType ?? "Unknown",
            DatabaseType = project.DatabaseType ?? "Not detected",
            AuthSystem = project.AuthSystem ?? "Not detected",
            SemanticSummary = project.SemanticSummary,
            ScanFingerprint = project.ScanFingerprint,
            ArchitectureRules = project.ArchitectureRules.Select(r => new ArchitectureRuleDto
            {
                Id = r.Id,
                Name = r.Name,
                Pattern = r.Pattern,
                Description = r.Description,
                FolderPath = r.FolderPath,
                IsActive = r.IsActive,
                RuleType = r.RuleType,
                Severity = r.Severity,
                Language = r.Language,
                AutoFixSuggestion = r.AutoFixSuggestion,
                CreatedAt = r.CreatedAt
            }).ToList(),
            CodingConventions = project.CodingConventions.Select(c => new CodingConventionDto
            {
                Id = c.Id,
                Name = c.Name,
                Rule = c.Rule,
                Example = c.Example,
                Language = c.Language,
                IsActive = c.IsActive,
                CreatedAt = c.CreatedAt
            }).ToList(),
            SystemDecisions = project.SystemDecisions.Select(d => new SystemDecisionDto
            {
                Id = d.Id,
                Title = d.Title,
                Decision = d.Decision,
                Reasoning = d.Reasoning,
                Category = d.Category,
                DecisionDate = d.DecisionDate
            }).ToList(),
            FolderStructure = folderStructure,
            Metrics = new ProjectMetricsDto
            {
                FilesCount = scanData?.FilesCount ?? 0,
                LinesOfCode = scanData?.LinesOfCode ?? 0,
                FoldersCount = scanData?.FoldersCount ?? 0,
                FileExtensions = scanData?.FileExtensions ?? new(),
                TotalSizeBytes = scanData?.TotalSizeBytes ?? 0,
                Dependencies = scanData?.Dependencies ?? new(),
                LargestFiles = scanData?.LargestFiles,
                RecentlyModifiedFiles = scanData?.RecentlyModifiedFiles,
                IgnoredPaths = scanData?.IgnoredPaths,
                TechStack = scanData?.TechStack,
                ImportantFiles = scanData?.ImportantFiles,
                ModuleMap = scanData?.ModuleMap,
                ArchitectureSummary = scanData?.ArchitectureSummary,
                RouteMap = scanData?.RouteMap,
                ServiceGraph = scanData?.ServiceGraph,
                EntityMap = scanData?.EntityMap,
                DtoMap = scanData?.DtoMap,
                AiProviderMap = scanData?.AiProviderMap,
                PlanEnforcementMap = scanData?.PlanEnforcementMap,
                ExtensionExportMap = scanData?.ExtensionExportMap,
                TestBuildMap = scanData?.TestBuildMap
            },
            LastScanDate = lastScan?.ScanDate ?? DateTime.MinValue
        };
    }

    public async Task SaveScanResultAsync(ScanResult scanResult, string? userId = null, string? name = null)
    {
        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Path == scanResult.ProjectPath
                && (userId == null || p.UserId == userId));

        var isNewProject = project == null;

        var fingerprint = SemanticAnalysisService.BuildScanFingerprint(scanResult);
        var semanticSummary = SemanticAnalysisService.BuildSemanticSummary(scanResult);
        var semanticIndexJson = SemanticAnalysisService.BuildSemanticIndex(scanResult);
        var embeddingVectorJson = SemanticAnalysisService.BuildEmbeddingVectorJson($"{semanticSummary} {semanticIndexJson}");
        var isUnchanged = !isNewProject && project?.ScanFingerprint == fingerprint;

        if (project == null)
        {
            project = new Project
            {
                Name = name ?? Path.GetFileName(scanResult.ProjectPath),
                Path = scanResult.ProjectPath,
                Framework = scanResult.Framework,
                ArchitectureType = scanResult.ArchitectureType,
                DatabaseType = scanResult.DatabaseType,
                AuthSystem = scanResult.AuthSystem,
                ScanFingerprint = fingerprint,
                SemanticSummary = semanticSummary,
                SemanticIndexJson = semanticIndexJson,
                EmbeddingVectorJson = embeddingVectorJson,
                UserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Projects.Add(project);
        }
        else
        {
            project.Framework = scanResult.Framework;
            project.ArchitectureType = scanResult.ArchitectureType;
            project.DatabaseType = scanResult.DatabaseType;
            project.AuthSystem = scanResult.AuthSystem;
            project.ScanFingerprint = fingerprint;
            project.SemanticSummary = semanticSummary;
            project.SemanticIndexJson = semanticIndexJson;
            project.EmbeddingVectorJson = embeddingVectorJson;
            if (userId != null) project.UserId = userId;
            if (name != null) project.Name = name;
            project.UpdatedAt = DateTime.UtcNow;
        }

        if (!isUnchanged)
        {
            var projectScan = new ProjectScan
            {
                ScanDate = DateTime.UtcNow,
                ScanData = JsonSerializer.Serialize(scanResult.Metrics),
                FolderStructureJson = JsonSerializer.Serialize(scanResult.FolderStructure ?? new List<string>()),
                Framework = scanResult.Framework,
                ArchitectureType = scanResult.ArchitectureType,
                ScanFingerprint = fingerprint,
                SemanticSummary = semanticSummary,
                FilesCount = scanResult.Metrics.FilesCount,
                LinesOfCode = scanResult.Metrics.LinesOfCode,
                AddedFilesCount = scanResult.AddedFiles,
                ModifiedFilesCount = scanResult.ModifiedFiles,
                DeletedFilesCount = scanResult.DeletedFiles,
                IsIncrementalScan = scanResult.IsIncremental,
                ChangedFilesJson = scanResult.ChangedFiles != null ? JsonSerializer.Serialize(scanResult.ChangedFiles) : null,
                Project = project
            };

            _context.ProjectScans.Add(projectScan);
        }

        // Add default architecture rules if this is a new project (check if Id is empty/null)
        if (isNewProject)
        {
            await AddDefaultArchitectureRules(project, scanResult);
            await AddDefaultCodingConventions(project, scanResult);
        }

        await _context.SaveChangesAsync();
    }

    public async Task UpdateProjectMemoryAsync(UpdateMemoryRequest request, string? userId = null)
    {
        var project = await FindProjectAsync(request.ProjectPath, userId);

        if (project == null)
        {
            throw new InvalidOperationException($"Project not found: {request.ProjectPath}");
        }

        if (!string.IsNullOrEmpty(request.ArchitectureRule))
        {
            await AddArchitectureRuleAsync(request.ProjectPath, request.ArchitectureRule, userId: userId);
        }

        if (!string.IsNullOrEmpty(request.CodingConvention))
        {
            await AddCodingConventionAsync(request.ProjectPath, request.CodingConvention, userId: userId);
        }

        if (!string.IsNullOrEmpty(request.SystemDecision))
        {
            await AddSystemDecisionAsync(request.ProjectPath, "User Decision", request.SystemDecision, userId: userId);
        }

        project.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task AddArchitectureRuleAsync(string projectPath, string rule, string? description = null, string? userId = null)
    {
        var project = await FindProjectAsync(projectPath, userId)
            ?? throw new InvalidOperationException($"Project not found: {projectPath}");

        var architectureRule = new ArchitectureRule
        {
            Name = $"Rule {project.ArchitectureRules.Count + 1}",
            Pattern = rule,
            Description = description,
            Project = project
        };

        _context.ArchitectureRules.Add(architectureRule);
        await _context.SaveChangesAsync();
    }

    public async Task AddCodingConventionAsync(string projectPath, string convention, string? example = null, string? userId = null)
    {
        var project = await FindProjectAsync(projectPath, userId)
            ?? throw new InvalidOperationException($"Project not found: {projectPath}");

        var codingConvention = new CodingConvention
        {
            Name = $"Convention {project.CodingConventions.Count + 1}",
            Rule = convention,
            Example = example,
            Project = project
        };

        _context.CodingConventions.Add(codingConvention);
        await _context.SaveChangesAsync();
    }

    public async Task AddSystemDecisionAsync(string projectPath, string title, string decision, string? reasoning = null, string? userId = null)
    {
        var project = await FindProjectAsync(projectPath, userId)
            ?? throw new InvalidOperationException($"Project not found: {projectPath}");

        var systemDecision = new SystemDecision
        {
            Title = title,
            Decision = decision,
            Reasoning = reasoning,
            Project = project
        };

        _context.SystemDecisions.Add(systemDecision);
        await _context.SaveChangesAsync();
    }

    public async Task<List<ArchitectureRuleDto>> GetArchitectureRulesAsync(string projectPath, string? userId = null)
    {
        var query = _context.Projects
            .Include(p => p.ArchitectureRules)
            .AsQueryable();

        query = string.IsNullOrEmpty(userId)
            ? query.Where(p => p.Path == projectPath && p.UserId == null)
            : query.Where(p => p.Path == projectPath && p.UserId == userId);

        var project = await query.FirstOrDefaultAsync();

        return project?.ArchitectureRules
            .Where(r => r.IsActive)
            .Select(r => new ArchitectureRuleDto
            {
                Id = r.Id,
                Name = r.Name,
                Pattern = r.Pattern,
                Description = r.Description,
                FolderPath = r.FolderPath,
                IsActive = r.IsActive,
                RuleType = r.RuleType,
                Severity = r.Severity,
                Language = r.Language,
                AutoFixSuggestion = r.AutoFixSuggestion,
                CreatedAt = r.CreatedAt
            }).ToList() ?? new List<ArchitectureRuleDto>();
    }

    public async Task<List<CodingConventionDto>> GetCodingConventionsAsync(string projectPath, string? userId = null)
    {
        var query = _context.Projects
            .Include(p => p.CodingConventions)
            .AsQueryable();

        query = string.IsNullOrEmpty(userId)
            ? query.Where(p => p.Path == projectPath && p.UserId == null)
            : query.Where(p => p.Path == projectPath && p.UserId == userId);

        var project = await query.FirstOrDefaultAsync();

        return project?.CodingConventions
            .Where(c => c.IsActive)
            .Select(c => new CodingConventionDto
            {
                Id = c.Id,
                Name = c.Name,
                Rule = c.Rule,
                Example = c.Example,
                Language = c.Language,
                IsActive = c.IsActive,
                CreatedAt = c.CreatedAt
            }).ToList() ?? new List<CodingConventionDto>();
    }

    public async Task<List<SystemDecisionDto>> GetSystemDecisionsAsync(string projectPath, string? userId = null)
    {
        var query = _context.Projects
            .Include(p => p.SystemDecisions)
            .AsQueryable();

        query = string.IsNullOrEmpty(userId)
            ? query.Where(p => p.Path == projectPath && p.UserId == null)
            : query.Where(p => p.Path == projectPath && p.UserId == userId);

        var project = await query.FirstOrDefaultAsync();

        return project?.SystemDecisions
            .Select(d => new SystemDecisionDto
            {
                Id = d.Id,
                Title = d.Title,
                Decision = d.Decision,
                Reasoning = d.Reasoning,
                Category = d.Category,
                DecisionDate = d.DecisionDate
            }).OrderByDescending(d => d.DecisionDate).ToList() ?? new List<SystemDecisionDto>();
    }

    private async Task AddDefaultArchitectureRules(Project project, ScanResult scanResult)
    {
        var defaultRules = GetDefaultRulesForFramework(scanResult.Framework, scanResult.ArchitectureType);

        foreach (var rule in defaultRules)
        {
            var architectureRule = new ArchitectureRule
            {
                Name = rule.Name,
                Pattern = rule.Pattern,
                Description = rule.Description,
                FolderPath = rule.FolderPath,
                Project = project
            };

            _context.ArchitectureRules.Add(architectureRule);
        }
    }

    private async Task AddDefaultCodingConventions(Project project, ScanResult scanResult)
    {
        var defaultConventions = GetDefaultConventionsForFramework(scanResult.Framework);

        foreach (var convention in defaultConventions)
        {
            var codingConvention = new CodingConvention
            {
                Name = convention.Name,
                Rule = convention.Rule,
                Example = convention.Example,
                Language = convention.Language,
                Project = project
            };

            _context.CodingConventions.Add(codingConvention);
        }
    }

    private List<(string Name, string Pattern, string? Description, string? FolderPath)> GetDefaultRulesForFramework(string framework, string architecture)
    {
        var rules = new List<(string, string, string?, string?)>();

        if (framework.Contains("React"))
        {
            rules.Add(("Component Structure", "Components should be in components folder", "Keep all React components organized", "src/components"));
            rules.Add(("State Management", "Use hooks for local state, context for global", "Prefer hooks over class components", null));
        }
        else if (framework.Contains(".NET"))
        {
            rules.Add(("Repository Pattern", "Data access through repositories", "Separate business logic from data access", "src/Repositories"));
            rules.Add(("Dependency Injection", "Use DI container", "Register services in Program.cs", null));
        }
        else if (framework.Contains("Node.js"))
        {
            rules.Add(("Middleware Pattern", "Use Express middleware", "Structure middleware in separate files", "src/middleware"));
            rules.Add(("Route Organization", "Separate route files", "Keep routes in routes folder", "src/routes"));
        }

        if (architecture.Contains("Clean"))
        {
            rules.Add(("Domain Layer", "Business logic in Domain layer", "Core business rules", "src/Domain"));
            rules.Add(("Application Layer", "Use cases in Application layer", "Application orchestration", "src/Application"));
        }

        return rules;
    }

    private List<(string Name, string Rule, string? Example, string? Language)> GetDefaultConventionsForFramework(string framework)
    {
        var conventions = new List<(string, string, string?, string?)>();

        if (framework.Contains("React"))
        {
            conventions.Add(("Component Naming", "Use PascalCase for components", "const MyComponent = () => {}", "javascript"));
            conventions.Add(("File Naming", "Use PascalCase for component files", "MyComponent.jsx", "javascript"));
        }
        else if (framework.Contains(".NET"))
        {
            conventions.Add(("Class Naming", "Use PascalCase for classes", "public class UserService {}", "csharp"));
            conventions.Add(("Method Naming", "Use PascalCase for methods", "public void GetUserById() {}", "csharp"));
        }
        else if (framework.Contains("Node.js"))
        {
            conventions.Add(("Variable Naming", "Use camelCase for variables", "const userName = 'john'", "javascript"));
            conventions.Add(("File Naming", "Use kebab-case for files", "user-service.js", "javascript"));
        }

        return conventions;
    }

    private async Task<Project?> FindProjectAsync(string projectPath, string? userId)
    {
        var query = _context.Projects.AsQueryable();
        return string.IsNullOrEmpty(userId)
            ? await query.FirstOrDefaultAsync(p => p.Path == projectPath && p.UserId == null)
            : await query.FirstOrDefaultAsync(p => p.Path == projectPath && p.UserId == userId);
    }

}
