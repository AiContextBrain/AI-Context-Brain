using AiContextBrain.Dtos;

namespace AiContextBrain.Services;

public interface IRepositoryScanner
{
    Task<ScanResult> ScanRepositoryAsync(string projectPath);
    Task<string> DetectFrameworkAsync(string projectPath);
    Task<string> DetectArchitectureTypeAsync(string projectPath);
    Task<string> DetectDatabaseTypeAsync(string projectPath);
    Task<string> DetectAuthSystemAsync(string projectPath);
    Task<List<string>> AnalyzeFolderStructureAsync(string projectPath);
    Task<ProjectMetrics> CalculateMetricsAsync(string projectPath);
}
