using System;

namespace AiContextBrain.Models;

public class Feedback
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public int Rating { get; set; } = 5;
    public string Category { get; set; } = "general"; // general, bug, feature, speed, usability
    public string Status { get; set; } = "new"; // new, reviewed, resolved, wontfix
    public string Priority { get; set; } = "normal"; // low, normal, high, critical
    public string? AdminNote { get; set; }
    public string? RelatedFeature { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public User? User { get; set; }
}
