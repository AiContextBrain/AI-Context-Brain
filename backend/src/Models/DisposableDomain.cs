namespace AiContextBrain.Models;

public class DisposableDomain
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Domain { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
