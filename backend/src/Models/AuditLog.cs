namespace AiContextBrain.Models;

public class AuditLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string AdminUserId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // ban_user, unban_user, update_role, update_plan, delete_user, reset_usage, force_logout, revoke_api_key, resend_verification, update_feedback_status
    public string TargetUserId { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
