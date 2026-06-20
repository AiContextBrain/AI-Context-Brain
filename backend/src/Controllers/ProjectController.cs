using AiContextBrain.Data;
using AiContextBrain.Dtos;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class ProjectController : ControllerBase
{
    private readonly IRepositoryScanner _scanner;
    private readonly IProjectMemoryService _memoryService;
    private readonly IContextGenerator _contextGenerator;
    private readonly IArchitectureGuard _architectureGuard;
    private readonly IHybridAIAnalysisService _hybridAI;
    private readonly ApplicationDbContext _context;
    private readonly ContextValidator _contextValidator = new();

    // Preview throttle: userId -> (count, windowStart)
    private static readonly ConcurrentDictionary<string, (int count, DateTime windowStart)> _previewThrottle = new();

    public ProjectController(
        IRepositoryScanner scanner,
        IProjectMemoryService memoryService,
        IContextGenerator contextGenerator,
        IArchitectureGuard architectureGuard,
        IHybridAIAnalysisService hybridAI,
        ApplicationDbContext context)
    {
        _scanner = scanner;
        _memoryService = memoryService;
        _contextGenerator = contextGenerator;
        _architectureGuard = architectureGuard;
        _hybridAI = hybridAI;
        _context = context;
    }

    [HttpPost("scan-repo")]
    public async Task<ActionResult<ScanResult>> ScanRepository([FromBody] ScanRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            // ── Plan limit checks
            var countsAgainstScanLimit = !request.IsBackgroundSync;
            Project? existingProject = null;
            if (DateTime.UtcNow > user.ScanResetDate)
            {
                user.ScanCount = 0;
                user.ScanResetDate = DateTime.UtcNow.AddMonths(1);
            }

            var maxScans = PlanLimits.EffectiveMaxScans(user);
            if (countsAgainstScanLimit && user.ScanCount >= maxScans)
            {
                return StatusCode(429, new
                {
                    error = "scan_limit_reached",
                    message = $"You've used all {maxScans} scans for this month on the {PlanLimits.PlanName(user.Plan)} plan.",
                    plan = user.Plan.ToString(),
                    limit = maxScans,
                    upgradeUrl = "https://aicontextbrain.me/pricing"
                });
            }

            existingProject = await _context.Projects.FirstOrDefaultAsync(
                p => p.Path == request.ProjectPath && p.UserId == user.Id);
            if (existingProject == null)
            {
                var projectCount = await _context.Projects.CountAsync(p => p.UserId == user.Id);
                var maxProjects = PlanLimits.MaxProjects(user.Plan);
                if (projectCount >= maxProjects)
                {
                    return StatusCode(403, new
                    {
                        error = "project_limit_reached",
                        message = $"You've reached the {maxProjects} project limit on the {PlanLimits.PlanName(user.Plan)} plan.",
                        plan = user.Plan.ToString(),
                        limit = maxProjects,
                        upgradeUrl = "https://aicontextbrain.me/pricing"
                    });
                }
            }

            // ── Atomic scan count increment — prevents TOCTOU race condition
            if (countsAgainstScanLimit)
            {
                var updated = await _context.Database.ExecuteSqlRawAsync(
                    @"UPDATE ""Users"" SET ""ScanCount"" = ""ScanCount"" + 1 WHERE ""Id"" = {0} AND ""ScanCount"" < {1}",
                    user.Id, maxScans);
                if (updated == 0)
                {
                    return StatusCode(429, new
                    {
                        error = "scan_limit_reached",
                        message = $"You've used all {maxScans} scans for this month on the {PlanLimits.PlanName(user.Plan)} plan.",
                        plan = user.Plan.ToString(),
                        limit = maxScans,
                        upgradeUrl = "https://aicontextbrain.me/pricing"
                    });
                }
                // Refresh user entity to get updated ScanCount
                await _context.Entry(user).ReloadAsync();
            }

            // ── Build scan result — always use client-provided data (path doesn't exist on cloud)
            var scanResult = new ScanResult
            {
                ProjectPath = request.ProjectPath,
                Framework = request.Framework ?? "Unknown",
                ArchitectureType = request.ArchitectureType ?? "Unknown",
                DatabaseType = request.DatabaseType ?? "Unknown",
                AuthSystem = request.AuthSystem ?? "Unknown",
                FolderStructure = request.FolderStructure ?? new List<string>(),
                DetectedPatterns = request.DetectedPatterns ?? new List<string>(),
                Metrics = request.Metrics != null ? new ProjectMetrics
                {
                    FilesCount = request.Metrics.FilesCount,
                    LinesOfCode = request.Metrics.LinesOfCode,
                    FoldersCount = request.Metrics.FoldersCount,
                    TotalSizeBytes = request.Metrics.TotalSizeBytes,
                    Dependencies = request.Metrics.Dependencies ?? new List<string>(),
                    FileExtensions = request.Metrics.FileExtensions ?? new Dictionary<string, int>(),
                    LargestFiles = request.Metrics.LargestFiles,
                    RecentlyModifiedFiles = request.Metrics.RecentlyModifiedFiles,
                    IgnoredPaths = request.Metrics.IgnoredPaths,
                    TechStack = request.Metrics.TechStack,
                    ImportantFiles = request.Metrics.ImportantFiles,
                    ModuleMap = request.Metrics.ModuleMap,
                    ArchitectureSummary = request.Metrics.ArchitectureSummary,
                    RouteMap = request.Metrics.RouteMap,
                    ServiceGraph = request.Metrics.ServiceGraph,
                    EntityMap = request.Metrics.EntityMap,
                    DtoMap = request.Metrics.DtoMap,
                    AiProviderMap = request.Metrics.AiProviderMap,
                    PlanEnforcementMap = request.Metrics.PlanEnforcementMap,
                    ExtensionExportMap = request.Metrics.ExtensionExportMap,
                    TestBuildMap = request.Metrics.TestBuildMap
                } : new ProjectMetrics()
            };

            await _memoryService.SaveScanResultAsync(scanResult, user.Id, request.Name);
            var savedProject = await _context.Projects.FirstOrDefaultAsync(
                p => p.Path == request.ProjectPath && p.UserId == user.Id);

            // Activity logging
            _context.ActivityLogs.Add(new ActivityLog
            {
                UserId = user.Id,
                ProjectId = savedProject?.Id,
                ProjectName = savedProject?.Name ?? request.Name ?? scanResult.ProjectPath?.Split(new[]{'/', '\\'}, StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? "Unknown",
                Action = "scan",
                Details = $"{scanResult.Metrics?.FilesCount ?? 0} files, {scanResult.Framework}, {scanResult.ArchitectureType}"
            });
            await _context.SaveChangesAsync();

            return Ok(scanResult);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Project] Scan failed: {ex}");
            return StatusCode(500, new { error = "scan_failed", message = "Repository scan could not be completed." });
        }
    }

    [HttpGet("project-memory")]
    public async Task<ActionResult<ProjectMemoryDto>> GetProjectMemory([FromQuery] string projectPath)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            var accessibleProject = await FindAccessibleProjectAsync(projectPath, user, requireWrite: false);
            if (accessibleProject == null)
            {
                return NotFound($"Project memory not found for: {projectPath}");
            }

            var memory = await _memoryService.GetProjectMemoryAsync(projectPath, accessibleProject.UserId);
            if (memory == null)
            {
                return NotFound($"Project memory not found for: {projectPath}");
            }

            return Ok(memory);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Project] Memory load failed: {ex}");
            return StatusCode(500, new { error = "memory_load_failed", message = "Project memory could not be loaded." });
        }
    }

    [HttpPost("update-memory")]
    public async Task<ActionResult> UpdateProjectMemory([FromBody] UpdateMemoryRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            var writableProject = await FindAccessibleProjectAsync(request.ProjectPath, user, requireWrite: true);
            if (writableProject == null)
            {
                return StatusCode(403, new { error = "Project write access denied" });
            }

            await _memoryService.UpdateProjectMemoryAsync(request, writableProject.UserId);
            return Ok();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Project] Memory update failed: {ex}");
            return StatusCode(500, new { error = "memory_update_failed", message = "Project memory could not be updated." });
        }
    }

    [HttpPost("generate-context")]
    public async Task<ActionResult<string>> GenerateAiContext([FromBody] GenerateContextRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            var contextSource = "template";
            var accessibleProject = await FindAccessibleProjectAsync(request.ProjectPath, user, requireWrite: false);
            if (accessibleProject == null)
            {
                return NotFound(new { error = "Project not found" });
            }

            var effectivePlan = await ResolveEffectivePlanForProjectAsync(accessibleProject, user);

            // ── Context generation monthly limit
            if (DateTime.UtcNow > user.ContextResetDate)
            {
                user.ContextGenerationCount = 0;
                user.ContextResetDate = DateTime.UtcNow.AddMonths(1);
            }
            var maxGenerations = PlanLimits.EffectiveMaxContextGenerations(user, effectivePlan);
            if (user.ContextGenerationCount >= maxGenerations)
            {
                return StatusCode(429, new
                {
                    error = "context_generation_limit_reached",
                    message = $"You've used all {maxGenerations} context generations for this month on the {PlanLimits.PlanName(effectivePlan)} plan.",
                    plan = effectivePlan.ToString(),
                    used = user.ContextGenerationCount,
                    limit = maxGenerations,
                    resetDate = user.ContextResetDate,
                    upgradeUrl = "https://aicontextbrain.me/pricing"
                });
            }
            var maxTokens = request.MaxTokens;
            var planMax = PlanLimits.MaxContextSizeTokens(effectivePlan);
            string? infoMessage = null;
            if (maxTokens > planMax)
            {
                maxTokens = planMax;
                infoMessage = $"Your {PlanLimits.PlanName(effectivePlan)} plan allows up to {planMax / 1000}k context capacity. The request has been adjusted automatically.";
            }
            var planName = effectivePlan.ToString();

            if (PlanLimits.HasPriorityAI(effectivePlan) && !request.ForceDeterministic)
            {
                if (DateTime.UtcNow > user.AiResetDate)
                {
                    user.AiRequestCount = 0;
                    user.AiResetDate = DateTime.UtcNow.AddMonths(1);
                }

                var maxAiRequests = PlanLimits.EffectiveMaxAiRequests(user, effectivePlan);
                if (user.AiRequestCount >= maxAiRequests)
                {
                    return StatusCode(429, new
                    {
                        error = "ai_usage_limit_reached",
                        message = $"You've used all {maxAiRequests} priority AI generations for this month on the {PlanLimits.PlanName(effectivePlan)} plan.",
                        plan = effectivePlan.ToString(),
                        used = user.AiRequestCount,
                        limit = maxAiRequests,
                        resetDate = user.AiResetDate,
                        upgradeUrl = "https://aicontextbrain.me/pricing"
                    });
                }
            }

            user.ContextGenerationCount++;

            var context = await _contextGenerator.GenerateContextAsync(request.ProjectPath, maxTokens, accessibleProject.UserId, effectivePlan);
            if (PlanLimits.HasPriorityAI(effectivePlan) && !request.ForceDeterministic)
            {
                // ── AI request budget check
                if (DateTime.UtcNow > user.AiResetDate)
                {
                    user.AiRequestCount = 0;
                    user.AiResetDate = DateTime.UtcNow.AddMonths(1);
                }
                var maxAiRequests = PlanLimits.EffectiveMaxAiRequests(user, effectivePlan);
                if (user.AiRequestCount < maxAiRequests)
                {
                    var memory = await _memoryService.GetProjectMemoryAsync(request.ProjectPath, accessibleProject.UserId);
                    if (memory != null)
                    {
                        var aiContext = await _hybridAI.GenerateArchitectureContextAsync(request.ProjectPath, memory);
                        if (IsUsableHybridContext(aiContext))
                        {
                            context = aiContext.Length / 4 > maxTokens
                                ? aiContext.Substring(0, Math.Min(aiContext.Length, maxTokens * 4))
                                : aiContext;
                            contextSource = "hybrid_ai";
                        }
                        user.AiRequestCount++;
                    }
                }
            }

            var project = accessibleProject;
            if (project != null)
            {
                if (PlanLimits.HasContextHistory(effectivePlan))
                {
                    _context.AIContexts.Add(new AIContext
                    {
                        ProjectId = project.Id,
                        Content = context
                    });
                }
                else
                {
                    var existing = await _context.AIContexts.Where(c => c.ProjectId == project.Id).ToListAsync();
                    if (existing.Any())
                    {
                        _context.AIContexts.RemoveRange(existing);
                    }
                    _context.AIContexts.Add(new AIContext
                    {
                        ProjectId = project.Id,
                        Content = context
                    });
                }
            }

            _context.ActivityLogs.Add(new ActivityLog
            {
                UserId = user.Id,
                ProjectId = project?.Id,
                ProjectName = project?.Name ?? request.ProjectPath?.Split(new[]{'/', '\\'}, StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? "Unknown",
                Action = "generate_context",
                Details = $"{planName} plan context capacity, {contextSource}"
            });
            await _context.SaveChangesAsync();

            // ── Quality score & validation
            var memory2 = await _memoryService.GetProjectMemoryAsync(request.ProjectPath ?? "", accessibleProject.UserId);
            var qualityScore = _contextGenerator.CalculateQualityScore(memory2);
            var confidence = _contextGenerator.CalculateDetectionConfidence(memory2);
            var validation = _contextValidator.Validate(context, memory2, maxTokens);

            var instructions = await _contextGenerator.GenerateAiInstructionsAsync(request.ProjectPath ?? "", accessibleProject.UserId);
            return Ok(new
            {
                context,
                instructions,
                plan = planName,
                maxTokens,
                source = contextSource,
                historySaved = project != null && PlanLimits.HasContextHistory(effectivePlan),
                quality = qualityScore,
                confidence,
                validation,
                infoMessage
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Project] Context generation failed: {ex}");
            return StatusCode(500, new { error = "context_generation_failed", message = "Optimized context could not be generated." });
        }
    }

    [HttpPost("preview-context")]
    public async Task<ActionResult<string>> PreviewAiContext([FromBody] GenerateContextRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            // ── Preview throttle: 5 calls per 60 seconds per user
            var throttleKey = user.Id;
            var now = DateTime.UtcNow;
            var throttleWindow = _previewThrottle.AddOrUpdate(
                throttleKey,
                _ => (1, now),
                (_, existing) =>
                {
                    if (now - existing.windowStart > TimeSpan.FromSeconds(60))
                        return (1, now);
                    return (existing.count + 1, existing.windowStart);
                });
            if (throttleWindow.count > 5)
            {
                var retryAfter = (int)(60 - (now - throttleWindow.windowStart).TotalSeconds);
                return StatusCode(429, new
                {
                    error = "preview_rate_limit_exceeded",
                    message = "Too many preview requests. Please wait before retrying.",
                    retryAfterSeconds = Math.Max(1, retryAfter)
                });
            }

            var accessibleProject = await FindAccessibleProjectAsync(request.ProjectPath, user, requireWrite: false);
            if (accessibleProject == null)
            {
                return NotFound(new { error = "Project not found" });
            }

            var effectivePlan = await ResolveEffectivePlanForProjectAsync(accessibleProject, user);
            var maxTokens = request.MaxTokens;
            var planMax = PlanLimits.MaxContextSizeTokens(effectivePlan);
            if (maxTokens > planMax) maxTokens = planMax;

            var latestSavedContext = await _context.AIContexts
                .Where(c => c.ProjectId == accessibleProject.Id)
                .OrderByDescending(c => c.CreatedAt)
                .FirstOrDefaultAsync();

            string context;
            bool isReadOnly = false;
            bool wasProGenerated = false;

            if (latestSavedContext != null && (latestSavedContext.Content.Length / 4) > planMax)
            {
                context = latestSavedContext.Content;
                isReadOnly = true;
                wasProGenerated = true;
            }
            else
            {
                context = await _contextGenerator.PreviewContextAsync(request.ProjectPath, maxTokens, accessibleProject.UserId, effectivePlan);
            }

            var instructions = await _contextGenerator.GenerateAiInstructionsAsync(request.ProjectPath ?? "", accessibleProject.UserId);

            // ── Quality score & validation (read-only, no side effects)
            var memory = await _memoryService.GetProjectMemoryAsync(request.ProjectPath ?? "", accessibleProject.UserId);
            var qualityScore = _contextGenerator.CalculateQualityScore(memory);
            var confidence = _contextGenerator.CalculateDetectionConfidence(memory);
            var validation = _contextValidator.Validate(context, memory, maxTokens);

            return Ok(new { context, instructions, maxTokens, quality = qualityScore, confidence, validation, isReadOnly, wasProGenerated });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Project] Context preview failed: {ex}");
            return StatusCode(500, new { error = "context_preview_failed", message = "Context preview could not be generated." });
        }
    }

    [HttpGet("context-quality")]
    public async Task<IActionResult> GetContextQuality([FromQuery] string projectPath)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var project = await FindAccessibleProjectAsync(projectPath, user, requireWrite: false);
        if (project == null) return NotFound(new { error = "Project not found" });

        var memory = await _memoryService.GetProjectMemoryAsync(projectPath, project.UserId);
        if (memory == null) return NotFound(new { error = "No scan data found. Please scan the project first." });

        var quality = _contextGenerator.CalculateQualityScore(memory);
        var confidence = _contextGenerator.CalculateDetectionConfidence(memory);

        return Ok(new { quality, confidence });
    }

    [HttpPost("validate-architecture")]
    public async Task<ActionResult<ValidationResult>> ValidateArchitecture([FromBody] ValidateArchitectureRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            var accessibleProject = await FindAccessibleProjectAsync(request.ProjectPath, user, requireWrite: false);
            if (accessibleProject == null)
            {
                return NotFound(new { error = "Project not found" });
            }
            var effectivePlan = await ResolveEffectivePlanForProjectAsync(accessibleProject, user);
            if (!PlanLimits.HasPriorityAI(effectivePlan))
            {
                return StatusCode(403, new { error = "architecture_rules_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
            }

            var violations = string.IsNullOrEmpty(request.FilePath)
                ? await _architectureGuard.ValidateProjectAsync(request.ProjectPath, accessibleProject.UserId)
                : await _architectureGuard.ValidateFileAsync(request.ProjectPath, request.FilePath, accessibleProject.UserId);
            
            var result = new ValidationResult
            {
                IsValid = violations.Count == 0,
                Violations = violations
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Project] Architecture validation failed: {ex}");
            return StatusCode(500, new { error = "architecture_validation_failed", message = "Architecture validation could not be completed." });
        }
    }

    private static bool IsUsableHybridContext(string? aiContext)
    {
        if (string.IsNullOrWhiteSpace(aiContext)) return false;
        if (aiContext.StartsWith("V2:", StringComparison.OrdinalIgnoreCase)) return false;
        if (aiContext.Contains("temporarily unavailable", StringComparison.OrdinalIgnoreCase)) return false;
        return aiContext.Length >= 500;
    }

    [HttpGet("context-history")]
    public async Task<ActionResult> GetContextHistory([FromQuery] string projectPath, [FromQuery] int limit = 10)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var project = await FindAccessibleProjectAsync(projectPath, user, requireWrite: false);
        if (project == null)
        {
            return NotFound(new { error = "Project not found" });
        }

        var effectivePlan = await ResolveEffectivePlanForProjectAsync(project, user);
        if (!PlanLimits.HasContextHistory(effectivePlan))
        {
            return StatusCode(403, new { error = "context_history_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var contexts = await _context.AIContexts
            .Where(c => c.ProjectId == project.Id)
            .OrderByDescending(c => c.CreatedAt)
            .Take(Math.Clamp(limit, 1, 50))
            .Select(c => new
            {
                c.Id,
                c.CreatedAt,
                characterCount = c.Content.Length,
                estimatedTokens = c.Content.Length / 4,
                preview = c.Content.Length > 220 ? c.Content.Substring(0, 220) + "..." : c.Content
            })
            .ToListAsync();

        return Ok(new { contexts });
    }

    [HttpGet("semantic-search")]
    public async Task<ActionResult> SemanticSearch([FromQuery] string query, [FromQuery] int limit = 10)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest(new { error = "Query required" });
        }

        var owned = await _context.Projects
            .Where(p => p.UserId == user.Id)
            .ToListAsync();

        var sharedLinks = await _context.ProjectShares
            .Include(s => s.Project)
            .Include(s => s.TeamWorkspace)
                .ThenInclude(t => t!.Owner)
            .Join(_context.TeamMembers,
                share => share.TeamWorkspaceId,
                member => member.TeamWorkspaceId,
                (share, member) => new { share, member })
            .Where(x => x.member.UserId == user.Id
                && x.share.Project != null
                && x.share.TeamWorkspace != null
                && x.share.TeamWorkspace.Owner != null)
            .ToListAsync();
        var shared = new List<Project>();
        foreach (var link in sharedLinks)
        {
            if (await IsActiveTeamWorkspaceAsync(link.share.TeamWorkspace))
            {
                shared.Add(link.share.Project!);
            }
        }

        var projects = owned.Concat(shared)
            .GroupBy(p => p.Id)
            .Select(g => g.First())
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Path,
                p.Framework,
                p.ArchitectureType,
                p.SemanticSummary,
                score = SemanticAnalysisService.Score(query, p.EmbeddingVectorJson, $"{p.Name} {p.SemanticSummary} {p.SemanticIndexJson}")
            })
            .OrderByDescending(p => p.score)
            .Take(Math.Clamp(limit, 1, 50))
            .ToList();

        return Ok(new { results = projects });
    }

    [HttpGet("context-history/{id}")]
    public async Task<ActionResult> GetContextHistoryItem(string id)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var item = await _context.AIContexts
            .Include(c => c.Project)
            .FirstOrDefaultAsync(c => c.Id == id && c.Project != null);
        if (item == null)
        {
            return NotFound(new { error = "Context history item not found" });
        }

        var accessibleProject = await FindAccessibleProjectAsync(item.Project!.Path, user, requireWrite: false);
        if (accessibleProject == null || accessibleProject.Id != item.ProjectId)
        {
            return NotFound(new { error = "Context history item not found" });
        }

        var effectivePlan = await ResolveEffectivePlanForProjectAsync(accessibleProject, user);
        if (!PlanLimits.HasContextHistory(effectivePlan))
        {
            return StatusCode(403, new { error = "context_history_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        return Ok(new
        {
            item.Id,
            item.ProjectId,
            projectName = item.Project?.Name,
            item.CreatedAt,
            item.Content,
            characterCount = item.Content.Length,
            estimatedTokens = item.Content.Length / 4
        });
    }

    [HttpGet("context-history/diff")]
    public async Task<ActionResult> DiffContextHistory([FromQuery] string fromId, [FromQuery] string toId)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var items = await _context.AIContexts
            .Include(c => c.Project)
            .Where(c => (c.Id == fromId || c.Id == toId) && c.Project != null)
            .ToListAsync();

        var from = items.FirstOrDefault(i => i.Id == fromId);
        var to = items.FirstOrDefault(i => i.Id == toId);
        if (from == null || to == null || from.ProjectId != to.ProjectId)
        {
            return NotFound(new { error = "Context history items not found in the same project" });
        }

        var accessibleProject = await FindAccessibleProjectAsync(from.Project!.Path, user, requireWrite: false);
        if (accessibleProject == null || accessibleProject.Id != from.ProjectId)
        {
            return NotFound(new { error = "Context history items not found in the same project" });
        }

        var effectivePlan = await ResolveEffectivePlanForProjectAsync(accessibleProject, user);
        if (!PlanLimits.HasContextHistory(effectivePlan))
        {
            return StatusCode(403, new { error = "context_history_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var diff = BuildLineDiff(from.Content, to.Content);
        return Ok(new
        {
            from = new { from.Id, from.CreatedAt },
            to = new { to.Id, to.CreatedAt },
            diff
        });
    }

    [HttpPost("context-history/{id}/restore")]
    public async Task<ActionResult> RestoreContextHistory(string id)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var item = await _context.AIContexts
            .Include(c => c.Project)
            .FirstOrDefaultAsync(c => c.Id == id && c.Project != null);
        if (item == null)
        {
            return NotFound(new { error = "Context history item not found" });
        }

        var accessibleProject = await FindAccessibleProjectAsync(item.Project!.Path, user, requireWrite: true);
        if (accessibleProject == null || accessibleProject.Id != item.ProjectId)
        {
            return NotFound(new { error = "Context history item not found or write access denied" });
        }

        var effectivePlan = await ResolveEffectivePlanForProjectAsync(accessibleProject, user);
        if (!PlanLimits.HasContextHistory(effectivePlan))
        {
            return StatusCode(403, new { error = "context_history_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var restored = new AIContext
        {
            ProjectId = item.ProjectId,
            Content = item.Content
        };

        _context.AIContexts.Add(restored);
        _context.ActivityLogs.Add(new ActivityLog
        {
            UserId = user.Id,
            ProjectId = item.ProjectId,
            ProjectName = item.Project?.Name ?? "Unknown",
            Action = "restore_context",
            Details = $"Restored context from {item.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC"
        });
        await _context.SaveChangesAsync();

        return Ok(new
        {
            restored.Id,
            restored.ProjectId,
            restored.CreatedAt,
            characterCount = restored.Content.Length,
            estimatedTokens = restored.Content.Length / 4
        });
    }

    private static List<object> BuildLineDiff(string fromContent, string toContent)
    {
        var oldLines = fromContent.Replace("\r\n", "\n").Split('\n');
        var newLines = toContent.Replace("\r\n", "\n").Split('\n');
        var max = Math.Max(oldLines.Length, newLines.Length);
        var diff = new List<object>();

        for (var i = 0; i < max; i++)
        {
            var oldLine = i < oldLines.Length ? oldLines[i] : null;
            var newLine = i < newLines.Length ? newLines[i] : null;
            if (oldLine == newLine)
            {
                continue;
            }

            if (oldLine != null)
            {
                diff.Add(new { type = "removed", line = i + 1, text = oldLine });
            }

            if (newLine != null)
            {
                diff.Add(new { type = "added", line = i + 1, text = newLine });
            }
        }

        return diff.Take(500).ToList();
    }

    private async Task<Project?> FindAccessibleProjectAsync(string projectPath, User user, bool requireWrite)
    {
        var owned = await _context.Projects.FirstOrDefaultAsync(p => p.Path == projectPath && p.UserId == user.Id);
        if (owned != null)
        {
            return owned;
        }

        var sharedLinks = await _context.ProjectShares
            .Include(s => s.Project)
            .Include(s => s.TeamWorkspace)
                .ThenInclude(t => t!.Owner)
            .Where(s => s.Project != null && s.Project.Path == projectPath)
            .Join(_context.TeamMembers,
                share => share.TeamWorkspaceId,
                member => member.TeamWorkspaceId,
                (share, member) => new { share, member })
            .Where(x => x.member.UserId == user.Id
                && x.share.TeamWorkspace != null
                && x.share.TeamWorkspace.Owner != null)
            .ToListAsync();

        Project? sharedProject = null;
        TeamMember? sharedMember = null;
        foreach (var link in sharedLinks)
        {
            if (await IsActiveTeamWorkspaceAsync(link.share.TeamWorkspace))
            {
                sharedProject = link.share.Project;
                sharedMember = link.member;
                break;
            }
        }

        if (sharedProject == null || sharedMember == null)
        {
            return null;
        }

        if (requireWrite && sharedMember.Role is not (TeamRole.Owner or TeamRole.Admin))
        {
            return null;
        }

        return sharedProject;
    }

    private async Task<UserPlan> ResolveEffectivePlanForProjectAsync(Project project, User user)
    {
        if (project.UserId == user.Id)
        {
            return user.Plan;
        }

        var shared = await _context.ProjectShares
            .Include(s => s.TeamWorkspace)
                .ThenInclude(t => t!.Owner)
            .Join(_context.TeamMembers,
                share => share.TeamWorkspaceId,
                member => member.TeamWorkspaceId,
                (share, member) => new { share, member })
            .Where(x => x.share.ProjectId == project.Id
                && x.member.UserId == user.Id
                && x.share.TeamWorkspace != null
                && x.share.TeamWorkspace.Owner != null)
            .FirstOrDefaultAsync();

        if (shared?.share.TeamWorkspace == null)
        {
            return user.Plan;
        }

        return await IsActiveTeamWorkspaceAsync(shared.share.TeamWorkspace) ? UserPlan.Team : user.Plan;
    }

    private async Task<bool> IsActiveTeamWorkspaceAsync(TeamWorkspace? teamWorkspace)
    {
        if (teamWorkspace?.Owner == null)
        {
            return false;
        }

        if (teamWorkspace.Owner.ApplyBillingState())
        {
            await _context.SaveChangesAsync();
        }

        return teamWorkspace.Owner.Plan == UserPlan.Team;
    }

    [HttpPost("architecture-rules")]
    public async Task<IActionResult> CreateArchitectureRule([FromBody] CreateArchitectureRuleRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(Request.Headers["Authorization"].FirstOrDefault());
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var project = await FindAccessibleProjectAsync(request.ProjectPath, user, requireWrite: true);
        if (project == null) return NotFound(new { error = "Project not found or write access denied" });
        var effectivePlan = await ResolveEffectivePlanForProjectAsync(project, user);
        if (!PlanLimits.HasPriorityAI(effectivePlan))
        {
            return StatusCode(403, new { error = "architecture_rules_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var rule = new ArchitectureRule
        {
            Name = request.Name,
            Pattern = request.Pattern,
            Description = request.Description,
            FolderPath = request.FolderPath,
            RuleType = request.RuleType,
            Severity = request.Severity,
            Language = request.Language,
            AutoFixSuggestion = request.AutoFixSuggestion,
            ProjectId = project.Id,
            IsActive = true
        };

        _context.ArchitectureRules.Add(rule);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, id = rule.Id });
    }

    [HttpPut("architecture-rules/{id}")]
    public async Task<IActionResult> UpdateArchitectureRule(string id, [FromBody] UpdateArchitectureRuleRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(Request.Headers["Authorization"].FirstOrDefault());
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var rule = await _context.ArchitectureRules
            .Include(r => r.Project)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (rule == null) return NotFound(new { error = "Rule not found" });

        var project = await FindAccessibleProjectAsync(rule.Project!.Path, user, requireWrite: true);
        if (project == null) return StatusCode(403, new { error = "Write access denied" });
        var effectivePlan = await ResolveEffectivePlanForProjectAsync(project, user);
        if (!PlanLimits.HasPriorityAI(effectivePlan))
        {
            return StatusCode(403, new { error = "architecture_rules_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        if (request.Name != null) rule.Name = request.Name;
        if (request.Pattern != null) rule.Pattern = request.Pattern;
        if (request.Description != null) rule.Description = request.Description;
        if (request.FolderPath != null) rule.FolderPath = request.FolderPath;
        if (request.RuleType != null) rule.RuleType = request.RuleType;
        if (request.Severity != null) rule.Severity = request.Severity;
        if (request.Language != null) rule.Language = request.Language;
        if (request.AutoFixSuggestion != null) rule.AutoFixSuggestion = request.AutoFixSuggestion;
        if (request.IsActive != null) rule.IsActive = request.IsActive.Value;

        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpDelete("architecture-rules/{id}")]
    public async Task<IActionResult> DeleteArchitectureRule(string id)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(Request.Headers["Authorization"].FirstOrDefault());
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var rule = await _context.ArchitectureRules
            .Include(r => r.Project)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (rule == null) return NotFound(new { error = "Rule not found" });

        var project = await FindAccessibleProjectAsync(rule.Project!.Path, user, requireWrite: true);
        if (project == null) return StatusCode(403, new { error = "Write access denied" });
        var effectivePlan = await ResolveEffectivePlanForProjectAsync(project, user);
        if (!PlanLimits.HasPriorityAI(effectivePlan))
        {
            return StatusCode(403, new { error = "architecture_rules_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        _context.ArchitectureRules.Remove(rule);
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("architecture-rules/{id}/toggle")]
    public async Task<IActionResult> ToggleArchitectureRule(string id)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(Request.Headers["Authorization"].FirstOrDefault());
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var rule = await _context.ArchitectureRules
            .Include(r => r.Project)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (rule == null) return NotFound(new { error = "Rule not found" });

        var project = await FindAccessibleProjectAsync(rule.Project!.Path, user, requireWrite: true);
        if (project == null) return StatusCode(403, new { error = "Write access denied" });
        var effectivePlan = await ResolveEffectivePlanForProjectAsync(project, user);
        if (!PlanLimits.HasPriorityAI(effectivePlan))
        {
            return StatusCode(403, new { error = "architecture_rules_requires_paid_plan", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        rule.IsActive = !rule.IsActive;
        await _context.SaveChangesAsync();
        return Ok(new { success = true, isActive = rule.IsActive });
    }

    [HttpGet("architecture-rules/templates")]
    public IActionResult GetRuleTemplates()
    {
        var templates = new List<object>
        {
            new {
                name = "No Console.log in Production",
                ruleType = "ContentForbidden",
                pattern = "console.log(",
                language = "typescript",
                severity = "Warning",
                description = "Production kodunda console.log kullanılmamalı",
                autoFixSuggestion = "Yasaklı console.log ifadesini kaldırın veya yorum satırına dönüştürün."
            },
            new {
                name = "Max 300 Lines Per File",
                ruleType = "FileSizeLimit",
                pattern = "300",
                severity = "Warning",
                description = "Dosyalar 300 satırı geçmemeli",
                autoFixSuggestion = "Dosyayı daha küçük, odaklanmış alt bileşenlere veya sınıflara bölün."
            },
            new {
                name = "Services Only in Services Folder",
                ruleType = "FolderRestriction",
                pattern = "Service",
                folderPath = "src/Services",
                language = "typescript",
                severity = "Error",
                description = "Tüm servis dosyaları Services dizininde olmalı",
                autoFixSuggestion = "Bu servis dosyasını src/Services dizini altına taşıyın."
            },
            new {
                name = "No TODO Comments in Production",
                ruleType = "ContentForbidden",
                pattern = "TODO:",
                severity = "Warning",
                description = "Üretim aşamasında tamamlanmamış TODO kalmamalı",
                autoFixSuggestion = "TODO açıklamasındaki görevi tamamlayın veya yorum satırını kaldırın."
            },
            new {
                name = "PascalCase Controllers",
                ruleType = "NamingConvention",
                pattern = "^[A-Z][a-zA-Z0-9]*Controller$",
                language = "csharp",
                severity = "Error",
                description = "Controller sınıfları PascalCase olmalı ve Controller ile bitmeli",
                autoFixSuggestion = "Sınıf adını ve dosya adını PascalCase standartlarına uygun yapın."
            }
        };

        return Ok(templates);
    }

    [HttpPost("wizard-create")]
    public async Task<IActionResult> CreateProjectFromWizard([FromBody] WizardCreateRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            // ── 1. SERVER-SIDE INPUT VALIDATION
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "validation_failed", message = "Project name is required." });
            }
            if (request.Name.Trim().Length > 200 || (!string.IsNullOrWhiteSpace(request.ProjectPath) && request.ProjectPath.Length > 500))
            {
                return BadRequest(new { error = "validation_failed", message = "Project name or path is too long." });
            }

            var projectId = Guid.NewGuid().ToString();
            var projectPath = string.IsNullOrWhiteSpace(request.ProjectPath)
                ? $"wizard-temp-{projectId}"
                : request.ProjectPath;

            // Clean inputs for strict comparisons
            var validProductTypes = new[] { "saas", "restaurant", "stock", "custom" };
            if (request.ProductTypes == null || request.ProductTypes.Any(p => !validProductTypes.Contains((p ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid product domain/template selection." });
            }

            // Validate languages
            var validLangs = new[] { "typescript", "javascript", "c#", "csharp", "dotnet", "python", "go", "rust", "java", "kotlin", "swift", "cpp" };
            if (request.Languages == null || !request.Languages.Any() || request.Languages.Any(l => !validLangs.Contains((l ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid programming language selection." });
            }

            // Validate DBs
            var validDbs = new[] { "postgresql", "mysql", "sqlite", "sql server", "mongodb", "none", "" };
            if (request.Databases == null || request.Databases.Any(d => !validDbs.Contains((d ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid database selection." });
            }

            // Validate Auths
            var validAuths = new[] { "jwt", "nextauth", "oauth", "github_oauth", "email verification", "password reset", "none", "" };
            if (request.Auths == null || request.Auths.Any(a => !validAuths.Contains((a ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid authentication selection." });
            }

            // Validate Deployments
            var validDeploys = new[] { "docker", "railway", "render", "azure", "vercel", "github actions", "none", "" };
            if (request.Deployments == null || request.Deployments.Any(d => !validDeploys.Contains((d ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid deployment selection." });
            }

            // Validate Billings
            var validBillings = new[] { "stripe", "paddle", "lemonsqueezy", "none", "" };
            if (request.Billings == null || request.Billings.Any(b => !validBillings.Contains((b ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid billing selection." });
            }

            // Validate Automations
            var validAutos = new[] { "none", "yaml", "i18n", "n8n", "zapier", "make", "custom webhook system", "background jobs / workers", "" };
            if (request.Automations == null || request.Automations.Any(a => !validAutos.Contains((a ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid automation/workflow selection." });
            }

            // Validate Strictness Levels
            var validStrictness = new[] { "basic", "strict", "enterprise" };
            if (request.StrictnessLevels == null || !request.StrictnessLevels.Any() || request.StrictnessLevels.Any(s => !validStrictness.Contains((s ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid strictness level selection." });
            }

            // Validate Locales
            var validLocales = new[] { "en", "tr", "de", "fr", "es", "it", "zh", "ja", "ru", "pt", "" };
            if (request.Locales != null && request.Locales.Any(l => !validLocales.Contains((l ?? "").ToLowerInvariant().Trim())))
            {
                return BadRequest(new { error = "validation_failed", message = "Invalid locale selection." });
            }

            // ── 2. PROJECT LIMIT CHECK
            var projectCount = await _context.Projects.CountAsync(p => p.UserId == user.Id);
            var maxProjects = PlanLimits.MaxProjects(user.Plan);
            if (projectCount >= maxProjects)
            {
                return StatusCode(403, new
                {
                    error = "project_limit_reached",
                    message = $"You've reached the {maxProjects} project limit on the {PlanLimits.PlanName(user.Plan)} plan.",
                    upgradeUrl = "https://aicontextbrain.me/pricing"
                });
            }

            // ── 3. DUPLICATE CHECK
            if (!projectPath.StartsWith("wizard-temp-"))
            {
                var existingProject = await _context.Projects.FirstOrDefaultAsync(
                    p => p.Path == projectPath && p.UserId == user.Id);
                if (existingProject != null)
                {
                    return BadRequest(new { error = "project_already_exists", message = "A project memory with this path already exists." });
                }
            }

            // ── 4. DETERMINISTIC TEMPLATE GENERATION
            // Force server-side template generation based on verified request inputs
            var blueprint = WizardTemplateGenerator.Generate(request);

            // ── 5. RECORD PROJECT IN DATABASE
            var project = new Project
            {
                Id = projectId,
                Name = request.Name,
                Path = projectPath,
                Framework = blueprint.Framework,
                ArchitectureType = blueprint.ArchitectureType,
                DatabaseType = blueprint.DatabaseType,
                AuthSystem = blueprint.AuthSystem,
                UserId = user.Id,
                ScanFingerprint = Guid.NewGuid().ToString(),
                SemanticSummary = $"Planned {blueprint.ArchitectureType} project blueprint. Real file and line metrics become available after the first local scan.",
                IsLocalInitialized = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Projects.Add(project);

            // ── 6. CREATE METRICS AND SCANS
            var scanMetrics = new ProjectMetrics
            {
                FilesCount = 0,
                LinesOfCode = 0,
                FoldersCount = blueprint.FolderStructure.Count,
                TotalSizeBytes = 0,
                Dependencies = blueprint.Dependencies,
                FileExtensions = blueprint.FileExtensions,
                TechStack = new TechStackDetails
                {
                    Frontend = new DetectedTech { Name = request.Platforms.Contains("web") ? "React" : "Native", Confidence = 1.0 },
                    Backend = new DetectedTech { Name = blueprint.Framework, Confidence = 1.0 },
                    Database = new DetectedTech { Name = blueprint.DatabaseType, Confidence = 1.0 },
                    Auth = new DetectedTech { Name = blueprint.AuthSystem, Confidence = 1.0 }
                },
                WizardScaffold = new WizardScaffoldOptions
                {
                    Platforms = request.Platforms,
                    ProductTypes = request.ProductTypes,
                    Languages = request.Languages,
                    Databases = request.Databases,
                    Auths = request.Auths,
                    Deployments = request.Deployments,
                    Billings = request.Billings,
                    Automations = request.Automations,
                    Locales = request.Locales ?? new List<string>()
                }
            };

            var scanData = System.Text.Json.JsonSerializer.Serialize(scanMetrics);
            var folderStructure = System.Text.Json.JsonSerializer.Serialize(blueprint.FolderStructure);

            var projectScan = new ProjectScan
            {
                ScanDate = DateTime.UtcNow,
                ScanData = scanData,
                FolderStructureJson = folderStructure,
                Framework = blueprint.Framework,
                ArchitectureType = blueprint.ArchitectureType,
                FilesCount = scanMetrics.FilesCount,
                LinesOfCode = scanMetrics.LinesOfCode,
                Project = project
            };
            _context.ProjectScans.Add(projectScan);

            // ── 7. ADD RULES, CONVENTIONS, DECISIONS
            foreach (var dec in blueprint.SystemDecisions)
            {
                _context.SystemDecisions.Add(new SystemDecision
                {
                    ProjectId = project.Id,
                    Title = dec.Title,
                    Decision = dec.Decision,
                    Reasoning = dec.Reasoning,
                    Category = dec.Category,
                    DecisionDate = DateTime.UtcNow,
                    Project = project
                });
            }

            foreach (var rule in blueprint.ArchitectureRules)
            {
                rule.ProjectId = project.Id;
                rule.Project = project;
                _context.ArchitectureRules.Add(rule);
            }

            foreach (var conv in blueprint.CodingConventions)
            {
                conv.ProjectId = project.Id;
                conv.Project = project;
                _context.CodingConventions.Add(conv);
            }

            // Save to DB
            _context.ActivityLogs.Add(new ActivityLog
            {
                UserId = user.Id,
                ProjectId = project.Id,
                ProjectName = project.Name,
                Action = "wizard_created",
                Details = $"Wizard Project registered: {blueprint.Framework}, {blueprint.ArchitectureType}"
            });

            _context.AuditLogs.Add(new AuditLog
            {
                AdminUserId = user.Id,
                TargetUserId = user.Id,
                Action = "wizard_created",
                Details = $"User {user.Email} created a wizard project named {project.Name} (ID: {project.Id})."
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                projectId = project.Id,
                projectPath = project.Path,
                name = project.Name
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Wizard] Project creation failed: {ex}");
            return StatusCode(500, new { error = "wizard_failed", message = "Project setup could not be completed." });
        }
    }

    [HttpGet("{projectId}/wizard-blueprint")]
    public async Task<IActionResult> GetWizardBlueprint(string projectId)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "invalid_token", message = "Invalid or missing token" });
            }

            var project = await _context.Projects
                .Include(p => p.ArchitectureRules)
                .Include(p => p.CodingConventions)
                .Include(p => p.SystemDecisions)
                .Include(p => p.Scans)
                .FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == user.Id);

            if (project == null)
            {
                return NotFound(new { error = "project_not_found", message = "Project not found or access denied." });
            }

            var folderStructure = new List<string>();
            var dependencies = new List<string>();
            var scaffoldOptions = new WizardScaffoldOptions();
            ProjectMetrics? wizardMetrics = null;
            var scan = project.Scans
                .OrderByDescending(s => s.ScanDate)
                .FirstOrDefault(s => s.FilesCount == 0 && s.FolderStructureJson != "[]")
                ?? project.Scans.OrderByDescending(s => s.ScanDate).FirstOrDefault();
            if (scan != null)
            {
                if (!string.IsNullOrEmpty(scan.FolderStructureJson))
                {
                    try
                    {
                        folderStructure = System.Text.Json.JsonSerializer.Deserialize<List<string>>(scan.FolderStructureJson) ?? new();
                    }
                    catch {}
                }
                if (!string.IsNullOrEmpty(scan.ScanData))
                {
                    try
                    {
                        wizardMetrics = System.Text.Json.JsonSerializer.Deserialize<ProjectMetrics>(scan.ScanData);
                        dependencies = wizardMetrics?.Dependencies ?? new();
                        scaffoldOptions = wizardMetrics?.WizardScaffold ?? new WizardScaffoldOptions();
                    }
                    catch {}
                }
            }

            return Ok(new
            {
                id = project.Id,
                name = project.Name,
                framework = scan?.Framework ?? project.Framework,
                architectureType = scan?.ArchitectureType ?? project.ArchitectureType,
                databaseType = wizardMetrics?.TechStack?.Database?.Name ?? project.DatabaseType,
                authSystem = wizardMetrics?.TechStack?.Auth?.Name ?? project.AuthSystem,
                folderStructure = folderStructure,
                dependencies = dependencies,
                scaffoldOptions,
                systemDecisions = project.SystemDecisions.Select(d => new { d.Title, d.Decision, d.Category, d.Reasoning }).ToList(),
                architectureRules = project.ArchitectureRules.Select(r => new { r.Name, r.Pattern, r.Description, r.RuleType, r.Severity, r.Language, r.AutoFixSuggestion }).ToList(),
                codingConventions = project.CodingConventions.Select(c => new { c.Name, c.Rule, c.Example, c.Language }).ToList()
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Wizard] Blueprint load failed: {ex}");
            return StatusCode(500, new { error = "blueprint_failed", message = "Project blueprint could not be loaded." });
        }
    }

    [HttpDelete("{projectId}")]
    public async Task<IActionResult> DeleteProject(string projectId)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "invalid_token", message = "Invalid or missing token" });
        }

        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == projectId && p.UserId == user.Id);
        if (project == null)
        {
            return NotFound(new { error = "project_not_found", message = "Project not found or access denied." });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _context.ProjectShares.RemoveRange(_context.ProjectShares.Where(s => s.ProjectId == project.Id));
            _context.ActivityLogs.RemoveRange(_context.ActivityLogs.Where(a => a.ProjectId == project.Id));
            _context.AIContexts.RemoveRange(_context.AIContexts.Where(c => c.ProjectId == project.Id));
            _context.ProjectScans.RemoveRange(_context.ProjectScans.Where(s => s.ProjectId == project.Id));
            _context.ArchitectureRules.RemoveRange(_context.ArchitectureRules.Where(r => r.ProjectId == project.Id));
            _context.CodingConventions.RemoveRange(_context.CodingConventions.Where(c => c.ProjectId == project.Id));
            _context.SystemDecisions.RemoveRange(_context.SystemDecisions.Where(d => d.ProjectId == project.Id));
            _context.Projects.Remove(project);

            _context.AuditLogs.Add(new AuditLog
            {
                AdminUserId = user.Id,
                TargetUserId = user.Id,
                Action = "project_deleted",
                Details = $"User {user.Email} deleted project {project.Name} (ID: {project.Id})."
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                success = true,
                message = "Project connection and cloud memory were deleted. Local files were not changed."
            });
        }
        catch
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new
            {
                error = "project_delete_failed",
                message = "Project connection could not be deleted."
            });
        }
    }

    [HttpPost("{projectId}/initialize-local")]
    public async Task<IActionResult> InitializeLocalProject(string projectId, [FromBody] InitializeLocalRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "invalid_token", message = "Invalid or missing token" });
            }

            var project = await _context.Projects.FirstOrDefaultAsync(
                p => p.Id == projectId && p.UserId == user.Id);
            if (project == null)
            {
                return NotFound(new { error = "project_not_found", message = "Project not found or access denied." });
            }

            var workspaceName = (request.WorkspaceName ?? string.Empty).Trim();
            if (workspaceName.Length > 200)
            {
                return BadRequest(new { error = "validation_failed", message = "Workspace name must be 200 characters or fewer." });
            }

            // Idempotency check:
            if (project.IsLocalInitialized)
            {
                if (!string.Equals(project.Path, request.LocalPath, StringComparison.OrdinalIgnoreCase))
                {
                    return Conflict(new
                    {
                        error = "project_already_initialized_elsewhere",
                        message = "This wizard project is already linked to a different local workspace."
                    });
                }
                if (!string.IsNullOrWhiteSpace(workspaceName) && project.Name != workspaceName)
                {
                    project.Name = workspaceName;
                    project.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
                return Ok(new { success = true, alreadyInitialized = true, projectName = project.Name, message = "Project is already initialized." });
            }

            if (string.IsNullOrWhiteSpace(request.LocalPath))
            {
                return BadRequest(new { error = "validation_failed", message = "Local path is required." });
            }

            // Check duplicate path for this user
            var existingWithSamePath = await _context.Projects.FirstOrDefaultAsync(
                p => p.Path == request.LocalPath && p.UserId == user.Id && p.Id != projectId);
            if (existingWithSamePath != null)
            {
                return BadRequest(new { error = "project_path_duplicate", message = "Another project already registered with this local path." });
            }

            project.Path = request.LocalPath;
            if (!string.IsNullOrWhiteSpace(workspaceName))
            {
                project.Name = workspaceName;
            }
            project.IsLocalInitialized = true;
            project.UpdatedAt = DateTime.UtcNow;

            // Audit & Activity Logging
            _context.ActivityLogs.Add(new ActivityLog
            {
                UserId = user.Id,
                ProjectId = project.Id,
                ProjectName = project.Name,
                Action = "local_initialized",
                Details = $"Project initialized locally at path: {request.LocalPath}"
            });

            _context.AuditLogs.Add(new AuditLog
            {
                AdminUserId = user.Id,
                TargetUserId = user.Id,
                Action = "local_initialized",
                Details = $"User {user.Email} initialized local workspace for project {project.Name} (ID: {project.Id}) at path: {request.LocalPath}"
            });

            await _context.SaveChangesAsync();

            return Ok(new { success = true, alreadyInitialized = false, projectName = project.Name, message = "Project successfully initialized locally." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Wizard] Local initialization failed: {ex}");
            return StatusCode(500, new { error = "init_failed", message = "Local workspace could not be linked." });
        }
    }

    [HttpPost("initialize")]
    public async Task<IActionResult> InitializeProject([FromBody] InitializeProjectRequest request)
    {
        try
        {
            var user = await _context.ResolveUserFromBearerTokenAsync(
                Request.Headers["Authorization"].FirstOrDefault());
            if (user == null)
            {
                return Unauthorized(new { error = "Invalid or missing token" });
            }

            var project = await _context.Projects.FirstOrDefaultAsync(
                p => p.Path == request.ProjectPath && p.UserId == user.Id);
            if (project == null)
            {
                return NotFound(new { error = "project_not_found", message = "Project not found." });
            }

            project.IsLocalInitialized = true;
            project.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Project marked as locally initialized." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Project] Initialization failed: {ex}");
            return StatusCode(500, new { error = "init_failed", message = "Project initialization could not be completed." });
        }
    }
}

// Health check controller
[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new { status = "Healthy", timestamp = DateTime.UtcNow });
    }
}
