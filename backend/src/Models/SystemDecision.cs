namespace AiContextBrain.Models;

public class SystemDecision
{
    // PostgreSQL: Use string (UUID) for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public string? Reasoning { get; set; }
    public string? Category { get; set; }
    public DateTime DecisionDate { get; set; } = DateTime.UtcNow;
    public string ProjectId { get; set; } = string.Empty;

    // Navigation property
    public Project? Project { get; set; }
}
