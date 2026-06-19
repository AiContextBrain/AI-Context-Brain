namespace AiContextBrain.Models;

public class ArchitectureRule
{
    // PostgreSQL: Use string (UUID) for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Pattern { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? FolderPath { get; set; }
    public bool IsActive { get; set; } = true;
    public string RuleType { get; set; } = "Regex";
    public string Severity { get; set; } = "Warning";
    public string? Language { get; set; }
    public string? AutoFixSuggestion { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string ProjectId { get; set; } = string.Empty;

    // Navigation property
    public Project? Project { get; set; }
}
