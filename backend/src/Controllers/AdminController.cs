using AiContextBrain.Data;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class AdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IEmailService _emailService;

    public AdminController(ApplicationDbContext context, IEmailService emailService)
    {
        _context = context;
        _emailService = emailService;
    }

    // ============ OVERVIEW ============

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var usersByPlan = await _context.Users
            .Where(u => !u.IsDeleted)
            .GroupBy(u => u.Plan)
            .Select(g => new { plan = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        var usersByRole = await _context.Users
            .Where(u => !u.IsDeleted)
            .GroupBy(u => u.Role)
            .Select(g => new { role = g.Key.ToString(), count = g.Count() })
            .ToListAsync();

        var feedbackByCategory = await _context.Feedbacks
            .GroupBy(f => f.Category)
            .Select(g => new { category = g.Key, count = g.Count(), averageRating = Math.Round(g.Average(f => f.Rating), 2) })
            .ToListAsync();

        var recentActivity = await BuildActivityQuery()
            .OrderByDescending(x => x.CreatedAt)
            .Take(8)
            .ToListAsync();

        var recentFeedback = await BuildFeedbackQuery()
            .OrderByDescending(x => x.CreatedAt)
            .Take(8)
            .ToListAsync();

        var totalUsers = await _context.Users.CountAsync(u => !u.IsDeleted);
        var bannedUsers = await _context.Users.CountAsync(u => u.IsBanned && !u.IsDeleted);
        var tempEmailUsers = await _context.Users.CountAsync(u => u.IsTempEmail && !u.IsDeleted);

        return Ok(new
        {
            generatedAt = now,
            totals = new
            {
                users = totalUsers,
                verifiedUsers = await _context.Users.CountAsync(u => u.IsEmailVerified && !u.IsDeleted),
                bannedUsers,
                tempEmailUsers,
                projects = await _context.Projects.CountAsync(),
                projectScans = await _context.ProjectScans.CountAsync(),
                optimizedContexts = await _context.AIContexts.CountAsync(),
                feedback = await _context.Feedbacks.CountAsync(),
                activityLogs = await _context.ActivityLogs.CountAsync(),
                auditLogs = await _context.AuditLogs.CountAsync(),
                emailLogs = await _context.EmailLogs.CountAsync(),
                activeIdeConnections = await _context.ExtensionAuths.CountAsync(e => e.ExpiresAt > now),
                newUsersThisMonth = await _context.Users.CountAsync(u => u.CreatedAt >= monthStart && !u.IsDeleted),
                scansThisMonth = await _context.ActivityLogs.CountAsync(a => a.Action == "scan" && a.CreatedAt >= monthStart),
                contextsThisMonth = await _context.ActivityLogs.CountAsync(a => a.Action == "generate_context" && a.CreatedAt >= monthStart)
            },
            usersByPlan,
            usersByRole,
            feedbackByCategory,
            recentActivity,
            recentFeedback
        });
    }

    // ============ USER MANAGEMENT ============

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] string? plan = null,
        [FromQuery] string? role = null,
        [FromQuery] string? verified = null,
        [FromQuery] string? banned = null,
        [FromQuery] string? tempEmail = null,
        [FromQuery] int limit = 100)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var query = _context.Users.AsNoTracking().Where(u => !u.IsDeleted).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.Trim().ToLowerInvariant();
            query = query.Where(u => u.Email.ToLower().Contains(lowered) || u.Id.ToLower().Contains(lowered) || u.Username.ToLower().Contains(lowered));
        }

        if (Enum.TryParse<UserPlan>(plan, ignoreCase: true, out var parsedPlan))
            query = query.Where(u => u.Plan == parsedPlan);

        if (Enum.TryParse<UserRole>(role, ignoreCase: true, out var parsedRole))
            query = query.Where(u => u.Role == parsedRole);

        if (verified == "true") query = query.Where(u => u.IsEmailVerified);
        else if (verified == "false") query = query.Where(u => !u.IsEmailVerified);

        if (banned == "true") query = query.Where(u => u.IsBanned);
        else if (banned == "false") query = query.Where(u => !u.IsBanned);

        if (tempEmail == "true") query = query.Where(u => u.IsTempEmail);
        else if (tempEmail == "false") query = query.Where(u => !u.IsTempEmail);

        var take = Math.Clamp(limit, 1, 250);
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Take(take)
            .Select(u => new
            {
                id = u.Id,
                email = u.Email,
                username = u.Username,
                role = u.Role.ToString(),
                plan = u.Plan.ToString(),
                isEmailVerified = u.IsEmailVerified,
                isBanned = u.IsBanned,
                banReason = u.BanReason,
                bannedAt = u.BannedAt,
                isTempEmail = u.IsTempEmail,
                trustScore = u.TrustScore,
                adminNotes = u.AdminNotes,
                createdAt = u.CreatedAt,
                lastLoginAt = u.LastLoginAt,
                lastActivityAt = u.LastActivityAt,
                registrationSource = u.RegistrationSource,
                country = u.Country,
                subscriptionStatus = u.PaddleSubscriptionStatus,
                subscriptionId = u.PaddleSubscriptionId,
                currentPeriodEnd = u.PaddleCurrentPeriodEnd,
                scanResetDate = u.ScanResetDate,
                scanLimitOverride = u.ScanLimitOverride,
                contextLimitOverride = u.ContextLimitOverride,
                aiRequestLimitOverride = u.AiRequestLimitOverride,
                usage = new
                {
                    scans = u.ScanCount,
                    scanLimit = u.ScanLimitOverride ?? PlanLimits.MaxScansPerMonth(u.Plan),
                    contexts = u.ContextGenerationCount,
                    contextLimit = u.ContextLimitOverride ?? PlanLimits.MaxContextGenerationsPerMonth(u.Plan),
                    aiRequests = u.AiRequestCount,
                    aiRequestLimit = u.AiRequestLimitOverride ?? PlanLimits.MaxAiRequestsPerMonth(u.Plan)
                },
                counts = new
                {
                    projects = _context.Projects.Count(p => p.UserId == u.Id),
                    feedback = _context.Feedbacks.Count(f => f.UserId == u.Id),
                    ideConnections = _context.ExtensionAuths.Count(e => e.UserId == u.Id && e.ExpiresAt > DateTime.UtcNow),
                    teamMemberships = _context.TeamMembers.Count(m => m.UserId == u.Id)
                }
            })
            .ToListAsync();

        return Ok(new { users, count = users.Count });
    }

    [HttpGet("users/{userId}")]
    public async Task<IActionResult> GetUserDetail(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var u = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);
        if (u == null) return NotFound(new { error = "User not found." });

        var projectCount = await _context.Projects.CountAsync(p => p.UserId == userId);
        var feedbackCount = await _context.Feedbacks.CountAsync(f => f.UserId == userId);
        var ideConnections = await _context.ExtensionAuths.CountAsync(e => e.UserId == userId && e.ExpiresAt > DateTime.UtcNow);
        var teamMemberships = await _context.TeamMembers.CountAsync(m => m.UserId == userId);
        var activityCount = await _context.ActivityLogs.CountAsync(a => a.UserId == userId);
        var recentActivity = await _context.ActivityLogs.Where(a => a.UserId == userId).OrderByDescending(a => a.CreatedAt).Take(10).ToListAsync();
        var auditHistory = await _context.AuditLogs.Where(a => a.TargetUserId == userId).OrderByDescending(a => a.CreatedAt).Take(20).ToListAsync();

        return Ok(new
        {
            id = u.Id, email = u.Email, username = u.Username,
            role = u.Role.ToString(), plan = u.Plan.ToString(),
            isEmailVerified = u.IsEmailVerified,
            isBanned = u.IsBanned, banReason = u.BanReason, bannedAt = u.BannedAt,
            isDeleted = u.IsDeleted, deletedAt = u.DeletedAt,
            isTempEmail = u.IsTempEmail, trustScore = u.TrustScore,
            adminNotes = u.AdminNotes,
            createdAt = u.CreatedAt, lastLoginAt = u.LastLoginAt, lastActivityAt = u.LastActivityAt,
            registrationSource = u.RegistrationSource, country = u.Country,
            subscriptionStatus = u.PaddleSubscriptionStatus,
            subscriptionId = u.PaddleSubscriptionId,
            currentPeriodEnd = u.PaddleCurrentPeriodEnd,
            scanResetDate = u.ScanResetDate,
            scanLimitOverride = u.ScanLimitOverride,
            contextLimitOverride = u.ContextLimitOverride,
            aiRequestLimitOverride = u.AiRequestLimitOverride,
            usage = new
            {
                scans = u.ScanCount, scanLimit = u.ScanLimitOverride ?? PlanLimits.MaxScansPerMonth(u.Plan),
                contexts = u.ContextGenerationCount, contextLimit = u.ContextLimitOverride ?? PlanLimits.MaxContextGenerationsPerMonth(u.Plan),
                aiRequests = u.AiRequestCount, aiRequestLimit = u.AiRequestLimitOverride ?? PlanLimits.MaxAiRequestsPerMonth(u.Plan)
            },
            counts = new { projects = projectCount, feedback = feedbackCount, ideConnections, teamMemberships, activityLogs = activityCount },
            recentActivity,
            auditHistory
        });
    }

    // ============ ADMIN ACTIONS ============

    [HttpPost("users/{userId}/ban")]
    public async Task<IActionResult> BanUser(string userId, [FromBody] BanRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });
        if (target.Role == UserRole.Admin) return BadRequest(new { error = "Cannot ban admin users." });

        target.IsBanned = true;
        target.BanReason = request.Reason ?? "Banned by admin";
        target.BannedAt = DateTime.UtcNow;
        target.ApiToken = null;
        target.RefreshTokenHash = null;
        target.RefreshTokenExpiresAt = null;

        await LogAudit(admin.User!.Id, "ban_user", userId, $"Reason: {target.BanReason}");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"User {target.Email} has been banned." });
    }

    [HttpPost("users/{userId}/unban")]
    public async Task<IActionResult> UnbanUser(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        target.IsBanned = false;
        target.BanReason = null;
        target.BannedAt = null;

        await LogAudit(admin.User!.Id, "unban_user", userId, null);
        await _context.SaveChangesAsync();
        return Ok(new { message = $"User {target.Email} has been unbanned." });
    }

    [HttpPost("users/{userId}/role")]
    public async Task<IActionResult> UpdateRole(string userId, [FromBody] UpdateRoleRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var newRole))
            return BadRequest(new { error = "Invalid role. Use 'User' or 'Admin'." });

        var oldRole = target.Role.ToString();
        target.Role = newRole;

        await LogAudit(admin.User!.Id, "update_role", userId, $"{oldRole} → {newRole}");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"User {target.Email} role updated to {newRole}." });
    }

    [HttpPost("users/{userId}/plan")]
    public async Task<IActionResult> UpdatePlan(string userId, [FromBody] UpdatePlanRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        if (!Enum.TryParse<UserPlan>(request.Plan, ignoreCase: true, out var newPlan))
            return BadRequest(new { error = "Invalid plan. Use 'Free', 'Pro', or 'Team'." });

        var oldPlan = target.Plan.ToString();
        target.Plan = newPlan;

        await LogAudit(admin.User!.Id, "update_plan", userId, $"{oldPlan} → {newPlan}");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"User {target.Email} plan updated to {newPlan}." });
    }

    [HttpPost("users/{userId}/reset-usage")]
    public async Task<IActionResult> ResetUsage(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        target.ScanCount = 0;
        target.ContextGenerationCount = 0;
        target.AiRequestCount = 0;
        target.ScanResetDate = DateTime.UtcNow.AddMonths(1);
        target.ContextResetDate = DateTime.UtcNow.AddMonths(1);
        target.AiResetDate = DateTime.UtcNow.AddMonths(1);

        await LogAudit(admin.User!.Id, "reset_usage", userId, "All usage counters zeroed");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Usage counters reset for {target.Email}." });
    }

    [HttpPost("users/{userId}/force-logout")]
    public async Task<IActionResult> ForceLogout(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        target.ApiToken = null;
        target.RefreshTokenHash = null;
        target.RefreshTokenExpiresAt = null;

        // Also revoke all extension tokens
        var extAuths = await _context.ExtensionAuths.Where(e => e.UserId == userId).ToListAsync();
        _context.ExtensionAuths.RemoveRange(extAuths);

        await LogAudit(admin.User!.Id, "force_logout", userId, $"Revoked {extAuths.Count} extension tokens");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"User {target.Email} has been logged out from all sessions." });
    }

    [HttpPost("users/{userId}/revoke-api-key")]
    public async Task<IActionResult> RevokeApiKey(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        target.ApiToken = null;

        await LogAudit(admin.User!.Id, "revoke_api_key", userId, null);
        await _context.SaveChangesAsync();
        return Ok(new { message = $"API key revoked for {target.Email}." });
    }

    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> SoftDeleteUser(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });
        if (target.Role == UserRole.Admin) return BadRequest(new { error = "Cannot delete admin users." });

        target.IsDeleted = true;
        target.DeletedAt = DateTime.UtcNow;
        target.ApiToken = null;
        target.RefreshTokenHash = null;
        target.RefreshTokenExpiresAt = null;

        await LogAudit(admin.User!.Id, "delete_user", userId, $"Soft-deleted user {target.Email}");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"User {target.Email} has been soft-deleted." });
    }

    [HttpPost("users/{userId}/verify-email")]
    public async Task<IActionResult> AdminVerifyEmail(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        target.IsEmailVerified = true;
        target.EmailVerificationToken = null;
        target.EmailVerificationTokenExpiresAt = null;

        await LogAudit(admin.User!.Id, "verify_email", userId, "Admin-forced email verification");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Email verified for {target.Email}." });
    }

    [HttpPost("users/{userId}/resend-verification")]
    public async Task<IActionResult> AdminResendVerification(string userId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });
        if (target.IsEmailVerified) return BadRequest(new { error = "Email already verified." });

        var verifyToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        target.EmailVerificationToken = verifyToken;
        target.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddDays(1);
        await _context.SaveChangesAsync();

        var webUrl = "https://aicontextbrain.me";
        var verificationLink = $"{webUrl}/verify-email?token={verifyToken}";

        try
        {
            await _emailService.SendVerificationEmailAsync(target.Email, verificationLink);
            await LogAudit(admin.User!.Id, "resend_verification", userId, null);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Failed to send: {ex.Message}" });
        }

        return Ok(new { message = $"Verification email resent to {target.Email}." });
    }

    [HttpPost("users/{userId}/notes")]
    public async Task<IActionResult> UpdateAdminNotes(string userId, [FromBody] AdminNotesRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        target.AdminNotes = request.Notes;
        await LogAudit(admin.User!.Id, "update_notes", userId, null);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Admin notes updated." });
    }

    [HttpPost("users/{userId}/trust-score")]
    public async Task<IActionResult> UpdateTrustScore(string userId, [FromBody] TrustScoreRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        var oldScore = target.TrustScore;
        target.TrustScore = Math.Clamp(request.Score, 0, 100);

        await LogAudit(admin.User!.Id, "update_trust", userId, $"{oldScore} → {target.TrustScore}");
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Trust score updated to {target.TrustScore}." });
    }

    [HttpPost("users/{userId}/limit-override")]
    public async Task<IActionResult> SetLimitOverride(string userId, [FromBody] LimitOverrideRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (target == null) return NotFound(new { error = "User not found." });

        if (request.ScanLimit.HasValue) target.ScanLimitOverride = request.ScanLimit.Value > 0 ? request.ScanLimit.Value : null;
        if (request.ContextLimit.HasValue) target.ContextLimitOverride = request.ContextLimit.Value > 0 ? request.ContextLimit.Value : null;
        if (request.AiRequestLimit.HasValue) target.AiRequestLimitOverride = request.AiRequestLimit.Value > 0 ? request.AiRequestLimit.Value : null;

        await LogAudit(admin.User!.Id, "limit_override", userId, $"Scan={target.ScanLimitOverride}, Ctx={target.ContextLimitOverride}, AI={target.AiRequestLimitOverride}");
        await _context.SaveChangesAsync();
        return Ok(new { message = "Limit overrides updated." });
    }

    // ============ ACTIVITY LOGS ============

    [HttpGet("activity")]
    public async Task<IActionResult> GetActivity(
        [FromQuery] string? action = null,
        [FromQuery] string? search = null,
        [FromQuery] int limit = 100)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var query = BuildActivityQuery();

        if (!string.IsNullOrWhiteSpace(action) && action != "all")
        {
            query = query.Where(a => a.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.Trim().ToLowerInvariant();
            query = query.Where(a =>
                a.UserEmail.ToLower().Contains(lowered) ||
                a.ProjectName.ToLower().Contains(lowered) ||
                (a.Details != null && a.Details.ToLower().Contains(lowered)));
        }

        var activity = await query
            .OrderByDescending(a => a.CreatedAt)
            .Take(Math.Clamp(limit, 1, 250))
            .ToListAsync();

        return Ok(new { activity, count = activity.Count });
    }

    // ============ AUDIT LOGS ============

    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? action = null,
        [FromQuery] string? search = null,
        [FromQuery] int limit = 100)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var query = _context.AuditLogs.AsNoTracking()
            .GroupJoin(_context.Users.AsNoTracking(), a => a.AdminUserId, u => u.Id, (a, users) => new { a, users })
            .SelectMany(x => x.users.DefaultIfEmpty(), (x, adminUser) => new { x.a, adminUser })
            .GroupJoin(_context.Users.AsNoTracking(), x => x.a.TargetUserId, u => u.Id, (x, targets) => new { x.a, x.adminUser, targets })
            .SelectMany(x => x.targets.DefaultIfEmpty(), (x, targetUser) => new
            {
                x.a.Id,
                x.a.AdminUserId,
                adminEmail = x.adminUser != null ? x.adminUser.Email : "Unknown",
                x.a.Action,
                x.a.TargetUserId,
                targetEmail = targetUser != null ? targetUser.Email : "Unknown",
                x.a.Details,
                x.a.CreatedAt
            });

        if (!string.IsNullOrWhiteSpace(action) && action != "all")
            query = query.Where(a => a.Action == action);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lowered = search.Trim().ToLowerInvariant();
            query = query.Where(a => a.adminEmail.ToLower().Contains(lowered) || a.targetEmail.ToLower().Contains(lowered));
        }

        var logs = await query.OrderByDescending(a => a.CreatedAt).Take(Math.Clamp(limit, 1, 250)).ToListAsync();
        return Ok(new { auditLogs = logs, count = logs.Count });
    }

    // ============ EMAIL LOGS ============

    [HttpGet("email-logs")]
    public async Task<IActionResult> GetEmailLogs(
        [FromQuery] string? type = null,
        [FromQuery] string? status = null,
        [FromQuery] int limit = 100)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var query = _context.EmailLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(type) && type != "all")
            query = query.Where(e => e.EmailType == type);

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
            query = query.Where(e => e.Status == status);

        var logs = await query.OrderByDescending(e => e.CreatedAt).Take(Math.Clamp(limit, 1, 250)).ToListAsync();
        return Ok(new { emailLogs = logs, count = logs.Count });
    }

    // ============ FEEDBACK MANAGEMENT ============

    [HttpGet("feedback")]
    public async Task<IActionResult> GetFeedback(
        [FromQuery] string? category = null,
        [FromQuery] string? status = null,
        [FromQuery] string? priority = null,
        [FromQuery] int limit = 100)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var query = BuildFeedbackQuery();
        if (!string.IsNullOrWhiteSpace(category) && category != "all")
            query = query.Where(f => f.Category.ToLower() == category.ToLower());
        if (!string.IsNullOrWhiteSpace(status) && status != "all")
            query = query.Where(f => f.Status.ToLower() == status.ToLower());
        if (!string.IsNullOrWhiteSpace(priority) && priority != "all")
            query = query.Where(f => f.Priority.ToLower() == priority.ToLower());

        var feedback = await query
            .OrderByDescending(f => f.CreatedAt)
            .Take(Math.Clamp(limit, 1, 250))
            .ToListAsync();

        return Ok(new { feedback, feedbacks = feedback, count = feedback.Count });
    }

    [HttpPost("feedback/{feedbackId}/status")]
    public async Task<IActionResult> UpdateFeedbackStatus(string feedbackId, [FromBody] UpdateFeedbackRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var fb = await _context.Feedbacks.FirstOrDefaultAsync(f => f.Id == feedbackId);
        if (fb == null) return NotFound(new { error = "Feedback not found." });

        if (!string.IsNullOrWhiteSpace(request.Status)) fb.Status = request.Status;
        if (!string.IsNullOrWhiteSpace(request.Priority)) fb.Priority = request.Priority;
        if (request.AdminNote != null) fb.AdminNote = request.AdminNote;
        if (request.RelatedFeature != null) fb.RelatedFeature = request.RelatedFeature;

        await LogAudit(admin.User!.Id, "update_feedback", fb.UserId ?? "system", $"Feedback {feedbackId}: status={fb.Status}, priority={fb.Priority}");
        await _context.SaveChangesAsync();
        return Ok(new { message = "Feedback updated." });
    }

    // ============ DISPOSABLE DOMAINS ============

    [HttpGet("disposable-domains")]
    public async Task<IActionResult> GetDisposableDomains()
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var domains = await _context.DisposableDomains.AsNoTracking().OrderBy(d => d.Domain).ToListAsync();
        return Ok(new { domains, count = domains.Count });
    }

    [HttpPost("disposable-domains")]
    public async Task<IActionResult> AddDisposableDomain([FromBody] AddDomainRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var domain = request.Domain?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(domain)) return BadRequest(new { error = "Domain is required." });

        var exists = await _context.DisposableDomains.AnyAsync(d => d.Domain == domain);
        if (exists) return Conflict(new { error = "Domain already exists." });

        _context.DisposableDomains.Add(new DisposableDomain { Domain = domain });
        await _context.SaveChangesAsync();

        // Flag existing users with this domain
        var affectedUsers = await _context.Users.Where(u => u.Email.EndsWith("@" + domain)).ToListAsync();
        foreach (var u in affectedUsers) u.IsTempEmail = true;
        if (affectedUsers.Any()) await _context.SaveChangesAsync();

        return Ok(new { message = $"Domain '{domain}' added. {affectedUsers.Count} users flagged." });
    }

    [HttpDelete("disposable-domains/{domainId}")]
    public async Task<IActionResult> RemoveDisposableDomain(string domainId)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var domain = await _context.DisposableDomains.FirstOrDefaultAsync(d => d.Id == domainId);
        if (domain == null) return NotFound(new { error = "Domain not found." });

        _context.DisposableDomains.Remove(domain);
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Domain '{domain.Domain}' removed." });
    }

    // ============ EMAIL DIAGNOSTICS ============

    [HttpPost("email/test")]
    public async Task<IActionResult> TestEmail([FromBody] TestEmailRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        if (string.IsNullOrEmpty(request.RecipientEmail))
        {
            return BadRequest(new { error = "Recipient email is required." });
        }

        try
        {
            // Send a test security/diagnostic email
            await _emailService.SendSecurityAlertEmailAsync(
                request.RecipientEmail,
                "AI Context Brain Email Diagnostics",
                "This is a production diagnostic email sent from the admin console to verify Resend API delivery."
            );
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Email test failed: {ex.Message}" });
        }

        return Ok(new { message = $"Test email sent successfully to {request.RecipientEmail} via Resend." });
    }

    // ============ ANALYTICS SETTINGS ============

    [HttpGet("analytics-config")]
    public async Task<IActionResult> GetAnalyticsConfig()
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var settings = await _context.AnalyticsSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == "global");
        return Ok(new
        {
            enabled = settings?.Enabled ?? false,
            gaId = settings?.GoogleAnalyticsId ?? string.Empty,
            clarityId = settings?.ClarityId ?? string.Empty
        });
    }

    [HttpPut("analytics-config")]
    public async Task<IActionResult> UpdateAnalyticsConfig([FromBody] AnalyticsConfigRequest request)
    {
        var admin = await GetAdminUserAsync();
        if (admin.Result != null) return admin.Result;

        var gaId = request.GaId?.Trim();
        var clarityId = request.ClarityId?.Trim();
        if (!string.IsNullOrEmpty(gaId) && !System.Text.RegularExpressions.Regex.IsMatch(gaId, "^G-[A-Z0-9]+$"))
        {
            return BadRequest(new { error = "invalid_ga_id", message = "Google Analytics ID must use the G-XXXXXXXX format." });
        }
        if (clarityId?.Length > 100)
        {
            return BadRequest(new { error = "invalid_clarity_id", message = "Clarity project ID is too long." });
        }

        var settings = await _context.AnalyticsSettings.FirstOrDefaultAsync(s => s.Id == "global");
        if (settings == null)
        {
            settings = new AnalyticsSettings { Id = "global" };
            _context.AnalyticsSettings.Add(settings);
        }

        settings.Enabled = request.Enabled;
        settings.GoogleAnalyticsId = string.IsNullOrWhiteSpace(gaId) ? null : gaId;
        settings.ClarityId = string.IsNullOrWhiteSpace(clarityId) ? null : clarityId;
        settings.UpdatedAt = DateTime.UtcNow;
        await LogAudit(admin.User!.Id, "update_analytics", "system", $"enabled={settings.Enabled}");
        await _context.SaveChangesAsync();

        return Ok(new { enabled = settings.Enabled, gaId = settings.GoogleAnalyticsId ?? "", clarityId = settings.ClarityId ?? "" });
    }

    // ============ HELPERS ============

    private async Task LogAudit(string adminUserId, string action, string targetUserId, string? details)
    {
        _context.AuditLogs.Add(new AuditLog
        {
            AdminUserId = adminUserId,
            Action = action,
            TargetUserId = targetUserId,
            Details = details
        });
        await _context.SaveChangesAsync();
    }

    private async Task<(User? User, IActionResult? Result)> GetAdminUserAsync()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader))
        {
            return (null, Unauthorized(new { error = "Authorization token is missing." }));
        }

        var user = await _context.ResolveUserFromBearerTokenAsync(authHeader);
        if (user == null)
        {
            return (null, Unauthorized(new { error = "Invalid token." }));
        }

        if (user.Role != UserRole.Admin)
        {
            return (null, Forbid());
        }

        return (user, null);
    }

    private IQueryable<AdminActivityItem> BuildActivityQuery()
    {
        return _context.ActivityLogs
            .AsNoTracking()
            .GroupJoin(
                _context.Users.AsNoTracking(),
                activity => activity.UserId,
                user => user.Id,
                (activity, users) => new { activity, users })
            .SelectMany(
                x => x.users.DefaultIfEmpty(),
                (x, user) => new AdminActivityItem
                {
                    Id = x.activity.Id,
                    UserId = x.activity.UserId,
                    UserEmail = user != null ? user.Email : "Unknown user",
                    Action = x.activity.Action,
                    ProjectId = x.activity.ProjectId,
                    ProjectName = x.activity.ProjectName,
                    Details = x.activity.Details,
                    CreatedAt = x.activity.CreatedAt
                });
    }

    private IQueryable<AdminFeedbackItem> BuildFeedbackQuery()
    {
        return _context.Feedbacks
            .AsNoTracking()
            .GroupJoin(
                _context.Users.AsNoTracking(),
                feedback => feedback.UserId,
                user => user.Id,
                (feedback, users) => new { feedback, users })
            .SelectMany(
                x => x.users.DefaultIfEmpty(),
                (x, user) => new AdminFeedbackItem
                {
                    Id = x.feedback.Id,
                    Content = x.feedback.Content,
                    Rating = x.feedback.Rating,
                    Category = x.feedback.Category,
                    Status = x.feedback.Status,
                    Priority = x.feedback.Priority,
                    AdminNote = x.feedback.AdminNote,
                    RelatedFeature = x.feedback.RelatedFeature,
                    CreatedAt = x.feedback.CreatedAt,
                    UserId = x.feedback.UserId,
                    UserEmail = user != null ? user.Email : "Anonymous"
                });
    }
}

