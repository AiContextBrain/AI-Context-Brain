namespace AiContextBrain.Dtos;

public class ScanRequest
{
    public string ProjectPath { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string? Name { get; set; }
    public string? Framework { get; set; }
    public string? ArchitectureType { get; set; }
    public string? DatabaseType { get; set; }
    public string? AuthSystem { get; set; }
    public List<string>? FolderStructure { get; set; }
    public List<string>? DetectedPatterns { get; set; }
    public ScanRequestMetrics? Metrics { get; set; }
    public bool IsIncremental { get; set; }
    public bool IsBackgroundSync { get; set; }
    public int AddedFiles { get; set; }
    public int ModifiedFiles { get; set; }
    public int DeletedFiles { get; set; }
    public List<string>? ChangedFiles { get; set; }
}

public class ScanRequestMetrics
{
    public int FilesCount { get; set; }
    public int LinesOfCode { get; set; }
    public int FoldersCount { get; set; }
    public long TotalSizeBytes { get; set; }
    public List<string>? Dependencies { get; set; }
    public Dictionary<string, int>? FileExtensions { get; set; }

    // Advanced metrics fields
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

public class UpdateMemoryRequest
{
    public string ProjectPath { get; set; } = string.Empty;
    public string? ArchitectureRule { get; set; }
    public string? CodingConvention { get; set; }
    public string? SystemDecision { get; set; }
}

public class GenerateContextRequest
{
    public string ProjectPath { get; set; } = string.Empty;
    public int MaxTokens { get; set; } = 8000;
    public bool ForceDeterministic { get; set; } = false;
}

public class ValidateArchitectureRequest
{
    public string ProjectPath { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Violations { get; set; } = new();
}

public class CreateArchitectureRuleRequest
{
    public string ProjectPath { get; set; } = "";
    public string Name { get; set; } = "";
    public string Pattern { get; set; } = "";
    public string? Description { get; set; }
    public string? FolderPath { get; set; }
    public string RuleType { get; set; } = "Regex";
    public string Severity { get; set; } = "Warning";
    public string? Language { get; set; }
    public string? AutoFixSuggestion { get; set; }
}

public class UpdateArchitectureRuleRequest
{
    public string? Name { get; set; }
    public string? Pattern { get; set; }
    public string? Description { get; set; }
    public string? FolderPath { get; set; }
    public string? RuleType { get; set; }
    public string? Severity { get; set; }
    public string? Language { get; set; }
    public string? AutoFixSuggestion { get; set; }
    public bool? IsActive { get; set; }
}

public class SuggestFixRequest
{
    public string FilePath { get; set; } = "";
    public string? FileContent { get; set; }
    public string RuleName { get; set; } = "";
    public string RulePattern { get; set; } = "";
    public string RuleType { get; set; } = "Regex";
    public int ViolationLine { get; set; }
    public string? AutoFixSuggestion { get; set; }
}

public class FeedbackRequest
{
    public string Content { get; set; } = string.Empty;
    public int Rating { get; set; } = 5;
    public string Category { get; set; } = "general";
}

public class PlanStatusDto
{
    public string CurrentPlan { get; set; } = "Free";
    public int MaxProjects { get; set; }
    public int CurrentProjects { get; set; }
    public int MaxContextRefreshes { get; set; }
    public int UsedContextRefreshes { get; set; }
    public int RemainingContextRefreshes { get; set; }
    public int MaxAIRequests { get; set; }
    public int UsedAIRequests { get; set; }
    public int RemainingAIRequests { get; set; }
    public int MaxContextSize { get; set; }
    public int LastGeneratedContextSize { get; set; }
    public double ContextCapacityPercent { get; set; }
    public DateTime NextResetDate { get; set; }
    public bool CanGenerateContext { get; set; }
    public bool CanRefreshContext { get; set; }
    public bool CanUseAI { get; set; }
}

public class AiExplainRequest
{
    public string ProjectPath { get; set; } = "";
    public string FilePath { get; set; } = "";
    public string CodeSnippet { get; set; } = "";
    public string? SurroundingCode { get; set; }
    public string? Language { get; set; }
    public int? SelectionStartLine { get; set; }
    public int? SelectionEndLine { get; set; }
    public string? Mode { get; set; } // "quick", "deep", "review"
    public bool? ForceEscalate { get; set; }
}

public class WizardCreateRequest
{
    public string Name { get; set; } = string.Empty;
    public string ProjectPath { get; set; } = string.Empty;
    public List<string> Platforms { get; set; } = new();
    public List<string> ProductTypes { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public List<string> Databases { get; set; } = new();
    public List<string> Auths { get; set; } = new();
    public List<string> Deployments { get; set; } = new();
    public List<string> Billings { get; set; } = new();
    public List<string> Automations { get; set; } = new();
    public List<string> StrictnessLevels { get; set; } = new();
    public List<string> Locales { get; set; } = new();
}

public class InitializeProjectRequest
{
    public string ProjectPath { get; set; } = string.Empty;
}

public class InitializeLocalRequest
{
    public string LocalPath { get; set; } = string.Empty;
}
