namespace AiContextBrain.Models;

public class FrameworkPattern
{
    // PostgreSQL: Use string (UUID) for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string DetectionRules { get; set; } = string.Empty;
    public string FolderStructure { get; set; } = string.Empty;
    public string? CommonDependencies { get; set; }
    public string? TypicalCommands { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
