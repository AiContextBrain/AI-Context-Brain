namespace AiContextBrain.Dtos;

public class ProjectMemoryDto
{
    public string Name { get; set; } = string.Empty;
    public string ProjectPath { get; set; } = string.Empty;
    public string Framework { get; set; } = string.Empty;
    public string ArchitectureType { get; set; } = string.Empty;
    public string DatabaseType { get; set; } = string.Empty;
    public string AuthSystem { get; set; } = string.Empty;
    public string? SemanticSummary { get; set; }
    public string? ScanFingerprint { get; set; }
    public List<string> FolderStructure { get; set; } = new();
    public List<ArchitectureRuleDto> ArchitectureRules { get; set; } = new();
    public List<CodingConventionDto> CodingConventions { get; set; } = new();
    public List<SystemDecisionDto> SystemDecisions { get; set; } = new();
    public ProjectMetricsDto Metrics { get; set; } = new();
    public DateTime LastScanDate { get; set; }
}

public class ArchitectureRuleDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Pattern { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? FolderPath { get; set; }
    public bool IsActive { get; set; }
    public string RuleType { get; set; } = "Regex";
    public string Severity { get; set; } = "Warning";
    public string? Language { get; set; }
    public string? AutoFixSuggestion { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CodingConventionDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Pattern { get; set; } = string.Empty;
    public string Rule { get; set; } = string.Empty;
    public string? Example { get; set; }
    public string? Language { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SystemDecisionDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public string? Reasoning { get; set; }
    public string? Category { get; set; }
    public DateTime DecisionDate { get; set; }
}

public class ProjectMetricsDto
{
    public int FilesCount { get; set; }
    public int LinesOfCode { get; set; }
    public int FoldersCount { get; set; }
    public Dictionary<string, int> FileExtensions { get; set; } = new();
    public long TotalSizeBytes { get; set; }
    public List<string> Dependencies { get; set; } = new();
    public int ComplexityScore { get; set; }

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
}