// ============ REQUEST / RESPONSE DTOS ============

public class TestEmailRequest
{
    public string RecipientEmail { get; set; } = string.Empty;
}

public class BanRequest
{
    public string? Reason { get; set; }
}

public class UpdateRoleRequest
{
    public string Role { get; set; } = string.Empty;
}

public class UpdatePlanRequest
{
    public string Plan { get; set; } = string.Empty;
}

public class AdminNotesRequest
{
    public string? Notes { get; set; }
}

public class TrustScoreRequest
{
    public int Score { get; set; }
}

public class LimitOverrideRequest
{
    public int? ScanLimit { get; set; }
    public int? ContextLimit { get; set; }
    public int? AiRequestLimit { get; set; }
}

public class UpdateFeedbackRequest
{
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public string? AdminNote { get; set; }
    public string? RelatedFeature { get; set; }
}

public class AnalyticsConfigRequest
{
    public bool Enabled { get; set; }
    public string? GaId { get; set; }
    public string? ClarityId { get; set; }
}

public class AddDomainRequest
{
    public string Domain { get; set; } = string.Empty;
}

public class AdminActivityItem
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AdminFeedbackItem
{
    public string Id { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Status { get; set; } = "new";
    public string Priority { get; set; } = "normal";
    public string? AdminNote { get; set; }
    public string? RelatedFeature { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? UserId { get; set; }
    public string UserEmail { get; set; } = string.Empty;
}
