using AiContextBrain.Dtos;

namespace AiContextBrain.Services;

public interface IProjectMemoryService
{
    Task<ProjectMemoryDto?> GetProjectMemoryAsync(string projectPath, string? userId = null);
    Task SaveScanResultAsync(ScanResult scanResult, string? userId = null, string? name = null);
    Task UpdateProjectMemoryAsync(UpdateMemoryRequest request, string? userId = null);
    Task AddArchitectureRuleAsync(string projectPath, string rule, string? description = null, string? userId = null);
    Task AddCodingConventionAsync(string projectPath, string convention, string? example = null, string? userId = null);
    Task AddSystemDecisionAsync(string projectPath, string title, string decision, string? reasoning = null, string? userId = null);
    Task<List<ArchitectureRuleDto>> GetArchitectureRulesAsync(string projectPath, string? userId = null);
    Task<List<CodingConventionDto>> GetCodingConventionsAsync(string projectPath, string? userId = null);
    Task<List<SystemDecisionDto>> GetSystemDecisionsAsync(string projectPath, string? userId = null);
}
