// ============================================
// Context Quality Report DTOs
// Structured quality scoring for AI context
// ============================================
namespace AiContextBrain.Dtos;

public class ContextQualityReport
{
    public int Overall { get; set; }
    public Dictionary<string, CategoryScore> Scores { get; set; } = new();
    public List<string> Unknowns { get; set; } = new();
    public List<string> Strengths { get; set; } = new();
}

public class CategoryScore
{
    public int Score { get; set; }
    public string Status { get; set; } = "unknown"; // excellent, good, fair, poor, unknown
    public string? Detail { get; set; }
}

public class ContextValidationResult
{
    public bool IsValid { get; set; } = true;
    public List<string> Warnings { get; set; } = new();
    public int SectionCount { get; set; }
    public int TokensUsed { get; set; }
    public double TokenUtilization { get; set; } // 0.0 - 1.0
}

public class DetectionConfidence
{
    public int Framework { get; set; }
    public int Architecture { get; set; }
    public int Dependencies { get; set; }
    public int Database { get; set; }
    public int Authentication { get; set; }
    public int Modules { get; set; }
    public int AiReadiness { get; set; }
    public List<string> LowConfidenceWarnings { get; set; } = new();
}
