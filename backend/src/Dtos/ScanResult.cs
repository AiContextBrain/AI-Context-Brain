namespace AiContextBrain.Dtos;

public class ScanResult
{
    public string ProjectPath { get; set; } = string.Empty;
    public string Framework { get; set; } = string.Empty;
    public string ArchitectureType { get; set; } = string.Empty;
    public string DatabaseType { get; set; } = string.Empty;
    public string AuthSystem { get; set; } = string.Empty;
    public List<string> FolderStructure { get; set; } = new();
    public ProjectMetrics Metrics { get; set; } = new();
    public List<string> DetectedPatterns { get; set; } = new();
    public Dictionary<string, object> RawData { get; set; } = new();
    public bool IsIncremental { get; set; }
    public int AddedFiles { get; set; }
    public int ModifiedFiles { get; set; }
    public int DeletedFiles { get; set; }
    public List<string>? ChangedFiles { get; set; }
}

public class ProjectMetrics
{
    public int FilesCount { get; set; }
    public int LinesOfCode { get; set; }
    public int FoldersCount { get; set; }
    public Dictionary<string, int> FileExtensions { get; set; } = new();
    public long TotalSizeBytes { get; set; }
    public List<string> Dependencies { get; set; } = new();

    // Advanced context properties
    public List<FileMetric>? LargestFiles { get; set; }
    public List<FileMetric>? RecentlyModifiedFiles { get; set; }
    public List<string>? IgnoredPaths { get; set; }
    public TechStackDetails? TechStack { get; set; }
    public List<ImportantFileDetails>? ImportantFiles { get; set; }
    public List<ModuleDetails>? ModuleMap { get; set; }
    public ArchitectureSummaryDetails? ArchitectureSummary { get; set; }

    // Pro/Team architecture-aware maps
    public List<RouteEndpointDetails>? RouteMap { get; set; }
    public List<ServiceNodeDetails>? ServiceGraph { get; set; }
    public List<EntityDetails>? EntityMap { get; set; }
    public List<DtoDetails>? DtoMap { get; set; }
    public List<AiProviderDetails>? AiProviderMap { get; set; }
    public List<PlanEnforcementDetails>? PlanEnforcementMap { get; set; }
    public List<ExtensionExportDetails>? ExtensionExportMap { get; set; }
    public List<TestBuildDetails>? TestBuildMap { get; set; }
    public WizardScaffoldOptions? WizardScaffold { get; set; }
}

public class WizardScaffoldOptions
{
    public List<string> Platforms { get; set; } = new();
    public List<string> ProductTypes { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public List<string> Databases { get; set; } = new();
    public List<string> Auths { get; set; } = new();
    public List<string> Deployments { get; set; } = new();
    public List<string> Billings { get; set; } = new();
    public List<string> Automations { get; set; } = new();
    public List<string> Locales { get; set; } = new();
}

public class FileMetric
{
    public string Path { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public int Lines { get; set; }
    public DateTime? LastModified { get; set; }
}

public class TechStackDetails
{
    public DetectedTech? Frontend { get; set; }
    public DetectedTech? Backend { get; set; }
    public DetectedTech? Database { get; set; }
    public DetectedTech? Auth { get; set; }
    public DetectedTech? Orm { get; set; }
    public DetectedTech? PackageManager { get; set; }
    public DetectedTech? Deployment { get; set; }
    public DetectedTech? Monorepo { get; set; }
    public List<DetectedTech>? AiProviders { get; set; }
}

public class DetectedTech
{
    public string Name { get; set; } = string.Empty;
    public double Confidence { get; set; } // 0.0 to 1.0
}

public class ImportantFileDetails
{
    public string Path { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // EntryPoint, Config, Controller, Service, Model, Auth, UI, Env, Doc
    public string Importance { get; set; } = string.Empty; // Why it matters
    public string AiBehavior { get; set; } = string.Empty; // Suggested AI behavior when editing
}

public class ModuleDetails
{
    public string Name { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
    public List<string> KeyFiles { get; set; } = new();
    public List<string> Dependencies { get; set; } = new();
    public string Status { get; set; } = "Active";
    public string RiskLevel { get; set; } = "Medium";
    public string EditingGuidance { get; set; } = string.Empty;
}

public class ArchitectureSummaryDetails
{
    public string Style { get; set; } = "Standard";
    public string DataFlowDescription { get; set; } = string.Empty;
    public string BusinessLogicLocation { get; set; } = string.Empty;
    public string UiLogicLocation { get; set; } = string.Empty;
    public string ApiLogicLocation { get; set; } = string.Empty;
    public string ConfigLocation { get; set; } = string.Empty;
}

// ── Pro/Team Architecture-Aware Detail Classes ──

public class RouteEndpointDetails
{
    public string HttpMethod { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public string Controller { get; set; } = string.Empty;
    public string? AuthRequirement { get; set; }
    public string Purpose { get; set; } = string.Empty;
}

public class ServiceNodeDetails
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public List<string> DependsOn { get; set; } = new();
    public string Purpose { get; set; } = string.Empty;
}

public class EntityDetails
{
    public string Name { get; set; } = string.Empty;
    public string? TablePurpose { get; set; }
    public List<string> Relationships { get; set; } = new();
    public string Path { get; set; } = string.Empty;
}

public class DtoDetails
{
    public string Name { get; set; } = string.Empty;
    public string? UsedBy { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
}

public class AiProviderDetails
{
    public string ProviderName { get; set; } = string.Empty;
    public List<string> EnvVarNames { get; set; } = new();
    public int? FallbackOrder { get; set; }
    public string Path { get; set; } = string.Empty;
}

public class PlanEnforcementDetails
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // Limit, Counter, Gate
    public string? Value { get; set; }
    public string Path { get; set; } = string.Empty;
}

public class ExtensionExportDetails
{
    public string TargetEditor { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class TestBuildDetails
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // Test, Build, Compile
    public string Command { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
}
