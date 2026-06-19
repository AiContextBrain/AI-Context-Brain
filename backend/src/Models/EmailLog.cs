namespace AiContextBrain.Models;

public class EmailLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? UserId { get; set; }
    public string RecipientEmail { get; set; } = string.Empty;
    public string EmailType { get; set; } = string.Empty; // verification, password_reset, welcome, billing, security_alert, admin_test
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = "sent"; // sent, failed
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
