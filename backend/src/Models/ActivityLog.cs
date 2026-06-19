namespace AiContextBrain.Models;

public class ActivityLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string? ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // "scan", "generate_context", "export_ide", "update_memory"
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
