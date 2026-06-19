using AiContextBrain.Dtos;
using AiContextBrain.Models;

namespace AiContextBrain.Services;

public interface IContextGenerator
{
    Task<string> GenerateContextAsync(string projectPath, int maxTokens = 8000, string? userId = null, UserPlan? plan = null);
    Task<string> GenerateCompressedContextAsync(string projectPath, string? userId = null);
    Task<string> GenerateArchitectureContextAsync(string projectPath, string? userId = null);
    Task<string> GenerateCodingContextAsync(string projectPath, string? userId = null);
    Task<string> GenerateAiInstructionsAsync(string projectPath, string? userId = null);
    Task<string> PreviewContextAsync(string projectPath, int maxTokens, string? userId = null, UserPlan? plan = null);
    ContextQualityReport CalculateQualityScore(ProjectMemoryDto? memory);
    DetectionConfidence CalculateDetectionConfidence(ProjectMemoryDto? memory);
}
