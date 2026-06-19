// ============================================
// V1 (MVP) - MINIMAL BACKEND API
// MUST SHIP - Core functionality only
// ============================================
using AiContextBrain.Data;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL;

// Load .env file if exists (for local development)
DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

// Add environment variables to configuration
builder.Configuration.AddEnvironmentVariables();

// V1: Essential services only
builder.Services.AddControllers();

// Payment: HttpClient for Lemon Squeezy API calls
builder.Services.AddHttpClient("Paddle");

// Payment: Enable raw body buffering (needed for webhook signature verification)
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => { });
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();

// V1: PostgreSQL database (Supabase - Connection Pooler)
// Connection string from appsettings.json
builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    var connectionString = configuration.GetConnectionString("DefaultConnection");
    options.UseNpgsql(connectionString, npgsqlOptions =>
    {
        npgsqlOptions.MigrationsAssembly("AiContextBrain");
    });
    options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// Transactional Email Service registration
string FirstConfig(params string[] keys)
{
    foreach (var key in keys)
    {
        var value = builder.Configuration[key];
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }
    }

    return string.Empty;
}

var senderEmail = FirstConfig("RESEND_FROM_EMAIL", "SMTP_FROM_EMAIL", "ZOHO_SMTP_FROM_EMAIL", "Email:FromEmail", "Email__FromEmail", "SMTP_USERNAME", "ZOHO_SMTP_USERNAME");
var emailConfig = new EmailConfig
{
    FromEmail = senderEmail,
    FromName = FirstConfig("RESEND_FROM_NAME", "SMTP_FROM_NAME", "ZOHO_SMTP_FROM_NAME", "Email:FromName", "Email__FromName") is { Length: > 0 } fromName ? fromName : "AI Context Brain",
    WebBaseUrl = FirstConfig("App__WebUrl", "App:WebUrl", "WEB_URL") is { Length: > 0 } webUrl ? webUrl.TrimEnd('/') : "https://aicontextbrain.me",
    ResendApiKey = FirstConfig("RESEND_API_KEY", "Email:ResendApiKey", "Email__ResendApiKey")
};
builder.Services.AddSingleton(emailConfig);
builder.Services.AddScoped<IEmailService, EmailService>();

var resendReady = !string.IsNullOrWhiteSpace(emailConfig.ResendApiKey)
    && !string.IsNullOrWhiteSpace(emailConfig.FromEmail);

if (resendReady)
{
    Console.WriteLine($"[Email] Resend API configured: From={emailConfig.FromEmail}. Using Web API over HTTPS.");
}
else
{
    Console.WriteLine("[Email] Resend API is not fully configured. Set RESEND_API_KEY and a Resend-verified sender email.");
}

// V1 + V2: Core and advanced services
builder.Services.AddScoped<IRepositoryScanner, RepositoryScanner>();
builder.Services.AddScoped<IProjectMemoryService, ProjectMemoryService>();
builder.Services.AddScoped<IContextGenerator, ContextGenerator>();
// V2: Architecture Guard - Real-time compliance checking
builder.Services.AddScoped<IArchitectureGuard, ArchitectureGuard>();
// V2: Hybrid AI Analysis Service - Multi-provider with fallback
builder.Services.AddScoped<IAIAnalysisService, AIAnalysisService>(); // Legacy placeholder
builder.Services.AddScoped<IHybridAIAnalysisService, HybridAIAnalysisService>(); // Active hybrid service
builder.Services.AddSingleton<ILoginThrottleService, LoginThrottleService>();
builder.Services.AddHostedService<BillingReconciliationService>();

