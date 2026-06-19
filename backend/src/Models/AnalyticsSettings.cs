namespace AiContextBrain.Models;

public class AnalyticsSettings
{
    public string Id { get; set; } = "global";
    public bool Enabled { get; set; }
    public string? GoogleAnalyticsId { get; set; }
    public string? ClarityId { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
