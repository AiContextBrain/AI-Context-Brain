using AiContextBrain.Data;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class TeamController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TeamController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var teams = await _context.TeamMembers
            .Where(m => m.UserId == user.Id)
            .Include(m => m.TeamWorkspace)
            .Select(m => new
            {
                id = m.TeamWorkspaceId,
                name = m.TeamWorkspace != null ? m.TeamWorkspace.Name : "Unknown",
                role = m.Role.ToString(),
                joinedAt = m.JoinedAt
            })
            .ToListAsync();

        return Ok(new { teams });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTeamRequest request)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        if (user.Plan != UserPlan.Team)
        {
            return StatusCode(403, new { error = "team_plan_required", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var team = new TeamWorkspace
        {
            Name = string.IsNullOrWhiteSpace(request.Name) ? "Team Workspace" : request.Name.Trim(),
            OwnerUserId = user.Id
        };

        _context.TeamWorkspaces.Add(team);
        _context.TeamMembers.Add(new TeamMember
        {
            TeamWorkspaceId = team.Id,
            UserId = user.Id,
            Role = TeamRole.Owner
        });
        LogTeamActivity(team.Id, team.Name, user.Id, "team_created", $"teamId={team.Id}; workspace created");
        await _context.SaveChangesAsync();

        return Ok(new { id = team.Id, team.Name, role = TeamRole.Owner.ToString() });
    }

    [HttpGet("{teamId}")]
    public async Task<IActionResult> Get(string teamId, [FromQuery] string? search = null)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null) return NotFound(new { error = "Team not found" });
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var team = await _context.TeamWorkspaces
            .Include(t => t.Members)
            .Include(t => t.ProjectShares)
            .FirstOrDefaultAsync(t => t.Id == teamId);
        if (team == null) return NotFound(new { error = "Team not found" });

        var userIds = team.Members.Select(m => m.UserId).ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToListAsync();

        var projectIds = team.ProjectShares.Select(s => s.ProjectId).ToList();
        var projects = await _context.Projects
            .Where(p => projectIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.Framework, p.ArchitectureType, p.UpdatedAt })
            .ToListAsync();

        // Pending invitations
        var pendingInvitations = await _context.TeamInvitations
            .Where(i => i.TeamWorkspaceId == teamId && !i.IsAccepted)
            .Select(i => new
            {
                i.Id,
                i.Email,
                role = i.Role.ToString(),
                i.CreatedAt,
                invitedBy = _context.Users.Where(u => u.Id == i.InvitedByUserId).Select(u => u.Email).FirstOrDefault()
            })
            .ToListAsync();

        var membersList = team.Members.Select(m => new
        {
            m.Id,
            m.UserId,
            email = users.FirstOrDefault(u => u.Id == m.UserId)?.Email,
            role = m.Role.ToString(),
            m.JoinedAt,
            permissions = BuildRolePermissions(m.Role)
        }).ToList();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            membersList = membersList.Where(m => m.email != null && m.email.Contains(s, StringComparison.OrdinalIgnoreCase)).ToList();
            pendingInvitations = pendingInvitations.Where(i => i.Email.Contains(s, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return Ok(new
        {
            team.Id,
            team.Name,
            role = membership.Role.ToString(),
            permissions = BuildRolePermissions(membership.Role),
            members = membersList,
            invitations = pendingInvitations,
            projects
        });
    }

    [HttpPost("{teamId}/members")]
    public async Task<IActionResult> AddMember(string teamId, [FromBody] AddTeamMemberRequest request)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null || membership.Role is not (TeamRole.Owner or TeamRole.Admin))
        {
            return StatusCode(403, new { error = "team_admin_required" });
        }
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            return BadRequest(new { error = "invalid_email" });
        }
        if (!Enum.IsDefined(request.Role) || request.Role == TeamRole.Owner)
        {
            return BadRequest(new { error = "invalid_team_role", message = "Invite users as Admin, Member, or Viewer." });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        // Check if already a member
        var target = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (target != null)
        {
            var alreadyMember = await _context.TeamMembers.AnyAsync(m => m.TeamWorkspaceId == teamId && m.UserId == target.Id);
            if (alreadyMember)
            {
                return BadRequest(new { error = "already_member", message = "This user is already a team member." });
            }
        }

        // Check if already invited
        var alreadyInvited = await _context.TeamInvitations.AnyAsync(i => i.TeamWorkspaceId == teamId && i.Email == email && !i.IsAccepted);
        if (alreadyInvited)
        {
            return BadRequest(new { error = "already_invited", message = "An invitation has already been sent to this email." });
        }

        // Check team member limit (members + pending invitations)
        var currentMemberCount = await _context.TeamMembers.CountAsync(m => m.TeamWorkspaceId == teamId);
        var pendingInviteCount = await _context.TeamInvitations.CountAsync(i => i.TeamWorkspaceId == teamId && !i.IsAccepted);
        var maxMembers = PlanLimits.MaxTeamMembers(UserPlan.Team);
        if (currentMemberCount + pendingInviteCount >= maxMembers)
        {
            return StatusCode(403, new
            {
                error = "team_member_limit_reached",
                limit = maxMembers,
                upgradeUrl = "https://aicontextbrain.me/pricing"
            });
        }

        // Create a pending invitation
        var invitation = new TeamInvitation
        {
            TeamWorkspaceId = teamId,
            Email = email,
            Role = request.Role,
            InvitedByUserId = user.Id
        };
        _context.TeamInvitations.Add(invitation);
        var teamName = await GetTeamNameAsync(teamId);
        LogTeamActivity(teamId, teamName, user.Id, "team_invitation_created", $"teamId={teamId}; invited={email}; role={request.Role}");
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new { invitationId = invitation.Id, email, role = request.Role.ToString(), status = "pending" });
    }

    [HttpGet("{teamId}/analytics")]
    public async Task<IActionResult> Analytics(string teamId)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null) return NotFound(new { error = "Team not found" });
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var team = await _context.TeamWorkspaces
            .Include(t => t.ProjectShares)
            .FirstOrDefaultAsync(t => t.Id == teamId);
        if (team == null) return NotFound(new { error = "Team not found" });

        var projectIds = team.ProjectShares.Select(s => s.ProjectId).ToList();
        var memberCount = await _context.TeamMembers.CountAsync(m => m.TeamWorkspaceId == teamId);
        var pendingInviteCount = await _context.TeamInvitations.CountAsync(i => i.TeamWorkspaceId == teamId && !i.IsAccepted);
        var sharedProjectCount = projectIds.Count;
        var contextHistoryItems = projectIds.Count == 0
            ? 0
            : await _context.AIContexts.CountAsync(c => projectIds.Contains(c.ProjectId));
        var activityWindowStart = DateTime.UtcNow.AddDays(-30);
        var recentActivity = await _context.ActivityLogs
            .CountAsync(a => a.CreatedAt >= activityWindowStart
                && a.Details != null
                && a.Details.Contains($"teamId={teamId}"));
        var lastSharedProjectUpdate = projectIds.Count == 0
            ? null
            : await _context.Projects
                .Where(p => projectIds.Contains(p.Id))
                .MaxAsync(p => (DateTime?)p.UpdatedAt);
        var roleGroups = await _context.TeamMembers
            .Where(m => m.TeamWorkspaceId == teamId)
            .GroupBy(m => m.Role)
            .Select(g => new { Role = g.Key, Count = g.Count() })
            .ToListAsync();

        var memberLimit = PlanLimits.MaxTeamMembers(UserPlan.Team);

        return Ok(new
        {
            members = memberCount,
            pendingInvitations = pendingInviteCount,
            sharedProjects = sharedProjectCount,
            contextHistoryItems,
            recentActivity,
            memberLimit,
            memberUtilizationPercent = memberLimit == 0 ? 0 : Math.Min(100, (int)Math.Round((memberCount + pendingInviteCount) * 100m / memberLimit)),
            lastSharedProjectUpdate,
            roleBreakdown = roleGroups.Select(g => new { role = g.Role.ToString(), count = g.Count })
        });
    }

    [HttpGet("{teamId}/audit")]
    public async Task<IActionResult> Audit(string teamId, [FromQuery] int limit = 25)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null) return NotFound(new { error = "Team not found" });
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var safeLimit = Math.Clamp(limit, 1, 100);
        var logs = await _context.ActivityLogs
            .Where(a => a.Details != null && a.Details.Contains($"teamId={teamId}"))
            .OrderByDescending(a => a.CreatedAt)
            .Take(safeLimit)
            .ToListAsync();

        var actorIds = logs.Select(l => l.UserId).Distinct().ToList();
        var actors = await _context.Users
            .Where(u => actorIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToListAsync();

        return Ok(new
        {
            audit = logs.Select(log => new
            {
                log.Id,
                log.Action,
                log.Details,
                log.CreatedAt,
                actorEmail = actors.FirstOrDefault(a => a.Id == log.UserId)?.Email
            })
        });
    }

    [HttpPatch("{teamId}/members/{memberId}/role")]
    public async Task<IActionResult> UpdateMemberRole(string teamId, string memberId, [FromBody] UpdateTeamMemberRoleRequest request)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null || membership.Role != TeamRole.Owner)
        {
            return StatusCode(403, new { error = "team_owner_required" });
        }
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }
        if (request.Role == TeamRole.Owner)
        {
            return BadRequest(new { error = "use_transfer_ownership", message = "Use ownership transfer to make another user the owner." });
        }

        var target = await _context.TeamMembers.FirstOrDefaultAsync(m => m.Id == memberId && m.TeamWorkspaceId == teamId);
        if (target == null) return NotFound(new { error = "member_not_found" });
        if (target.UserId == user.Id)
        {
            return BadRequest(new { error = "cannot_change_own_role" });
        }
        if (target.Role == TeamRole.Owner)
        {
            return BadRequest(new { error = "cannot_change_owner_role" });
        }

        var oldRole = target.Role;
        target.Role = request.Role;
        var teamName = await GetTeamNameAsync(teamId);
        LogTeamActivity(teamId, teamName, user.Id, "team_member_role_updated", $"teamId={teamId}; memberId={memberId}; from={oldRole}; to={request.Role}");
        await _context.SaveChangesAsync();

        return Ok(new { memberId, role = target.Role.ToString() });
    }

    [HttpDelete("{teamId}/members/{memberId}")]
    public async Task<IActionResult> RemoveMember(string teamId, string memberId)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null || membership.Role is not (TeamRole.Owner or TeamRole.Admin))
        {
            return StatusCode(403, new { error = "team_admin_required" });
        }
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var target = await _context.TeamMembers.FirstOrDefaultAsync(m => m.Id == memberId && m.TeamWorkspaceId == teamId);
        if (target == null) return NotFound(new { error = "member_not_found" });
        if (target.UserId == user.Id)
        {
            return BadRequest(new { error = "cannot_remove_self" });
        }
        if (target.Role == TeamRole.Owner)
        {
            return BadRequest(new { error = "cannot_remove_owner" });
        }
        if (membership.Role == TeamRole.Admin && target.Role == TeamRole.Admin)
        {
            return StatusCode(403, new { error = "team_owner_required" });
        }

        _context.TeamMembers.Remove(target);
        var teamName = await GetTeamNameAsync(teamId);
        LogTeamActivity(teamId, teamName, user.Id, "team_member_removed", $"teamId={teamId}; memberId={memberId}; role={target.Role}");
        await _context.SaveChangesAsync();

        return Ok(new { removed = true, memberId });
    }

    [HttpDelete("{teamId}/invitations/{invitationId}")]
    public async Task<IActionResult> CancelInvitation(string teamId, string invitationId)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null || membership.Role is not (TeamRole.Owner or TeamRole.Admin))
        {
            return StatusCode(403, new { error = "team_admin_required" });
        }
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var invitation = await _context.TeamInvitations
            .FirstOrDefaultAsync(i => i.Id == invitationId && i.TeamWorkspaceId == teamId && !i.IsAccepted);
        if (invitation == null) return NotFound(new { error = "invitation_not_found" });

        _context.TeamInvitations.Remove(invitation);
        var teamName = await GetTeamNameAsync(teamId);
        LogTeamActivity(teamId, teamName, user.Id, "team_invitation_cancelled", $"teamId={teamId}; email={invitation.Email}; role={invitation.Role}");
        await _context.SaveChangesAsync();

        return Ok(new { cancelled = true, invitationId });
    }

    [HttpPost("{teamId}/transfer-ownership")]
    public async Task<IActionResult> TransferOwnership(string teamId, [FromBody] TransferTeamOwnershipRequest request)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null || membership.Role != TeamRole.Owner)
        {
            return StatusCode(403, new { error = "team_owner_required" });
        }
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var team = await _context.TeamWorkspaces.FirstOrDefaultAsync(t => t.Id == teamId);
        if (team == null) return NotFound(new { error = "Team not found" });

        var target = await _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamWorkspaceId == teamId && m.UserId == request.NewOwnerUserId);
        if (target == null) return NotFound(new { error = "member_not_found" });
        if (target.UserId == user.Id)
        {
            return BadRequest(new { error = "already_owner" });
        }

        var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == target.UserId);
        if (targetUser == null) return NotFound(new { error = "target_user_not_found" });
        targetUser.ApplyBillingState();
        if (targetUser.Plan != UserPlan.Team)
        {
            return StatusCode(403, new
            {
                error = "target_team_plan_required",
                message = "Ownership transfer requires the new owner to have an active Team plan because the owner subscription controls shared access."
            });
        }

        team.OwnerUserId = target.UserId;
        membership.Role = TeamRole.Admin;
        target.Role = TeamRole.Owner;
        LogTeamActivity(teamId, team.Name, user.Id, "team_ownership_transferred", $"teamId={teamId}; newOwnerUserId={target.UserId}; previousOwnerUserId={user.Id}");
        await _context.SaveChangesAsync();

        return Ok(new { teamId, ownerUserId = target.UserId });
    }

    /// <summary>
    /// Get pending invitations for the current user (across all teams)
    /// </summary>
    [HttpGet("invitations")]
    public async Task<IActionResult> GetMyInvitations()
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var invitations = await _context.TeamInvitations
            .Include(i => i.TeamWorkspace)
            .Include(i => i.InvitedBy)
            .Where(i => i.Email == user.Email.ToLowerInvariant() && !i.IsAccepted)
            .Select(i => new
            {
                i.Id,
                teamId = i.TeamWorkspaceId,
                teamName = i.TeamWorkspace != null ? i.TeamWorkspace.Name : "Unknown",
                role = i.Role.ToString(),
                invitedBy = i.InvitedBy != null ? i.InvitedBy.Email : "Unknown",
                i.CreatedAt
            })
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync();

        return Ok(new { invitations });
    }

    /// <summary>
    /// Accept a team invitation
    /// </summary>
    [HttpPost("invitations/{id}/accept")]
    public async Task<IActionResult> AcceptInvitation(string id)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var invitation = await _context.TeamInvitations
            .Include(i => i.TeamWorkspace)
            .FirstOrDefaultAsync(i => i.Id == id && i.Email == user.Email.ToLowerInvariant() && !i.IsAccepted);
        if (invitation == null)
        {
            return NotFound(new { error = "Invitation not found or already accepted." });
        }

        if (!await IsTeamWorkspaceActiveAsync(invitation.TeamWorkspaceId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", message = "The workspace owner's Team plan is not active." });
        }
        if (invitation.Role == TeamRole.Owner || !Enum.IsDefined(invitation.Role))
        {
            return BadRequest(new { error = "invalid_invitation_role" });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        // Check if already a member
        var alreadyMember = await _context.TeamMembers.AnyAsync(m => m.TeamWorkspaceId == invitation.TeamWorkspaceId && m.UserId == user.Id);
        if (alreadyMember)
        {
            invitation.IsAccepted = true;
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(new { message = "You are already a member of this team." });
        }

        var memberCount = await _context.TeamMembers.CountAsync(m => m.TeamWorkspaceId == invitation.TeamWorkspaceId);
        var maxMembers = PlanLimits.MaxTeamMembers(UserPlan.Team);
        if (memberCount >= maxMembers)
        {
            return StatusCode(403, new { error = "team_member_limit_reached", limit = maxMembers });
        }

        // Add user as member
        _context.TeamMembers.Add(new TeamMember
        {
            TeamWorkspaceId = invitation.TeamWorkspaceId,
            UserId = user.Id,
            Role = invitation.Role
        });
        invitation.IsAccepted = true;
        LogTeamActivity(invitation.TeamWorkspaceId, invitation.TeamWorkspace?.Name ?? "Team Workspace", user.Id, "team_invitation_accepted", $"teamId={invitation.TeamWorkspaceId}; role={invitation.Role}");
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new
        {
            teamId = invitation.TeamWorkspaceId,
            teamName = invitation.TeamWorkspace?.Name ?? "Team Workspace",
            role = invitation.Role.ToString(),
            message = "Invitation accepted. You are now a team member."
        });
    }

    /// <summary>
    /// Decline a team invitation
    /// </summary>
    [HttpPost("invitations/{id}/decline")]
    public async Task<IActionResult> DeclineInvitation(string id)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var invitation = await _context.TeamInvitations
            .FirstOrDefaultAsync(i => i.Id == id && i.Email == user.Email.ToLowerInvariant() && !i.IsAccepted);
        if (invitation == null)
        {
            return NotFound(new { error = "Invitation not found or already processed." });
        }

        _context.TeamInvitations.Remove(invitation);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Invitation declined." });
    }

    [HttpPost("{teamId}/projects")]
    public async Task<IActionResult> ShareProject(string teamId, [FromBody] ShareProjectRequest request)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var membership = await GetMembershipAsync(teamId, user.Id);
        if (membership == null || membership.Role is not (TeamRole.Owner or TeamRole.Admin))
        {
            return StatusCode(403, new { error = "team_admin_required" });
        }
        if (!await IsTeamWorkspaceActiveAsync(teamId))
        {
            return StatusCode(403, new { error = "team_plan_inactive", upgradeUrl = "https://aicontextbrain.me/pricing" });
        }

        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.UserId == user.Id);
        if (project == null) return NotFound(new { error = "Owned project not found" });

        var exists = await _context.ProjectShares.AnyAsync(s => s.TeamWorkspaceId == teamId && s.ProjectId == project.Id);
        if (!exists)
        {
            _context.ProjectShares.Add(new ProjectShare { TeamWorkspaceId = teamId, ProjectId = project.Id });
            var teamName = await GetTeamNameAsync(teamId);
            LogTeamActivity(teamId, teamName, user.Id, "team_project_shared", $"teamId={teamId}; projectId={project.Id}; projectName={project.Name}");
            await _context.SaveChangesAsync();
        }

        return Ok(new { project.Id, project.Name, shared = true });
    }

    private Task<User?> GetUserAsync()
    {
        return _context.ResolveUserFromBearerTokenAsync(Request.Headers["Authorization"].FirstOrDefault());
    }

    private Task<TeamMember?> GetMembershipAsync(string teamId, string userId)
    {
        return _context.TeamMembers.FirstOrDefaultAsync(m => m.TeamWorkspaceId == teamId && m.UserId == userId);
    }

    private async Task<bool> IsTeamWorkspaceActiveAsync(string teamId)
    {
        var team = await _context.TeamWorkspaces
            .Include(t => t.Owner)
            .FirstOrDefaultAsync(t => t.Id == teamId);
        if (team?.Owner == null)
        {
            return false;
        }

        if (team.Owner.ApplyBillingState())
        {
            await _context.SaveChangesAsync();
        }

        return team.Owner.Plan == UserPlan.Team;
    }

    private static object BuildRolePermissions(TeamRole role)
    {
        return new
        {
            canManageWorkspace = role == TeamRole.Owner,
            canTransferOwnership = role == TeamRole.Owner,
            canManageMembers = role is TeamRole.Owner or TeamRole.Admin,
            canInviteMembers = role is TeamRole.Owner or TeamRole.Admin,
            canCancelInvitations = role is TeamRole.Owner or TeamRole.Admin,
            canShareProjects = role is TeamRole.Owner or TeamRole.Admin,
            canEditSharedMemory = role is TeamRole.Owner or TeamRole.Admin,
            canRestoreContext = role is TeamRole.Owner or TeamRole.Admin,
            canViewSharedProjects = true,
            canUseSharedContext = true
        };
    }

    private async Task<string> GetTeamNameAsync(string teamId)
    {
        return await _context.TeamWorkspaces
            .Where(t => t.Id == teamId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync() ?? "Team Workspace";
    }

    private void LogTeamActivity(string teamId, string teamName, string userId, string action, string details)
    {
        _context.ActivityLogs.Add(new ActivityLog
        {
            UserId = userId,
            ProjectName = teamName,
            Action = action,
            Details = details.Contains($"teamId={teamId}") ? details : $"teamId={teamId}; {details}"
        });
    }
}

public class CreateTeamRequest
{
    public string Name { get; set; } = string.Empty;
}

public class AddTeamMemberRequest
{
    public string Email { get; set; } = string.Empty;
    public TeamRole Role { get; set; } = TeamRole.Member;
}

public class ShareProjectRequest
{
    public string ProjectId { get; set; } = string.Empty;
}

public class UpdateTeamMemberRoleRequest
{
    public TeamRole Role { get; set; } = TeamRole.Member;
}

public class TransferTeamOwnershipRequest
{
    public string NewOwnerUserId { get; set; } = string.Empty;
}
