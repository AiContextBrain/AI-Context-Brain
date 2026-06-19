// ============================================
// SaaS Auth Models
// ============================================
namespace AiContextBrain.Models;

public enum UserPlan { Free, Pro, Team }
public enum UserRole { User, Admin }

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public UserRole Role { get; set; } = UserRole.User;
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? ApiToken { get; set; }
    public string? RefreshTokenHash { get; set; }
    public DateTime? RefreshTokenExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    // Plan & limits
    public UserPlan Plan { get; set; } = UserPlan.Free;
    public int ScanCount { get; set; } = 0;
    public DateTime ScanResetDate { get; set; } = DateTime.UtcNow.AddMonths(1);

    // Context generation tracking
    public int ContextGenerationCount { get; set; } = 0;
    public DateTime ContextResetDate { get; set; } = DateTime.UtcNow.AddMonths(1);

    // AI request budget tracking
    public int AiRequestCount { get; set; } = 0;
    public DateTime AiResetDate { get; set; } = DateTime.UtcNow.AddMonths(1);

    // Email verification & password reset fields
    public bool IsEmailVerified { get; set; } = false;
    public string? EmailVerificationToken { get; set; }
    public DateTime? EmailVerificationTokenExpiresAt { get; set; }
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAt { get; set; }

    // Paddle billing
    public string? PaddleCustomerId { get; set; }
    public string? PaddleSubscriptionId { get; set; }
    public string? PaddleSubscriptionStatus { get; set; } // active, canceled, past_due, paused, trialing
    public string? PaddlePriceId { get; set; } // price id from Paddle
    public DateTime? PaddleCurrentPeriodEnd { get; set; }

    // Admin management fields
    public bool IsBanned { get; set; } = false;
    public string? BanReason { get; set; }
    public DateTime? BannedAt { get; set; }
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public string? AdminNotes { get; set; }
    public int TrustScore { get; set; } = 100;
    public bool IsTempEmail { get; set; } = false;
    public DateTime? LastActivityAt { get; set; }
    public string? RegistrationSource { get; set; }
    public string? Country { get; set; }

    // Admin-set limit overrides (null = use plan default)
    public int? ScanLimitOverride { get; set; }
    public int? ContextLimitOverride { get; set; }
    public int? AiRequestLimitOverride { get; set; }

    public bool ApplyBillingState(DateTime? now = null)
    {
        var currentTime = now ?? DateTime.UtcNow;
        var status = PaddleSubscriptionStatus?.Trim().ToLowerInvariant();

        if (status == "paused")
        {
            return SetPlanIfChanged(UserPlan.Free);
        }

        if (status is "canceled" or "cancelled" or "past_due")
        {
            if (!PaddleCurrentPeriodEnd.HasValue || PaddleCurrentPeriodEnd.Value <= currentTime)
            {
                return SetPlanIfChanged(UserPlan.Free);
            }
        }

        return false;
    }

    private bool SetPlanIfChanged(UserPlan plan)
    {
        if (Plan == plan)
        {
            return false;
        }

        Plan = plan;
        return true;
    }
}

public class UserSettings
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public bool Notifications { get; set; } = true;
    public bool AutoScan { get; set; } = false;
    public bool DarkMode { get; set; } = true;
    public string AiProvider { get; set; } = "auto";
    public int MaxTokens { get; set; } = 8000;
    public string ContextFormat { get; set; } = "markdown";
    public string ApiUrl { get; set; } = "https://api.aicontextbrain.me";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}

public enum TeamRole { Owner, Admin, Member, Viewer }

public class TeamWorkspace
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string OwnerUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Owner { get; set; }
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
    public ICollection<ProjectShare> ProjectShares { get; set; } = new List<ProjectShare>();
}

public class TeamMember
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TeamWorkspaceId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public TeamRole Role { get; set; } = TeamRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public TeamWorkspace? TeamWorkspace { get; set; }
    public User? User { get; set; }
}

public class ProjectShare
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TeamWorkspaceId { get; set; } = string.Empty;
    public string ProjectId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TeamWorkspace? TeamWorkspace { get; set; }
    public Project? Project { get; set; }
}

public static class PlanLimits
{
    public static int EffectiveMaxScans(User user) =>
        user.ScanLimitOverride ?? MaxScansPerMonth(user.Plan);

    public static int EffectiveMaxContextGenerations(User user, UserPlan? effectivePlan = null) =>
        user.ContextLimitOverride ?? MaxContextGenerationsPerMonth(effectivePlan ?? user.Plan);

    public static int EffectiveMaxAiRequests(User user, UserPlan? effectivePlan = null) =>
        user.AiRequestLimitOverride ?? MaxAiRequestsPerMonth(effectivePlan ?? user.Plan);

    public static int MaxProjects(UserPlan plan) => plan switch
    {
        UserPlan.Free => 3,
        UserPlan.Pro => 999,
        UserPlan.Team => 999,
        _ => 3
    };

    public static int MaxScansPerMonth(UserPlan plan) => plan switch
    {
        UserPlan.Free => 50,
        UserPlan.Pro => 500,
        UserPlan.Team => 1000,
        _ => 50
    };

    public static string PlanName(UserPlan plan) => plan.ToString();

    public static int MaxContextSizeTokens(UserPlan plan) => plan switch
    {
        UserPlan.Free => 2000,
        UserPlan.Pro => 32000,
        UserPlan.Team => 32000,
        _ => 2000
    };

    public static bool HasContextHistory(UserPlan plan) => plan != UserPlan.Free;
    public static bool HasPriorityAI(UserPlan plan) => plan != UserPlan.Free;
    public static bool CanUseDeepExplain(UserPlan plan) => plan != UserPlan.Free;
    public static bool CanUseReviewExplain(UserPlan plan) => plan == UserPlan.Team;
    public static bool HasApiAccess(UserPlan plan) => plan != UserPlan.Free;
    public static bool HasIdeExport(UserPlan plan) => true;
    public static bool HasTeamWorkspace(UserPlan plan) => plan == UserPlan.Team;
    public static int MaxTeamMembers(UserPlan plan) => plan == UserPlan.Team ? 10 : 1;

    public static int MaxContextGenerationsPerMonth(UserPlan plan) => plan switch
    {
        UserPlan.Free => 50,
        UserPlan.Pro => 500,
        UserPlan.Team => 1000,
        _ => 50
    };

    public static int MaxAiRequestsPerMonth(UserPlan plan) => plan switch
    {
        UserPlan.Free => 30,
        UserPlan.Pro => 100,
        UserPlan.Team => 500,
        _ => 30
    };
}

public class TeamInvitation
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string TeamWorkspaceId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public TeamRole Role { get; set; } = TeamRole.Member;
    public string InvitedByUserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsAccepted { get; set; } = false;

    public TeamWorkspace? TeamWorkspace { get; set; }
    public User? InvitedBy { get; set; }
}

public class ExtensionAuth
{
    // PostgreSQL: Use string (UUID) for Id
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    
    // Navigation property
    public User? User { get; set; }
}
