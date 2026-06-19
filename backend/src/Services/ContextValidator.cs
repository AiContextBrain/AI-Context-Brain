// ============================================
// Context Self-Validator
// Post-generation quality checks
// ============================================
using AiContextBrain.Dtos;

namespace AiContextBrain.Services;

public class ContextValidator
{
    /// <summary>
    /// Validates generated .ai-context.md content for correctness and completeness.
    /// Never blocks generation — only reports warnings.
    /// </summary>
    public ContextValidationResult Validate(string contextMarkdown, ProjectMemoryDto? memory, int maxTokens)
    {
        var result = new ContextValidationResult();
        var warnings = new List<string>();

        if (string.IsNullOrWhiteSpace(contextMarkdown))
        {
            warnings.Add("Generated context is empty.");
            result.IsValid = false;
            result.Warnings = warnings;
            return result;
        }

        var lines = contextMarkdown.Split('\n');
        var sections = lines.Where(l => l.TrimStart().StartsWith("## ")).ToList();
        result.SectionCount = sections.Count;

        // 1. Section count validation (expect 12-13 sections)
        if (sections.Count < 8)
        {
            warnings.Add($"Only {sections.Count} sections detected. Expected at least 12. Context may be incomplete.");
        }

        // 2. Empty section detection
        for (int i = 0; i < sections.Count; i++)
        {
            var sectionStart = Array.IndexOf(lines, sections[i]);
            var sectionEnd = (i + 1 < sections.Count) 
                ? Array.IndexOf(lines, sections[i + 1]) 
                : lines.Length;
            
            var sectionContent = lines.Skip(sectionStart + 1).Take(sectionEnd - sectionStart - 1)
                .Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
            
            if (sectionContent.Count == 0)
            {
                warnings.Add($"Section '{sections[i].Trim()}' appears to be empty.");
            }
        }

        // 3. Missing architecture when it should exist
        if (memory != null)
        {
            if (memory.ArchitectureType != "Unknown" && !contextMarkdown.Contains("Architecture"))
            {
                warnings.Add("Architecture type is detected but not mentioned in context.");
            }

            if (memory.AuthSystem != "Unknown" && memory.AuthSystem != "Not detected" 
                && !contextMarkdown.Contains("Authentication", StringComparison.OrdinalIgnoreCase)
                && !contextMarkdown.Contains("Auth", StringComparison.OrdinalIgnoreCase))
            {
                warnings.Add("Authentication system is detected but not mentioned in context.");
            }

            if (memory.DatabaseType != "Unknown" && memory.DatabaseType != "Not detected"
                && !contextMarkdown.Contains("Database", StringComparison.OrdinalIgnoreCase))
            {
                warnings.Add("Database type is detected but not mentioned in context.");
            }
        }

        // 4. Duplicated line detection (exact duplicates > 2 chars long)
        var meaningfulLines = lines
            .Select(l => l.Trim())
            .Where(l => l.Length > 10 && !l.StartsWith("#") && !l.StartsWith("```") && !l.StartsWith("├") && !l.StartsWith("- Current status:") && !l.StartsWith("- Risk level:") && !l.StartsWith("- File:"))
            .ToList();
        
        var duplicates = meaningfulLines
            .GroupBy(l => l)
            .Where(g => g.Count() > 2)
            .Select(g => g.Key)
            .Take(3)
            .ToList();

        foreach (var dup in duplicates)
        {
            warnings.Add($"Duplicated content detected: \"{(dup.Length > 60 ? dup[..60] + "..." : dup)}\"");
        }

        // 5. Invalid paths
        if (contextMarkdown.Contains("`null`") || contextMarkdown.Contains("`undefined`"))
        {
            warnings.Add("Invalid file paths detected (null/undefined values in path references).");
        }

        // 6. Token utilization
        var estimatedTokens = contextMarkdown.Length / 4;
        result.TokensUsed = estimatedTokens;
        result.TokenUtilization = maxTokens > 0 ? Math.Min(1.0, (double)estimatedTokens / maxTokens) : 0;

        if (result.TokenUtilization < 0.3 && maxTokens > 2000)
        {
            warnings.Add($"Context uses {result.TokenUtilization:P0} of the available max context size. Additional architecture metadata may be available after deep scan improvements.");
        }

        // 7. Compressed/Omitted marker detection
        if (contextMarkdown.Contains("Compressed/Omitted"))
        {
            warnings.Add("Some sections were compressed due to max context size limits. Consider upgrading plan for full context.");
        }

        result.IsValid = warnings.Count == 0;
        result.Warnings = warnings;
        return result;
    }
}