// V1 + V2: Robust CORS for extension and web dashboard
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowExtension", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrWhiteSpace(origin)) return false;
            try
            {
                var host = new Uri(origin).Host;
                return host.Equals("aicontextbrain.me", StringComparison.OrdinalIgnoreCase) ||
                       host.EndsWith(".aicontextbrain.me", StringComparison.OrdinalIgnoreCase) ||
                       host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                       host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

// V1: Single HTTP port (Railway provides PORT env var, fallback to 5001)
var port = Environment.GetEnvironmentVariable("PORT") ?? "5001";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

// V2: Swagger/OpenAPI - Disabled in V1 for simplicity
// V2: app.UseOpenApi();
// V2: app.UseSwaggerUi(settings => { ... });

// V1 + V2: Health endpoint
app.MapGet("/", () => Results.Json(new { status = "AI Context Brain API", version = "1.3.0", features = new[] { "Core", "ArchitectureGuard", "HybridAI" } }));
app.MapGet("/api/health", () => Results.Json(new { status = "healthy", database = "PostgreSQL", version = "1.3.0" }));

// V2: AI Provider Status endpoint
app.MapGet("/api/ai/status", async (IHybridAIAnalysisService aiService) => 
{
    var status = await aiService.GetProviderStatusAsync();
    return Results.Ok(status);
});

app.UseRouting();
app.UseCors("AllowExtension");
app.Use(async (ctx, next) => { ctx.Request.EnableBuffering(); await next(); });
app.UseMiddleware<AiContextBrain.Middleware.RateLimitingMiddleware>();
app.UseAuthorization();
app.MapControllers();

// V1: Auto-run migrations (production-safe) and self-healing table setup
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try
    {
        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB Migration Warning] {ex.Message}");
    }

    try
    {
        context.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""ActivityLogs"" (
                ""Id"" text NOT NULL,
                ""UserId"" text NOT NULL,
                ""ProjectId"" text NULL,
                ""ProjectName"" text NOT NULL,
                ""Action"" text NOT NULL,
                ""Details"" text NULL,
                ""CreatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_ActivityLogs"" PRIMARY KEY (""Id"")
            );
            CREATE INDEX IF NOT EXISTS ""IX_ActivityLogs_UserId"" ON ""ActivityLogs"" (""UserId"");

             ALTER TABLE ""Users""
                ADD COLUMN IF NOT EXISTS ""RefreshTokenHash"" character varying(500) NULL,
                ADD COLUMN IF NOT EXISTS ""RefreshTokenExpiresAt"" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS ""ContextGenerationCount"" integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS ""ContextResetDate"" timestamptz NOT NULL DEFAULT NOW() + INTERVAL '1 month',
                ADD COLUMN IF NOT EXISTS ""AiRequestCount"" integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS ""AiResetDate"" timestamptz NOT NULL DEFAULT NOW() + INTERVAL '1 month',
                ADD COLUMN IF NOT EXISTS ""Role"" integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS ""IsEmailVerified"" boolean NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS ""EmailVerificationToken"" character varying(100) NULL,
                ADD COLUMN IF NOT EXISTS ""EmailVerificationTokenExpiresAt"" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS ""PasswordResetToken"" character varying(100) NULL,
                ADD COLUMN IF NOT EXISTS ""PasswordResetTokenExpiresAt"" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS ""Username"" character varying(100) NULL,
                ADD COLUMN IF NOT EXISTS ""IsBanned"" boolean NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS ""BanReason"" text NULL,
                ADD COLUMN IF NOT EXISTS ""BannedAt"" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS ""IsDeleted"" boolean NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS ""DeletedAt"" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS ""AdminNotes"" text NULL,
                ADD COLUMN IF NOT EXISTS ""TrustScore"" integer NOT NULL DEFAULT 100,
                ADD COLUMN IF NOT EXISTS ""IsTempEmail"" boolean NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS ""LastActivityAt"" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS ""RegistrationSource"" text NULL,
                ADD COLUMN IF NOT EXISTS ""Country"" text NULL,
                ADD COLUMN IF NOT EXISTS ""ScanLimitOverride"" integer NULL,
                ADD COLUMN IF NOT EXISTS ""ContextLimitOverride"" integer NULL,
                ADD COLUMN IF NOT EXISTS ""AiRequestLimitOverride"" integer NULL;

            CREATE TABLE IF NOT EXISTS ""Feedbacks"" (
                ""Id"" text NOT NULL,
                ""UserId"" text NULL,
                ""Content"" text NOT NULL,
                ""Rating"" integer NOT NULL DEFAULT 5,
                ""Category"" character varying(50) NOT NULL DEFAULT 'general',
                ""CreatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_Feedbacks"" PRIMARY KEY (""Id""),
                CONSTRAINT ""FK_Feedbacks_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE SET NULL
            );
            CREATE INDEX IF NOT EXISTS ""IX_Feedbacks_UserId"" ON ""Feedbacks"" (""UserId"");

            ALTER TABLE ""Feedbacks""
                ADD COLUMN IF NOT EXISTS ""Status"" character varying(20) NOT NULL DEFAULT 'new',
                ADD COLUMN IF NOT EXISTS ""Priority"" character varying(20) NOT NULL DEFAULT 'normal',
                ADD COLUMN IF NOT EXISTS ""AdminNote"" text NULL,
                ADD COLUMN IF NOT EXISTS ""RelatedFeature"" text NULL;

            ALTER TABLE ""Projects""
                ADD COLUMN IF NOT EXISTS ""ScanFingerprint"" character varying(128) NULL,
                ADD COLUMN IF NOT EXISTS ""SemanticSummary"" text NULL,
                ADD COLUMN IF NOT EXISTS ""SemanticIndexJson"" text NULL,
                ADD COLUMN IF NOT EXISTS ""EmbeddingVectorJson"" text NULL,
                ADD COLUMN IF NOT EXISTS ""IsLocalInitialized"" boolean NOT NULL DEFAULT TRUE;

            ALTER TABLE ""ProjectScans""
                ADD COLUMN IF NOT EXISTS ""ScanFingerprint"" character varying(128) NULL,
                ADD COLUMN IF NOT EXISTS ""SemanticSummary"" text NULL;

            CREATE TABLE IF NOT EXISTS ""UserSettings"" (
                ""Id"" text NOT NULL,
                ""UserId"" text NOT NULL,
                ""Notifications"" boolean NOT NULL DEFAULT TRUE,
                ""AutoScan"" boolean NOT NULL DEFAULT FALSE,
                ""DarkMode"" boolean NOT NULL DEFAULT TRUE,
                ""AiProvider"" character varying(40) NOT NULL DEFAULT 'auto',
                ""MaxTokens"" integer NOT NULL DEFAULT 8000,
                ""ContextFormat"" character varying(40) NOT NULL DEFAULT 'markdown',
                ""ApiUrl"" character varying(500) NOT NULL DEFAULT 'https://api.aicontextbrain.me',
                ""UpdatedAt"" timestamptz NOT NULL DEFAULT NOW(),
                CONSTRAINT ""PK_UserSettings"" PRIMARY KEY (""Id""),
                CONSTRAINT ""FK_UserSettings_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserSettings_UserId"" ON ""UserSettings"" (""UserId"");

            CREATE TABLE IF NOT EXISTS ""TeamWorkspaces"" (
                ""Id"" text NOT NULL,
                ""Name"" character varying(200) NOT NULL,
                ""OwnerUserId"" text NOT NULL,
                ""CreatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_TeamWorkspaces"" PRIMARY KEY (""Id""),
                CONSTRAINT ""FK_TeamWorkspaces_Users_OwnerUserId"" FOREIGN KEY (""OwnerUserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ""IX_TeamWorkspaces_OwnerUserId"" ON ""TeamWorkspaces"" (""OwnerUserId"");

            CREATE TABLE IF NOT EXISTS ""TeamMembers"" (
                ""Id"" text NOT NULL,
                ""TeamWorkspaceId"" text NOT NULL,
                ""UserId"" text NOT NULL,
                ""Role"" integer NOT NULL,
                ""JoinedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_TeamMembers"" PRIMARY KEY (""Id""),
                CONSTRAINT ""FK_TeamMembers_TeamWorkspaces_TeamWorkspaceId"" FOREIGN KEY (""TeamWorkspaceId"") REFERENCES ""TeamWorkspaces"" (""Id"") ON DELETE CASCADE,
                CONSTRAINT ""FK_TeamMembers_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TeamMembers_TeamWorkspaceId_UserId"" ON ""TeamMembers"" (""TeamWorkspaceId"", ""UserId"");
            CREATE INDEX IF NOT EXISTS ""IX_TeamMembers_UserId"" ON ""TeamMembers"" (""UserId"");

            CREATE TABLE IF NOT EXISTS ""ProjectShares"" (
                ""Id"" text NOT NULL,
                ""TeamWorkspaceId"" text NOT NULL,
                ""ProjectId"" text NOT NULL,
                ""CreatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_ProjectShares"" PRIMARY KEY (""Id""),
                CONSTRAINT ""FK_ProjectShares_TeamWorkspaces_TeamWorkspaceId"" FOREIGN KEY (""TeamWorkspaceId"") REFERENCES ""TeamWorkspaces"" (""Id"") ON DELETE CASCADE,
                CONSTRAINT ""FK_ProjectShares_Projects_ProjectId"" FOREIGN KEY (""ProjectId"") REFERENCES ""Projects"" (""Id"") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ProjectShares_TeamWorkspaceId_ProjectId"" ON ""ProjectShares"" (""TeamWorkspaceId"", ""ProjectId"");
            CREATE INDEX IF NOT EXISTS ""IX_ProjectShares_ProjectId"" ON ""ProjectShares"" (""ProjectId"");

            CREATE TABLE IF NOT EXISTS ""EmailLogs"" (
                ""Id"" text NOT NULL,
                ""UserId"" text NULL,
                ""RecipientEmail"" text NOT NULL,
                ""EmailType"" character varying(50) NOT NULL,
                ""Subject"" text NOT NULL,
                ""Status"" character varying(20) NOT NULL DEFAULT 'sent',
                ""ErrorMessage"" text NULL,
                ""CreatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_EmailLogs"" PRIMARY KEY (""Id"")
            );
            CREATE INDEX IF NOT EXISTS ""IX_EmailLogs_UserId"" ON ""EmailLogs"" (""UserId"");
            CREATE INDEX IF NOT EXISTS ""IX_EmailLogs_CreatedAt"" ON ""EmailLogs"" (""CreatedAt"");

            CREATE TABLE IF NOT EXISTS ""AuditLogs"" (
                ""Id"" text NOT NULL,
                ""AdminUserId"" text NOT NULL,
                ""Action"" character varying(50) NOT NULL,
                ""TargetUserId"" text NOT NULL,
                ""Details"" text NULL,
                ""CreatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_AuditLogs"" PRIMARY KEY (""Id"")
            );
            CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_AdminUserId"" ON ""AuditLogs"" (""AdminUserId"");
            CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_TargetUserId"" ON ""AuditLogs"" (""TargetUserId"");
            CREATE INDEX IF NOT EXISTS ""IX_AuditLogs_CreatedAt"" ON ""AuditLogs"" (""CreatedAt"");

            CREATE TABLE IF NOT EXISTS ""DisposableDomains"" (
                ""Id"" text NOT NULL,
                ""Domain"" character varying(200) NOT NULL,
                ""CreatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_DisposableDomains"" PRIMARY KEY (""Id"")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_DisposableDomains_Domain"" ON ""DisposableDomains"" (""Domain"");

            CREATE TABLE IF NOT EXISTS ""AnalyticsSettings"" (
                ""Id"" text NOT NULL,
                ""Enabled"" boolean NOT NULL DEFAULT FALSE,
                ""GoogleAnalyticsId"" character varying(50) NULL,
                ""ClarityId"" character varying(100) NULL,
                ""UpdatedAt"" timestamptz NOT NULL,
                CONSTRAINT ""PK_AnalyticsSettings"" PRIMARY KEY (""Id"")
            );
        ");
        Console.WriteLine("[DB Self-Healing] All tables, admin columns, EmailLogs, AuditLogs, DisposableDomains, AnalyticsSettings verified.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB Self-Healing Error] Failed to verify/create tables: {ex.Message}");
    }



    try
    {
        var usersWithoutUsername = context.Users.Where(u => string.IsNullOrEmpty(u.Username)).ToList();
        foreach (var u in usersWithoutUsername)
        {
            var baseName = u.Email.Split('@')[0];
            var uniq = baseName;
            int counter = 1;
            while (context.Users.Any(x => x.Username == uniq))
            {
                uniq = $"{baseName}{counter++}";
            }
            u.Username = uniq;
            Console.WriteLine($"[DB Seed] Generated username '{uniq}' for user {u.Email}");
        }
        if (usersWithoutUsername.Any())
        {
            context.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB Seed Error] Failed to seed usernames: {ex.Message}");
    }
}

app.Run();
