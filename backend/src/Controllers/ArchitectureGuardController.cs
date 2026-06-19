// ============================================
// Architecture Guard API Controller
// Real-time architectural compliance checking
// ============================================
using AiContextBrain.Data;
using AiContextBrain.Dtos;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class ArchitectureGuardController : ControllerBase
{
    private readonly IArchitectureGuard _architectureGuard;
    private readonly IProjectMemoryService _projectMemoryService;
    private readonly IHybridAIAnalysisService _aiAnalysisService;
    private readonly ApplicationDbContext _context;

    public ArchitectureGuardController(
        IArchitectureGuard architectureGuard,
        IProjectMemoryService projectMemoryService,
        IHybridAIAnalysisService aiAnalysisService,
        ApplicationDbContext context)
    {
        _architectureGuard = architectureGuard;
        _projectMemoryService = projectMemoryService;
        _aiAnalysisService = aiAnalysisService;
        _context = context;
    }

    /// <summary>
    /// Validate a single file against architectural rules
    /// </summary>
    [HttpPost("validate-file")]
    public async Task<IActionResult> ValidateFile([FromBody] ValidateFileRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }
        if (!PlanLimits.HasPriorityAI(user.Plan))
        {
            return PaidPlanRequired();
        }

        var violations = await _architectureGuard.ValidateFileAsync(request.ProjectPath, request.FilePath, user.Id);
        
        // AI-enhanced suggestions
        var suggestions = Array.Empty<ArchitectureSuggestion>();
        
        // Reset monthly counter if needed
        if (DateTime.UtcNow > user.AiResetDate)
        {
            user.AiRequestCount = 0;
            user.AiResetDate = DateTime.UtcNow.AddMonths(1);
        }
        
        var maxAiRequests = PlanLimits.EffectiveMaxAiRequests(user);
        if (user.AiRequestCount < maxAiRequests)
        {
            suggestions = await _aiAnalysisService.SuggestImprovementsAsync(
                request.ProjectPath, 
                await _projectMemoryService.GetProjectMemoryAsync(request.ProjectPath, user.Id) ?? new Dtos.ProjectMemoryDto()
            );
            user.AiRequestCount++;
            await _context.SaveChangesAsync();
        }

        return Ok(new 
        { 
            filePath = request.FilePath,
            violations,
            suggestions = suggestions.Select(s => new { s.Title, s.Description, s.Priority }),
            isCompliant = !violations.Any()
        });
    }

    /// <summary>
    /// Validate entire project
    /// </summary>
    [HttpPost("validate-project")]
    public async Task<IActionResult> ValidateProject([FromBody] ValidateProjectRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }
        if (!PlanLimits.HasPriorityAI(user.Plan))
        {
            return PaidPlanRequired();
        }

        var violations = await _architectureGuard.ValidateProjectAsync(request.ProjectPath, user.Id);
        
        return Ok(new 
        { 
            projectPath = request.ProjectPath,
            totalViolations = violations.Count,
            violations = violations,
            isCompliant = !violations.Any()
        });
    }

    /// <summary>
    /// Check if code would violate architecture before saving
    /// </summary>
    [HttpPost("check-compliance")]
    public async Task<IActionResult> CheckCompliance([FromBody] CheckComplianceRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }
        if (!PlanLimits.HasPriorityAI(user.Plan))
        {
            return PaidPlanRequired();
        }

        var violations = await _architectureGuard.ValidateFileAsync(request.ProjectPath, request.FilePath, user.Id);
        
        // Filter for the specific content we want to check
        var relevantViolations = violations.Where(v => 
            request.Content != null && v.Contains(request.Content)
        ).ToList();

        return Ok(new 
        { 
            wouldViolate = relevantViolations.Any(),
            violations = relevantViolations,
            suggestions = relevantViolations.Any() ? new[] { "Consider moving this logic to appropriate layer" } : Array.Empty<string>()
        });
    }

    /// <summary>
    /// Get AI-powered architecture suggestions
    /// </summary>
    [HttpPost("suggest-improvements")]
    public async Task<IActionResult> SuggestImprovements([FromBody] SuggestImprovementsRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }
        if (!PlanLimits.HasPriorityAI(user.Plan))
        {
            return PaidPlanRequired();
        }

        var context = await _projectMemoryService.GetProjectMemoryAsync(request.ProjectPath, user.Id);
        
        if (context == null)
        {
            return NotFound(new { error = "Project not found" });
        }

        // Reset monthly counter if needed
        if (DateTime.UtcNow > user.AiResetDate)
        {
            user.AiRequestCount = 0;
            user.AiResetDate = DateTime.UtcNow.AddMonths(1);
        }
        
        var maxAiRequests = PlanLimits.EffectiveMaxAiRequests(user);
        if (user.AiRequestCount >= maxAiRequests)
        {
            return StatusCode(429, new
            {
                error = "ai_request_limit_reached",
                message = $"You've used all {maxAiRequests} AI requests for this month on the {PlanLimits.PlanName(user.Plan)} plan.",
                plan = user.Plan.ToString(),
                limit = maxAiRequests,
                upgradeUrl = "https://aicontextbrain.me/pricing"
            });
        }

        var suggestions = await _aiAnalysisService.SuggestImprovementsAsync(request.ProjectPath, context);
        user.AiRequestCount++;
        await _context.SaveChangesAsync();

        return Ok(new 
        { 
            projectPath = request.ProjectPath,
            suggestions = suggestions.Select(s => new 
            { 
                title = s.Title, 
                description = s.Description, 
                priority = s.Priority,
                category = s.Category
            })
        });
    }

    /// <summary>
    /// Explain code using project memory context
    /// </summary>
    [HttpPost("ai-explain")]
    public async Task<IActionResult> AiExplain([FromBody] AiExplainRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var context = await _projectMemoryService.GetProjectMemoryAsync(request.ProjectPath, user.Id);
        if (context == null)
        {
            return NotFound(new { error = "Project not found" });
        }

        // Determine Mode: quick, deep, review
        var mode = (request.Mode ?? "").Trim().ToLowerInvariant();
        if (mode != "quick" && mode != "deep" && mode != "review")
        {
            mode = user.Plan == UserPlan.Free ? "quick" : "deep";
        }

        // Enforce Plan Limits
        if (mode == "deep" && !PlanLimits.CanUseDeepExplain(user.Plan))
        {
            return StatusCode(403, new
            {
                error = "deep_explain_requires_pro_plan",
                message = "Deep Explain requires a Pro or Team plan to analyze project architecture relationships.",
                upgradeUrl = "https://aicontextbrain.me/pricing"
            });
        }
        if (mode == "review" && !PlanLimits.CanUseReviewExplain(user.Plan))
        {
            return StatusCode(403, new
            {
                error = "review_explain_requires_team_plan",
                message = "Deep Explain + Review requires a Team plan to perform security, SOLID, and code smell reviews.",
                upgradeUrl = "https://aicontextbrain.me/pricing"
            });
        }

        // Execution Level 2, 3, 4: Deterministic Project Memory Fallback
        if (mode == "quick" && !request.ForceEscalate.GetValueOrDefault())
        {
            var deterministicResponse = TryGetDeterministicExplanation(context, request.FilePath, request.CodeSnippet);
            if (deterministicResponse != null)
            {
                return Ok(new
                {
                    explanation = deterministicResponse,
                    plan = PlanLimits.PlanName(user.Plan),
                    used = user.AiRequestCount,
                    limit = PlanLimits.EffectiveMaxAiRequests(user),
                    source = "deterministic-metadata",
                    confidence = 95
                });
            }
        }

        // Reset monthly counter if needed
        if (DateTime.UtcNow > user.AiResetDate)
        {
            user.AiRequestCount = 0;
            user.AiResetDate = DateTime.UtcNow.AddMonths(1);
        }
        
        var maxAiRequests = PlanLimits.EffectiveMaxAiRequests(user);
        if (user.AiRequestCount >= maxAiRequests)
        {
            return StatusCode(429, new
            {
                error = "ai_request_limit_reached",
                message = $"You've used all {maxAiRequests} AI requests for this month on the {PlanLimits.PlanName(user.Plan)} plan.",
                plan = user.Plan.ToString(),
                limit = maxAiRequests,
                upgradeUrl = "https://aicontextbrain.me/pricing"
            });
        }

        var language = ResolveLanguage(request.Language, request.FilePath);
        var projectContext = BuildAiExplainContext(context, request, user);
        var explanation = await _aiAnalysisService.ExplainCodeAsync(
            request.CodeSnippet,
            language,
            projectContext,
            request.FilePath,
            mode,
            context.ScanFingerprint ?? "unknown");

        user.AiRequestCount++;
        await _context.SaveChangesAsync();

        // Infer confidence based on mode
        int confidence = mode == "quick" ? 85 : (mode == "deep" ? 92 : 97);

        return Ok(new
        {
            explanation,
            plan = PlanLimits.PlanName(user.Plan),
            used = user.AiRequestCount,
            limit = maxAiRequests,
            source = "hybrid-ai",
            confidence
        });
    }

    /// <summary>
    /// Suggest dynamic fix for a specific architecture violation
    /// </summary>
    [HttpPost("suggest-fix")]
    public async Task<IActionResult> SuggestFix([FromBody] SuggestFixRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }
        if (!PlanLimits.HasPriorityAI(user.Plan))
        {
            return PaidPlanRequired();
        }

        // AI request limit enforcement
        if (DateTime.UtcNow > user.AiResetDate)
        {
            user.AiRequestCount = 0;
            user.AiResetDate = DateTime.UtcNow.AddMonths(1);
        }
        var maxAiRequests = PlanLimits.EffectiveMaxAiRequests(user);
        if (user.AiRequestCount >= maxAiRequests)
        {
            return StatusCode(429, new
            {
                error = "ai_request_limit_reached",
                message = $"You've used all {maxAiRequests} AI requests for this month on the {PlanLimits.PlanName(user.Plan)} plan.",
                plan = user.Plan.ToString(),
                used = user.AiRequestCount,
                limit = maxAiRequests,
                resetDate = user.AiResetDate,
                upgradeUrl = "https://aicontextbrain.me/pricing"
            });
        }

        var suggestion = request.AutoFixSuggestion;
        var fixedContent = string.Empty;
        var explanation = string.Empty;

        switch (request.RuleType)
        {
            case "ContentForbidden":
                explanation = $"Yasaklı '{request.RulePattern}' ifadesi tespit edildi. Bu ifadeyi kaldırmak veya devre dışı bırakmak gerekiyor.";
                suggestion = string.IsNullOrEmpty(suggestion) 
                    ? $"// {request.RulePattern} satırını kaldırın veya yorum satırı yapın." 
                    : suggestion;
                break;

            case "NamingConvention":
                var ext = Path.GetExtension(request.FilePath);
                var filename = Path.GetFileNameWithoutExtension(request.FilePath);
                var correctedName = filename;
                if (!string.IsNullOrEmpty(filename) && (request.RulePattern.Contains("PascalCase") || request.RulePattern.Contains("[A-Z]")))
                {
                    correctedName = char.ToUpper(filename[0]) + filename.Substring(1);
                }
                explanation = $"'{request.FilePath}' dosya adı tanımlanan '{request.RulePattern}' kuralına uymuyor.";
                suggestion = string.IsNullOrEmpty(suggestion)
                    ? $"Dosya adını '{correctedName}{ext}' olarak değiştirin ve sınıf adını buna göre güncelleyin."
                    : suggestion;
                break;

            case "FolderRestriction":
                explanation = $"Dosya '{request.FilePath}' kural gereği beklenen hedef klasörün dışında yer alıyor.";
                suggestion = string.IsNullOrEmpty(suggestion)
                    ? $"Dosyayı ilgili hedef klasöre taşıyın."
                    : suggestion;
                break;

            case "FileSizeLimit":
                explanation = $"Dosya boyutu kuralda belirtilen '{request.RulePattern}' satır limitini aşıyor.";
                suggestion = string.IsNullOrEmpty(suggestion)
                    ? "Sınıf veya modülü daha küçük, tek sorumluluk prensibine (Single Responsibility) uygun alt parçalara bölün."
                    : suggestion;
                break;

            default:
                explanation = $"'{request.RuleName}' mimari kuralı ihlal edildi.";
                suggestion = string.IsNullOrEmpty(suggestion)
                    ? $"Mimaride tanımlanan kural gereksinimlerini ({request.RulePattern}) uygulayın."
                    : suggestion;
                break;
        }

        user.AiRequestCount++;
        await _context.SaveChangesAsync();

        return Ok(new { suggestion, fixedContent, explanation });
    }

    private static string BuildAiExplainContext(ProjectMemoryDto memory, AiExplainRequest request, User user)
    {
        var sb = new StringBuilder();
        var filePath = NormalizePath(request.FilePath);
        var metrics = memory.Metrics;

        // Determine effective mode
        var mode = (request.Mode ?? "").Trim().ToLowerInvariant();
        if (mode != "quick" && mode != "deep" && mode != "review")
        {
            mode = user.Plan == UserPlan.Free ? "quick" : "deep";
        }

        sb.AppendLine("Project memory snapshot:");
        AppendValue(sb, "Name", memory.Name);
        AppendValue(sb, "Framework", memory.Framework);
        AppendValue(sb, "Architecture", memory.ArchitectureType);
        AppendValue(sb, "Database", memory.DatabaseType);
        AppendValue(sb, "Authentication", memory.AuthSystem);
        AppendValue(sb, "Semantic summary", memory.SemanticSummary);
        sb.AppendLine($"- User plan: {PlanLimits.PlanName(user.Plan)}");
        sb.AppendLine($"- AI Explain access: enabled for this plan");
        if (request.SelectionStartLine.HasValue)
        {
            sb.AppendLine($"- Selected range: {request.SelectionStartLine}-{request.SelectionEndLine ?? request.SelectionStartLine}");
        }

        if (metrics.ArchitectureSummary != null)
        {
            sb.AppendLine();
            sb.AppendLine("Architecture summary:");
            AppendValue(sb, "Style", metrics.ArchitectureSummary.Style);
            AppendValue(sb, "Data flow", metrics.ArchitectureSummary.DataFlowDescription);
            AppendValue(sb, "Business logic", metrics.ArchitectureSummary.BusinessLogicLocation);
            AppendValue(sb, "UI logic", metrics.ArchitectureSummary.UiLogicLocation);
            AppendValue(sb, "API logic", metrics.ArchitectureSummary.ApiLogicLocation);
            AppendValue(sb, "Config", metrics.ArchitectureSummary.ConfigLocation);
        }

        if (metrics.TechStack != null)
        {
            sb.AppendLine();
            sb.AppendLine("Detected stack:");
            AppendTech(sb, "Frontend", metrics.TechStack.Frontend);
            AppendTech(sb, "Backend", metrics.TechStack.Backend);
            AppendTech(sb, "Database", metrics.TechStack.Database);
            AppendTech(sb, "Auth", metrics.TechStack.Auth);
            AppendTech(sb, "ORM", metrics.TechStack.Orm);
            AppendTech(sb, "Package manager", metrics.TechStack.PackageManager);
            AppendTech(sb, "Deployment", metrics.TechStack.Deployment);
            if (metrics.TechStack.AiProviders?.Any() == true)
            {
                sb.AppendLine($"- AI providers: {string.Join(", ", metrics.TechStack.AiProviders.Select(p => $"{p.Name} ({p.Confidence:P0})"))}");
            }
        }

        if (mode == "quick")
        {
            // For quick mode, bypass all heavy project-wide architecture lists to minimize AI cost and avoid global reasoning.
            if (!string.IsNullOrWhiteSpace(request.SurroundingCode))
            {
                sb.AppendLine();
                sb.AppendLine("Surrounding code with selected lines marked by >>>:");
                sb.AppendLine("```");
                sb.AppendLine(Clip(request.SurroundingCode, 24000));
                sb.AppendLine("```");
            }
            return sb.ToString();
        }

        AppendLines(sb, "Relevant modules", RelevantOrFirst(metrics.ModuleMap, m =>
            m.KeyFiles.Any(path => IsRelatedPath(path, filePath)) || IsTextRelated(m.Name, filePath), 5),
            m => $"- {m.Name}: {m.Purpose}. Files: {string.Join(", ", m.KeyFiles.Take(4))}. Depends on: {string.Join(", ", m.Dependencies.Take(4))}. Risk: {m.RiskLevel}. Guidance: {m.EditingGuidance}");

        AppendLines(sb, "Relevant important files", RelevantOrFirst(metrics.ImportantFiles, f => IsRelatedPath(f.Path, filePath), 8),
            f => $"- {f.Path}: {f.Importance}. Category: {f.Category}. AI behavior: {f.AiBehavior}");

        AppendLines(sb, "Relevant API routes", RelevantOrFirst(metrics.RouteMap, r =>
            IsTextRelated(r.Controller, filePath) || IsTextRelated(r.Route, filePath), 12),
            r => $"- {r.HttpMethod} {r.Route} via {r.Controller}. Auth: {r.AuthRequirement ?? "default"}. Purpose: {r.Purpose}");

        AppendLines(sb, "Relevant services", RelevantOrFirst(metrics.ServiceGraph, s =>
            IsRelatedPath(s.Path, filePath) || IsTextRelated(s.Name, filePath), 10),
            s => $"- {s.Name} ({s.Path}): {s.Purpose}. Depends on: {string.Join(", ", s.DependsOn.Take(8))}");

        AppendLines(sb, "Relevant database entities", RelevantOrFirst(metrics.EntityMap, e =>
            IsRelatedPath(e.Path, filePath) || IsTextRelated(e.Name, filePath), 10),
            e => $"- {e.Name} ({e.Path}): {e.TablePurpose}. Relationships: {string.Join(", ", e.Relationships.Take(8))}");

        AppendLines(sb, "Relevant DTOs", RelevantOrFirst(metrics.DtoMap, d =>
            IsRelatedPath(d.Path, filePath) || IsTextRelated(d.Name, filePath) || IsTextRelated(d.UsedBy, filePath), 10),
            d => $"- {d.Name} ({d.Path}): {d.Purpose}. Used by: {d.UsedBy}");

        AppendLines(sb, "AI provider integrations", metrics.AiProviderMap?.Take(8),
            p => $"- {p.ProviderName} in {p.Path}. Env vars: {string.Join(", ", p.EnvVarNames.Take(6))}. Fallback order: {p.FallbackOrder}");

        AppendLines(sb, "Plan enforcement points", metrics.PlanEnforcementMap?.Take(16),
            p => $"- {p.Name}: {p.Type} {p.Value} ({p.Path})");

        AppendLines(sb, "Extension export targets", metrics.ExtensionExportMap?.Take(12),
            e => $"- {e.TargetEditor}: {e.FilePath} - {e.Description}");

        AppendLines(sb, "Build and test commands", metrics.TestBuildMap?.Take(12),
            t => $"- {t.Name}: {t.Command} ({t.Type}, {t.Path})");

        AppendLines(sb, "Architecture rules", memory.ArchitectureRules.Where(r => r.IsActive).Take(12),
            r => $"- {r.Name}: {r.Description ?? r.Pattern}. Type: {r.RuleType}. Severity: {r.Severity}. Folder: {r.FolderPath}");

        AppendLines(sb, "Coding conventions", memory.CodingConventions.Where(c => c.IsActive).Take(12),
            c => $"- {c.Name}: {c.Rule}. Pattern: {c.Pattern}. Example: {c.Example}");

        AppendLines(sb, "Recent system decisions", memory.SystemDecisions.OrderByDescending(d => d.DecisionDate).Take(8),
            d => $"- {d.Title}: {d.Decision}. Reasoning: {d.Reasoning}. Category: {d.Category}");

        if (metrics.Dependencies.Any())
        {
            sb.AppendLine();
            sb.AppendLine($"Dependencies: {string.Join(", ", metrics.Dependencies.Take(40))}");
        }

        if (!string.IsNullOrWhiteSpace(request.SurroundingCode))
        {
            sb.AppendLine();
            sb.AppendLine("Surrounding code with selected lines marked by >>>:");
            sb.AppendLine("```");
            sb.AppendLine(Clip(request.SurroundingCode, 24000));
            sb.AppendLine("```");
        }

        return sb.ToString();
    }

    private static string ResolveLanguage(string? language, string filePath)
    {
        if (!string.IsNullOrWhiteSpace(language))
        {
            return language;
        }

        return Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".cs" => "csharp",
            ".ts" => "typescript",
            ".tsx" => "typescriptreact",
            ".js" => "javascript",
            ".jsx" => "javascriptreact",
            ".py" => "python",
            ".go" => "go",
            ".java" => "java",
            ".php" => "php",
            ".rb" => "ruby",
            ".rs" => "rust",
            ".json" => "json",
            ".md" => "markdown",
            _ => "code"
        };
    }

    private static void AppendValue(StringBuilder sb, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value) && !value.Equals("Unknown", StringComparison.OrdinalIgnoreCase))
        {
            sb.AppendLine($"- {label}: {value}");
        }
    }

    private static void AppendTech(StringBuilder sb, string label, DetectedTech? tech)
    {
        if (tech != null && !string.IsNullOrWhiteSpace(tech.Name))
        {
            sb.AppendLine($"- {label}: {tech.Name} ({tech.Confidence:P0})");
        }
    }

    private static void AppendLines<T>(StringBuilder sb, string title, IEnumerable<T>? items, Func<T, string> render)
    {
        var materialized = items?.ToList() ?? new List<T>();
        if (materialized.Count == 0) return;

        sb.AppendLine();
        sb.AppendLine($"{title}:");
        foreach (var item in materialized)
        {
            sb.AppendLine(Clip(render(item), 900));
        }
    }

    private static IEnumerable<T> RelevantOrFirst<T>(IEnumerable<T>? source, Func<T, bool> isRelevant, int limit)
    {
        var all = source?.ToList() ?? new List<T>();
        var relevant = all.Where(isRelevant).Take(limit).ToList();
        return relevant.Count > 0 ? relevant : all.Take(limit);
    }

    private static bool IsRelatedPath(string? candidate, string filePath)
    {
        if (string.IsNullOrWhiteSpace(candidate) || string.IsNullOrWhiteSpace(filePath)) return false;

        var normalizedCandidate = NormalizePath(candidate);
        var normalizedFile = NormalizePath(filePath);
        var fileName = Path.GetFileName(normalizedFile);

        return normalizedCandidate.Equals(normalizedFile, StringComparison.OrdinalIgnoreCase)
            || normalizedCandidate.EndsWith(normalizedFile, StringComparison.OrdinalIgnoreCase)
            || normalizedFile.EndsWith(normalizedCandidate, StringComparison.OrdinalIgnoreCase)
            || (!string.IsNullOrWhiteSpace(fileName) && normalizedCandidate.Contains(fileName, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsTextRelated(string? value, string filePath)
    {
        if (string.IsNullOrWhiteSpace(value) || string.IsNullOrWhiteSpace(filePath)) return false;

        var normalizedFile = NormalizePath(filePath);
        var fileName = Path.GetFileNameWithoutExtension(normalizedFile);
        return normalizedFile.Contains(value, StringComparison.OrdinalIgnoreCase)
            || (!string.IsNullOrWhiteSpace(fileName) && value.Contains(fileName, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizePath(string? path)
    {
        return (path ?? string.Empty).Replace('\\', '/').Trim();
    }

    private static string Clip(string value, int maxChars)
    {
        if (value.Length <= maxChars) return value;
        return value[..maxChars] + "...";
    }

    private static string? TryGetDeterministicExplanation(ProjectMemoryDto memory, string filePath, string codeSnippet)
    {
        var normalizedPath = NormalizePath(filePath);
        var fileName = Path.GetFileName(normalizedPath);
        var fileNameNoExt = Path.GetFileNameWithoutExtension(normalizedPath);

        // Fetch matches from metadata maps
        var isService = memory.Metrics.ServiceGraph?.FirstOrDefault(s => IsRelatedPath(s.Path, normalizedPath));
        var isEntity = memory.Metrics.EntityMap?.FirstOrDefault(e => IsRelatedPath(e.Path, normalizedPath));
        var isDto = memory.Metrics.DtoMap?.FirstOrDefault(d => IsRelatedPath(d.Path, normalizedPath));
        var isRoute = memory.Metrics.RouteMap?.FirstOrDefault(r => 
            (r.Controller != null && r.Controller.Contains(fileNameNoExt, StringComparison.OrdinalIgnoreCase)) ||
            (r.Route != null && r.Route.Contains(fileNameNoExt, StringComparison.OrdinalIgnoreCase))
        );
        var isModule = memory.Metrics.ModuleMap?.FirstOrDefault(m => m.KeyFiles.Any(f => IsRelatedPath(f, normalizedPath)));

        if (isService == null && isEntity == null && isDto == null && isRoute == null && isModule == null)
        {
            return null; // No metadata matches, cannot answer deterministically.
        }

        var sb = new StringBuilder();
        sb.AppendLine($"# ⚡ Quick Explain (Deterministic Project Memory)");
        sb.AppendLine($"This file was analyzed deterministically using the codebase's local index metadata. **Zero AI tokens were consumed.**");
        sb.AppendLine();
        sb.AppendLine($"## Summary");
        sb.AppendLine($"- **File Name:** `{fileName}`");
        sb.AppendLine($"- **Framework:** `{memory.Framework ?? "Generic / Unknown"}`");
        sb.AppendLine($"- **Architecture Role:** This file is mapped as part of the project's structural architecture.");

        if (isModule != null)
        {
            sb.AppendLine($"- **Module:** Part of the `{isModule.Name}` module (Purpose: *{isModule.Purpose}*).");
        }

        sb.AppendLine();
        sb.AppendLine($"## What It Does & Why It Exists");
        if (isService != null)
        {
            sb.AppendLine();
            sb.AppendLine($"### ⚙️ Service Layer: `{isService.Name}`");
            sb.AppendLine($"- **Purpose:** {isService.Purpose}");
            if (isService.DependsOn != null && isService.DependsOn.Any())
            {
                sb.AppendLine($"- **Dependencies:** Depends on service(s): {string.Join(", ", isService.DependsOn.Select(d => $"`{d}`"))}");
            }
        }
        if (isEntity != null)
        {
            sb.AppendLine();
            sb.AppendLine($"### 🗄️ Database Entity: `{isEntity.Name}`");
            sb.AppendLine($"- **Purpose:** {isEntity.TablePurpose}");
            if (isEntity.Relationships != null && isEntity.Relationships.Any())
            {
                sb.AppendLine($"- **Relationships:** {string.Join(", ", isEntity.Relationships.Select(r => $"`{r}`"))}");
            }
        }
        if (isDto != null)
        {
            sb.AppendLine();
            sb.AppendLine($"### 📦 Data Transfer Object: `{isDto.Name}`");
            sb.AppendLine($"- **Purpose:** {isDto.Purpose}");
            sb.AppendLine($"- **Used By:** {isDto.UsedBy}");
        }
        if (isRoute != null)
        {
            sb.AppendLine();
            sb.AppendLine($"### 🌐 API Endpoint: `{isRoute.HttpMethod} {isRoute.Route}`");
            sb.AppendLine($"- **Controller:** `{isRoute.Controller}`");
            sb.AppendLine($"- **Auth Requirement:** {isRoute.AuthRequirement ?? "Standard / Default Authentication"}");
            sb.AppendLine($"- **Purpose:** {isRoute.Purpose}");
        }

        // Include matching boundary rules
        var matchingRules = memory.ArchitectureRules.Where(r => r.IsActive && (string.IsNullOrEmpty(r.FolderPath) || normalizedPath.Contains(NormalizePath(r.FolderPath)))).ToList();
        if (matchingRules.Any())
        {
            sb.AppendLine();
            sb.AppendLine($"## Architecture & Editing Boundaries");
            foreach (var rule in matchingRules)
            {
                sb.AppendLine($"- **Rule [{rule.Name}]:** {rule.Description ?? rule.Pattern} (Severity: *{rule.Severity}*)");
            }
        }

        sb.AppendLine();
        sb.AppendLine($"## Confidence");
        sb.AppendLine($"- **Score:** 95%");
        sb.AppendLine($"- **Reason:** Clean metadata match found in structural maps. No deep heuristic reasoning required.");
        sb.AppendLine();
        sb.AppendLine($"---");
        sb.AppendLine($"*Need deeper code-level reasoning? Escalate to **Deep Explain** or **Deep Explain + Review** to invoke LLM analysis.*");

        return sb.ToString();
    }

    private ObjectResult PaidPlanRequired()
    {
        return StatusCode(403, new
        {
            error = "architecture_rules_requires_paid_plan",
            upgradeUrl = "https://aicontextbrain.me/pricing"
        });
    }
}

public class ValidateFileRequest
{
    public string ProjectPath { get; set; } = "";
    public string FilePath { get; set; } = "";
}

public class ValidateProjectRequest
{
    public string ProjectPath { get; set; } = "";
}

public class CheckComplianceRequest
{
    public string ProjectPath { get; set; } = "";
    public string FilePath { get; set; } = "";
    public string Content { get; set; } = "";
}

public class SuggestImprovementsRequest
{
    public string ProjectPath { get; set; } = "";
}
