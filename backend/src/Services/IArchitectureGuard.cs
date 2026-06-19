namespace AiContextBrain.Services;

public interface IArchitectureGuard
{
    Task<List<string>> ValidateFileAsync(string projectPath, string filePath, string? userId = null);
    Task<List<string>> ValidateProjectAsync(string projectPath, string? userId = null);
    Task<bool> IsArchitectureViolationAsync(string projectPath, string filePath, string content, string? userId = null);
    Task<List<string>> GetArchitectureViolationsAsync(string projectPath, string? userId = null);
}
