// ============================================
// SaaS: AIContext Model for PostgreSQL
// ============================================
namespace AiContextBrain.Models;

public class AIContext
{
    // PostgreSQL: Use string (UUID) for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    // Foreign key to Project
    public string ProjectId { get; set; } = string.Empty;
    
    // Content stored as TEXT (can be JSON or plain text)
    public string Content { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public Project? Project { get; set; }
}
