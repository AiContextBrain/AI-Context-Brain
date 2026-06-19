namespace AiContextBrain.Models;

public class CodingConvention
{
    // PostgreSQL: Use string (UUID) for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Rule { get; set; } = string.Empty;
    public string? Example { get; set; }
    public string? Language { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string ProjectId { get; set; } = string.Empty;

    // Navigation property
    public Project? Project { get; set; }
}
