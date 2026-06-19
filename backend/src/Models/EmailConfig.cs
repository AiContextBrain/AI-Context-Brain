namespace AiContextBrain.Models;

public class EmailConfig
{
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public int TimeoutMs { get; set; } = 30000;
    public string WebBaseUrl { get; set; } = "https://aicontextbrain.me";
    public string? ResendApiKey { get; set; }
}
