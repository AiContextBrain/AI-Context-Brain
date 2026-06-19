// ============================================
// SaaS User API - V1 Backend Extension
// ============================================
using AiContextBrain.Data;
using AiContextBrain.Dtos;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class UserController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public UserController(ApplicationDbContext context)
    {
        _context = context;
    }

    private async Task<User?> GetUserFromTokenAsync(string? token)
    {
        return await _context.ResolveUserFromBearerTokenAsync(
            string.IsNullOrWhiteSpace(token) ? null : $"Bearer {token}");
    }

    [HttpGet("projects")]
    public async Task<IActionResult> GetProjects()
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var ownedProjects = await _context.Projects
            .Where(p => p.UserId == user.Id)
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => new
            {
                id = p.Id,
                name = p.Name,
                path = p.Path,
                framework = p.Framework,
                architectureType = p.ArchitectureType,
                databaseType = p.DatabaseType,
                authSystem = p.AuthSystem,
                lastScanned = p.UpdatedAt,
                createdAt = p.CreatedAt,
                isShared = false,
                teamId = (string?)null,
                teamName = (string?)null,
                role = "Owner"
            })
            .ToListAsync();

        var now = DateTime.UtcNow;
        var sharedProjects = await _context.ProjectShares
            .Include(s => s.Project)
            .Include(s => s.TeamWorkspace)
                .ThenInclude(t => t!.Owner)
            .Join(_context.TeamMembers,
                share => share.TeamWorkspaceId,
                member => member.TeamWorkspaceId,
                (share, member) => new { share, member })
            .Where(x => x.member.UserId == user.Id
                && x.share.Project != null
                && x.share.Project.UserId != user.Id
                && x.share.TeamWorkspace != null
                && x.share.TeamWorkspace.Owner != null
                && x.share.TeamWorkspace.Owner.Plan == UserPlan.Team
                && (x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == null
                    || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "active"
                    || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "trialing"
                    || ((x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "canceled"
                            || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "cancelled"
                            || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "past_due")
                        && x.share.TeamWorkspace.Owner.PaddleCurrentPeriodEnd != null
                        && x.share.TeamWorkspace.Owner.PaddleCurrentPeriodEnd > now)))
            .OrderByDescending(x => x.share.Project!.UpdatedAt)
            .Select(x => new
            {
                id = x.share.Project!.Id,
                name = x.share.Project.Name,
                path = x.share.Project.Path,
                framework = x.share.Project.Framework,
                architectureType = x.share.Project.ArchitectureType,
                databaseType = x.share.Project.DatabaseType,
                authSystem = x.share.Project.AuthSystem,
                lastScanned = x.share.Project.UpdatedAt,
                createdAt = x.share.Project.CreatedAt,
                isShared = true,
                teamId = (string?)x.share.TeamWorkspaceId,
                teamName = x.share.TeamWorkspace != null ? x.share.TeamWorkspace.Name : null,
                role = x.member.Role.ToString()
            })
            .ToListAsync();

        var projects = ownedProjects.Concat(sharedProjects)
            .OrderByDescending(p => p.lastScanned)
            .ToList();

        var ownedProjectCount = ownedProjects.Count;

        var maxProjects = PlanLimits.MaxProjects(user.Plan);
        var maxScans = PlanLimits.EffectiveMaxScans(user);

        var lastContextSize = 0;
        var lastProject = await _context.Projects
            .Where(p => p.UserId == user.Id)
            .SelectMany(p => p.AIContexts)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => c.Content.Length)
            .FirstOrDefaultAsync();
        if (lastProject > 0) lastContextSize = lastProject / 4;

        return Ok(new
        {
            projects,
            plan = new
            {
                name = user.Plan.ToString(),
                projectsUsed = ownedProjectCount,
                projectsLimit = maxProjects,
                scansUsed = user.ScanCount,
                scansLimit = maxScans,
                scansResetDate = user.ScanResetDate,
                aiRequestsUsed = user.AiRequestCount,
                aiRequestsLimit = PlanLimits.EffectiveMaxAiRequests(user),
                contextGenerationsUsed = user.ContextGenerationCount,
                contextGenerationsLimit = PlanLimits.EffectiveMaxContextGenerations(user),
                maxContextSizeTokens = PlanLimits.MaxContextSizeTokens(user.Plan),
                lastGeneratedContextSize = lastContextSize,
                contextCapacityPercent = PlanLimits.MaxContextSizeTokens(user.Plan) > 0
                    ? Math.Min(100.0, Math.Round(((double)lastContextSize / PlanLimits.MaxContextSizeTokens(user.Plan)) * 100, 1))
                    : 0.0
            }
        });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var projectCount = await _context.Projects.CountAsync(p => p.UserId == user.Id);
        var maxProjects = PlanLimits.MaxProjects(user.Plan);
        var maxScans = PlanLimits.EffectiveMaxScans(user);

        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            username = user.Username,
            plan = user.Plan.ToString(),
            role = user.Role.ToString(),
            isEmailVerified = user.IsEmailVerified,
            createdAt = user.CreatedAt,
            usage = new
            {
                projectsUsed = projectCount,
                projectsLimit = maxProjects,
                scansUsed = user.ScanCount,
                scansLimit = maxScans,
                scansResetDate = user.ScanResetDate,
                contextGenerationsUsed = user.ContextGenerationCount,
                contextGenerationsLimit = PlanLimits.EffectiveMaxContextGenerations(user),
                contextGenerationsResetDate = user.ContextResetDate,
                aiRequestsUsed = user.AiRequestCount,
                aiRequestsLimit = PlanLimits.EffectiveMaxAiRequests(user),
                aiRequestsResetDate = user.AiResetDate
            }
        });
    }

    [HttpPost("update-profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        bool changed = false;

        if (!string.IsNullOrWhiteSpace(request.Username))
        {
            var newUsername = request.Username.Trim().ToLowerInvariant();
            if (newUsername != user.Username)
            {
                if (newUsername.Length < 3 || newUsername.Length > 30 || !newUsername.All(char.IsLetterOrDigit))
                {
                    return BadRequest(new { error = "Username must be between 3 and 30 alphanumeric characters" });
                }

                var existing = await _context.Users.AnyAsync(u => u.Username == newUsername);
                if (existing)
                {
                    return Conflict(new { error = "Username is already taken" });
                }

                user.Username = newUsername;
                changed = true;
            }
        }

        if (!string.IsNullOrEmpty(request.Password))
        {
            if (request.Password.Length < 8)
            {
                return BadRequest(new { error = "Password must be at least 8 characters" });
            }

            user.PasswordHash = HashPassword(request.Password);
            changed = true;
        }

        if (changed)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(new
        {
            message = "Profile updated successfully",
            user = new
            {
                id = user.Id,
                email = user.Email,
                username = user.Username,
                plan = user.Plan.ToString(),
                role = user.Role.ToString()
            }
        });
    }

    private string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            100_000,
            HashAlgorithmName.SHA256,
            32);

        return $"pbkdf2$100000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    [HttpGet("plan-features")]
    public async Task<IActionResult> GetPlanFeatures()
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var projectCount = await _context.Projects.CountAsync(p => p.UserId == user.Id);

        return Ok(new
        {
            plan = user.Plan.ToString(),
            features = new
            {
                maxProjects = PlanLimits.MaxProjects(user.Plan),
                maxScansPerMonth = PlanLimits.EffectiveMaxScans(user),
                maxContextSize = PlanLimits.MaxContextSizeTokens(user.Plan),
                contextHistory = PlanLimits.HasContextHistory(user.Plan),
                priorityAI = PlanLimits.HasPriorityAI(user.Plan),
                apiAccess = PlanLimits.HasApiAccess(user.Plan),
                ideExport = PlanLimits.HasIdeExport(user.Plan),
                teamWorkspace = PlanLimits.HasTeamWorkspace(user.Plan),
                maxTeamMembers = PlanLimits.MaxTeamMembers(user.Plan),
            },
            usage = new
            {
                projectsUsed = projectCount,
                scansUsed = user.ScanCount,
                scansResetDate = user.ScanResetDate,
                contextGenerationsUsed = user.ContextGenerationCount,
                contextGenerationsLimit = PlanLimits.EffectiveMaxContextGenerations(user),
                contextGenerationsResetDate = user.ContextResetDate,
                aiRequestsUsed = user.AiRequestCount,
                aiRequestsLimit = PlanLimits.EffectiveMaxAiRequests(user),
                aiRequestsResetDate = user.AiResetDate
            }
        });
    }

    [HttpGet("plan-status")]
    public async Task<IActionResult> GetPlanStatus()
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var status = await BuildPlanStatusAsync(user);
        return Ok(status);
    }

    private async Task<PlanStatusDto> BuildPlanStatusAsync(User user)
    {
        // Reset monthly counters if needed
        var now = DateTime.UtcNow;
        bool changed = false;
        if (now > user.ScanResetDate)
        {
            user.ScanCount = 0;
            user.ScanResetDate = now.AddMonths(1);
            changed = true;
        }
        if (now > user.ContextResetDate)
        {
            user.ContextGenerationCount = 0;
            user.ContextResetDate = now.AddMonths(1);
            changed = true;
        }
        if (now > user.AiResetDate)
        {
            user.AiRequestCount = 0;
            user.AiResetDate = now.AddMonths(1);
            changed = true;
        }
        if (changed) await _context.SaveChangesAsync();

        var projectCount = await _context.Projects.CountAsync(p => p.UserId == user.Id);
        var maxProjects = PlanLimits.MaxProjects(user.Plan);
        var maxRefreshes = PlanLimits.EffectiveMaxContextGenerations(user);
        var maxAI = PlanLimits.EffectiveMaxAiRequests(user);
        var maxContext = PlanLimits.MaxContextSizeTokens(user.Plan);

        // Get the last generated context size (character count / 4 ≈ tokens)
        var lastContextSize = 0;
        var lastProject = await _context.Projects
            .Where(p => p.UserId == user.Id)
            .SelectMany(p => p.AIContexts)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => c.Content.Length)
            .FirstOrDefaultAsync();
        if (lastProject > 0) lastContextSize = lastProject / 4;

        // Nearest reset date
        var nextReset = new[] { user.ScanResetDate, user.ContextResetDate, user.AiResetDate }.Min();

        return new PlanStatusDto
        {
            CurrentPlan = user.Plan.ToString(),
            MaxProjects = maxProjects,
            CurrentProjects = projectCount,
            MaxContextRefreshes = maxRefreshes,
            UsedContextRefreshes = user.ContextGenerationCount,
            RemainingContextRefreshes = Math.Max(0, maxRefreshes - user.ContextGenerationCount),
            MaxAIRequests = maxAI,
            UsedAIRequests = user.AiRequestCount,
            RemainingAIRequests = Math.Max(0, maxAI - user.AiRequestCount),
            MaxContextSize = maxContext,
            LastGeneratedContextSize = lastContextSize,
            ContextCapacityPercent = maxContext > 0
                ? Math.Min(100.0, Math.Round(((double)lastContextSize / maxContext) * 100, 1))
                : 0.0,
            NextResetDate = nextReset,
            CanGenerateContext = projectCount < maxProjects && user.ContextGenerationCount < maxRefreshes,
            CanRefreshContext = user.ScanCount < PlanLimits.EffectiveMaxScans(user),
            CanUseAI = user.AiRequestCount < maxAI
        };
    }

    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity([FromQuery] int limit = 20)
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var activities = await _context.ActivityLogs
            .Where(a => a.UserId == user.Id)
            .OrderByDescending(a => a.CreatedAt)
            .Take(Math.Min(limit, 50))
            .Select(a => new
            {
                a.Id,
                a.Action,
                a.ProjectName,
                a.Details,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(new { activities });
    }

    [HttpGet("connected-ides")]
    public async Task<IActionResult> GetConnectedIdes()
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var connections = await _context.ExtensionAuths
            .Where(e => e.UserId == user.Id)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();

        var result = connections.Select(c =>
        {
            var editor = "VS Code";
            var parts = c.Token.Split('_');
            if (parts.Length > 1)
            {
                var prefix = parts[0].ToLower();
                editor = prefix switch
                {
                    "vscode" => "VS Code",
                    "cursor" => "Cursor",
                    "windsurf" => "Windsurf",
                    _ => prefix.Substring(0, 1).ToUpper() + prefix.Substring(1)
                };
            }
            return new
            {
                id = c.Id,
                editor,
                createdAt = c.CreatedAt,
                expiresAt = c.ExpiresAt,
                isActive = c.ExpiresAt > DateTime.UtcNow
            };
        }).ToList();

        return Ok(new { connections = result });
    }

    [HttpDelete("connected-ides/{id}")]
    public async Task<IActionResult> RevokeConnectedIde(string id)
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var conn = await _context.ExtensionAuths.FirstOrDefaultAsync(e => e.Id == id && e.UserId == user.Id);
        if (conn == null)
        {
            return NotFound(new { error = "Connection not found" });
        }

        _context.ExtensionAuths.Remove(conn);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Connection revoked successfully" });
    }

    [HttpGet("scans")]
    public async Task<IActionResult> GetScans([FromQuery] int limit = 20)
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var ownedProjectIds = await _context.Projects
            .Where(p => p.UserId == user.Id)
            .Select(p => p.Id)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var sharedProjectIds = await _context.ProjectShares
            .Include(s => s.TeamWorkspace)
                .ThenInclude(t => t!.Owner)
            .Join(_context.TeamMembers,
                share => share.TeamWorkspaceId,
                member => member.TeamWorkspaceId,
                (share, member) => new { share, member })
            .Where(x => x.member.UserId == user.Id
                && x.share.TeamWorkspace != null
                && x.share.TeamWorkspace.Owner != null
                && x.share.TeamWorkspace.Owner.Plan == UserPlan.Team
                && (x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == null
                    || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "active"
                    || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "trialing"
                    || ((x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "canceled"
                            || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "cancelled"
                            || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "past_due")
                        && x.share.TeamWorkspace.Owner.PaddleCurrentPeriodEnd != null
                        && x.share.TeamWorkspace.Owner.PaddleCurrentPeriodEnd > now)))
            .Select(x => x.share.ProjectId)
            .ToListAsync();

        var projectIds = ownedProjectIds.Concat(sharedProjectIds).Distinct().ToList();

        var scans = await _context.ProjectScans
            .Where(s => projectIds.Contains(s.ProjectId))
            .OrderByDescending(s => s.ScanDate)
            .Take(Math.Min(limit, 100))
            .Select(s => new
            {
                id = s.Id,
                scanDate = s.ScanDate,
                framework = s.Framework,
                architectureType = s.ArchitectureType,
                filesCount = s.FilesCount,
                linesOfCode = s.LinesOfCode,
                projectName = s.Project != null ? s.Project.Name : "Unknown"
            })
            .ToListAsync();

        return Ok(new { scans });
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportData()
    {
        var token = Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
        var user = await GetUserFromTokenAsync(token);
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var ownedProjectIds = await _context.Projects
            .Where(p => p.UserId == user.Id)
            .Select(p => p.Id)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var sharedProjectIds = await _context.ProjectShares
            .Include(s => s.TeamWorkspace)
                .ThenInclude(t => t!.Owner)
            .Join(_context.TeamMembers,
                share => share.TeamWorkspaceId,
                member => member.TeamWorkspaceId,
                (share, member) => new { share, member })
            .Where(x => x.member.UserId == user.Id
                && x.share.TeamWorkspace != null
                && x.share.TeamWorkspace.Owner != null
                && x.share.TeamWorkspace.Owner.Plan == UserPlan.Team
                && (x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == null
                    || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "active"
                    || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "trialing"
                    || ((x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "canceled"
                            || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "cancelled"
                            || x.share.TeamWorkspace.Owner.PaddleSubscriptionStatus == "past_due")
                        && x.share.TeamWorkspace.Owner.PaddleCurrentPeriodEnd != null
                        && x.share.TeamWorkspace.Owner.PaddleCurrentPeriodEnd > now)))
            .Select(x => x.share.ProjectId)
            .ToListAsync();

        var accessibleProjectIds = ownedProjectIds.Concat(sharedProjectIds).Distinct().ToList();

        var projects = await _context.Projects
            .Where(p => accessibleProjectIds.Contains(p.Id))
            .Include(p => p.ArchitectureRules)
            .Include(p => p.CodingConventions)
            .Include(p => p.SystemDecisions)
            .Include(p => p.Scans)
            .Include(p => p.AIContexts)
            .ToListAsync();

        var payload = new
        {
            exportedAt = DateTime.UtcNow,
            user = new { user.Id, user.Email, plan = user.Plan.ToString(), user.CreatedAt },
            projects = projects.Select(p => new
            {
                p.Id,
                p.Name,
                p.Path,
                p.Framework,
                p.ArchitectureType,
                p.DatabaseType,
                p.AuthSystem,
                p.SemanticSummary,
                p.ScanFingerprint,
                p.CreatedAt,
                p.UpdatedAt,
                architectureRules = p.ArchitectureRules.Select(r => new { r.Name, r.Pattern, r.Description, r.FolderPath, r.IsActive, r.CreatedAt }),
                codingConventions = p.CodingConventions.Select(c => new { c.Name, c.Rule, c.Example, c.Language, c.IsActive, c.CreatedAt }),
                systemDecisions = p.SystemDecisions.Select(d => new { d.Title, d.Decision, d.Reasoning, d.Category, d.DecisionDate }),
                scans = p.Scans.OrderByDescending(s => s.ScanDate).Select(s => new { s.ScanDate, s.Framework, s.ArchitectureType, s.FilesCount, s.LinesOfCode, s.ScanFingerprint, s.SemanticSummary }),
                contexts = p.AIContexts.OrderByDescending(c => c.CreatedAt).Select(c => new { c.Id, c.CreatedAt, c.Content })
            })
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
        var bytes = Encoding.UTF8.GetBytes(json);
        var fileName = $"ai-context-brain-export-{DateTime.UtcNow:yyyyMMddHHmmss}.json";

        return File(bytes, "application/json", fileName);
    }
}

public class UpdateProfileRequest
{
    public string? Username { get; set; }
    public string? Password { get; set; }
}
