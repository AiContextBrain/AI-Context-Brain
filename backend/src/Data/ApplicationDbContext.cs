using AiContextBrain.Models;
using Microsoft.EntityFrameworkCore;

namespace AiContextBrain.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Project> Projects { get; set; }
    public DbSet<ArchitectureRule> ArchitectureRules { get; set; }
    public DbSet<CodingConvention> CodingConventions { get; set; }
    public DbSet<SystemDecision> SystemDecisions { get; set; }
    public DbSet<ProjectScan> ProjectScans { get; set; }
    public DbSet<FrameworkPattern> FrameworkPatterns { get; set; }
    public DbSet<AIContext> AIContexts { get; set; }
    
    // SaaS Auth Extension
    public DbSet<User> Users { get; set; }
    public DbSet<ExtensionAuth> ExtensionAuths { get; set; }
    public DbSet<ActivityLog> ActivityLogs { get; set; }
    public DbSet<UserSettings> UserSettings { get; set; }
    public DbSet<TeamWorkspace> TeamWorkspaces { get; set; }
    public DbSet<TeamMember> TeamMembers { get; set; }
    public DbSet<ProjectShare> ProjectShares { get; set; }
    public DbSet<Feedback> Feedbacks { get; set; }
    public DbSet<TeamInvitation> TeamInvitations { get; set; }
    public DbSet<EmailLog> EmailLogs { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<DisposableDomain> DisposableDomains { get; set; }
    public DbSet<AnalyticsSettings> AnalyticsSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Project configuration
        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Path).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Framework).HasMaxLength(100);
            entity.Property(e => e.ArchitectureType).HasMaxLength(100);
            entity.Property(e => e.ScanFingerprint).HasMaxLength(128);
            entity.Property(e => e.IsLocalInitialized).HasDefaultValue(true);
            entity.HasIndex(e => new { e.Path, e.UserId }).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // ArchitectureRule configuration
        modelBuilder.Entity<ArchitectureRule>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Pattern).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.RuleType).HasDefaultValue("Regex");
            entity.Property(e => e.Severity).HasDefaultValue("Warning");
            entity.HasOne(e => e.Project).WithMany(p => p.ArchitectureRules).HasForeignKey(e => e.ProjectId);
        });

        // CodingConvention configuration
        modelBuilder.Entity<CodingConvention>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Rule).IsRequired();
            entity.Property(e => e.Example).HasMaxLength(1000);
            entity.HasOne(e => e.Project).WithMany(p => p.CodingConventions).HasForeignKey(e => e.ProjectId);
        });

        // SystemDecision configuration
        modelBuilder.Entity<SystemDecision>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(300);
            entity.Property(e => e.Decision).IsRequired();
            entity.Property(e => e.Reasoning).HasMaxLength(2000);
            entity.HasOne(e => e.Project).WithMany(p => p.SystemDecisions).HasForeignKey(e => e.ProjectId);
        });

        // ProjectScan configuration
        modelBuilder.Entity<ProjectScan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ScanData).HasColumnType("jsonb");
            entity.Property(e => e.FolderStructureJson).HasColumnType("jsonb").HasDefaultValue("[]");
            entity.Property(e => e.ChangedFilesJson).HasColumnType("jsonb");
            entity.Property(e => e.ScanFingerprint).HasMaxLength(128);
            entity.HasOne(e => e.Project).WithMany(p => p.Scans).HasForeignKey(e => e.ProjectId);
        });

        // FrameworkPattern configuration
        modelBuilder.Entity<FrameworkPattern>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.DetectionRules).HasColumnType("jsonb");
            entity.Property(e => e.FolderStructure).HasColumnType("jsonb");
        });

        // SaaS Auth: User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Username).IsUnique();
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.ApiToken).HasMaxLength(500);
            entity.Property(e => e.RefreshTokenHash).HasMaxLength(500);
            entity.Property(e => e.Role).HasDefaultValue(UserRole.User);
            entity.Property(e => e.IsEmailVerified).HasDefaultValue(false);
            entity.Property(e => e.EmailVerificationToken).HasMaxLength(100);
            entity.Property(e => e.PasswordResetToken).HasMaxLength(100);
            entity.Property(e => e.TrustScore).HasDefaultValue(100);
        });

        // SaaS: User settings configuration
        modelBuilder.Entity<UserSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.Property(e => e.AiProvider).HasMaxLength(40);
            entity.Property(e => e.ContextFormat).HasMaxLength(40);
            entity.Property(e => e.ApiUrl).HasMaxLength(500);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // SaaS Auth: ExtensionAuth configuration
        modelBuilder.Entity<ExtensionAuth>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Token).IsRequired();
            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TeamWorkspace>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.OwnerUserId);
            entity.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerUserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TeamMember>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TeamWorkspaceId, e.UserId }).IsUnique();
            entity.HasOne(e => e.TeamWorkspace).WithMany(t => t.Members).HasForeignKey(e => e.TeamWorkspaceId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectShare>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.TeamWorkspaceId, e.ProjectId }).IsUnique();
            entity.HasOne(e => e.TeamWorkspace).WithMany(t => t.ProjectShares).HasForeignKey(e => e.TeamWorkspaceId);
            entity.HasOne(e => e.Project).WithMany().HasForeignKey(e => e.ProjectId);
        });

        modelBuilder.Entity<TeamInvitation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => new { e.TeamWorkspaceId, e.Email }).IsUnique();
            entity.HasIndex(e => e.Email);
            entity.HasOne(e => e.TeamWorkspace).WithMany().HasForeignKey(e => e.TeamWorkspaceId);
            entity.HasOne(e => e.InvitedBy).WithMany().HasForeignKey(e => e.InvitedByUserId).OnDelete(DeleteBehavior.Cascade);
        });

        // SaaS: AIContexts configuration
        modelBuilder.Entity<AIContext>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Content).IsRequired();
            entity.HasIndex(e => e.ProjectId);
            entity.HasOne(e => e.Project).WithMany(p => p.AIContexts).HasForeignKey(e => e.ProjectId);
        });

        // Feedback configuration
        modelBuilder.Entity<Feedback>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Content).IsRequired();
            entity.Property(e => e.Category).HasMaxLength(50).HasDefaultValue("general");
            entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValue("new");
            entity.Property(e => e.Priority).HasMaxLength(20).HasDefaultValue("normal");
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        // ActivityLog configuration
        modelBuilder.Entity<ActivityLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // EmailLog configuration
        modelBuilder.Entity<EmailLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.Property(e => e.EmailType).HasMaxLength(50);
            entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValue("sent");
        });

        // AuditLog configuration
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.AdminUserId);
            entity.HasIndex(e => e.TargetUserId);
            entity.HasIndex(e => e.CreatedAt);
            entity.Property(e => e.Action).HasMaxLength(50);
        });

        // DisposableDomain configuration
        modelBuilder.Entity<DisposableDomain>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Domain).IsUnique();
            entity.Property(e => e.Domain).HasMaxLength(200);
        });

        modelBuilder.Entity<AnalyticsSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.GoogleAnalyticsId).HasMaxLength(50);
            entity.Property(e => e.ClarityId).HasMaxLength(100);
        });
    }
}
