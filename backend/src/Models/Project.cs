namespace AiContextBrain.Models;

public class Project
{
    // PostgreSQL: Use string (UUID) instead of int for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    // SaaS: Foreign key to User
    public string? UserId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string? Framework { get; set; }
    public string? ArchitectureType { get; set; }
    public string? DatabaseType { get; set; }
    public string? AuthSystem { get; set; }
    public string? ScanFingerprint { get; set; }
    public string? SemanticSummary { get; set; }
    public string? SemanticIndexJson { get; set; }
    public string? EmbeddingVectorJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public bool IsLocalInitialized { get; set; } = false;

    // Navigation properties
    public User? User { get; set; }
    public ICollection<ArchitectureRule> ArchitectureRules { get; set; } = new List<ArchitectureRule>();
    public ICollection<CodingConvention> CodingConventions { get; set; } = new List<CodingConvention>();
    public ICollection<SystemDecision> SystemDecisions { get; set; } = new List<SystemDecision>();
    public ICollection<ProjectScan> Scans { get; set; } = new List<ProjectScan>();
    public ICollection<AIContext> AIContexts { get; set; } = new List<AIContext>();
}
