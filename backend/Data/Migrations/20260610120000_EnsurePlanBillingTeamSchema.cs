using AiContextBrain.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260610120000_EnsurePlanBillingTeamSchema")]
    public partial class EnsurePlanBillingTeamSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Users""
                    ADD COLUMN IF NOT EXISTS ""RefreshTokenHash"" character varying(500) NULL,
                    ADD COLUMN IF NOT EXISTS ""RefreshTokenExpiresAt"" timestamp with time zone NULL,
                    ADD COLUMN IF NOT EXISTS ""PaddleCustomerId"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""PaddleSubscriptionId"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""PaddleSubscriptionStatus"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""PaddlePriceId"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""PaddleCurrentPeriodEnd"" timestamp with time zone NULL;

                ALTER TABLE ""Projects""
                    ADD COLUMN IF NOT EXISTS ""ScanFingerprint"" character varying(128) NULL,
                    ADD COLUMN IF NOT EXISTS ""SemanticSummary"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""SemanticIndexJson"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""EmbeddingVectorJson"" text NULL;

                ALTER TABLE ""ProjectScans""
                    ADD COLUMN IF NOT EXISTS ""ScanFingerprint"" character varying(128) NULL,
                    ADD COLUMN IF NOT EXISTS ""SemanticSummary"" text NULL,
                    ADD COLUMN IF NOT EXISTS ""ChangedFilesJson"" jsonb NULL,
                    ADD COLUMN IF NOT EXISTS ""AddedFilesCount"" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS ""ModifiedFilesCount"" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS ""DeletedFilesCount"" integer NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS ""IsIncrementalScan"" boolean NOT NULL DEFAULT FALSE;

                CREATE TABLE IF NOT EXISTS ""ActivityLogs"" (
                    ""Id"" text NOT NULL,
                    ""UserId"" text NOT NULL,
                    ""ProjectId"" text NULL,
                    ""ProjectName"" text NOT NULL,
                    ""Action"" text NOT NULL,
                    ""Details"" text NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_ActivityLogs"" PRIMARY KEY (""Id"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_ActivityLogs_UserId"" ON ""ActivityLogs"" (""UserId"");

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
                    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                    CONSTRAINT ""PK_UserSettings"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserSettings_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserSettings_UserId"" ON ""UserSettings"" (""UserId"");

                CREATE TABLE IF NOT EXISTS ""TeamWorkspaces"" (
                    ""Id"" text NOT NULL,
                    ""Name"" character varying(200) NOT NULL,
                    ""OwnerUserId"" text NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_TeamWorkspaces"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_TeamWorkspaces_Users_OwnerUserId"" FOREIGN KEY (""OwnerUserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_TeamWorkspaces_OwnerUserId"" ON ""TeamWorkspaces"" (""OwnerUserId"");

                CREATE TABLE IF NOT EXISTS ""TeamMembers"" (
                    ""Id"" text NOT NULL,
                    ""TeamWorkspaceId"" text NOT NULL,
                    ""UserId"" text NOT NULL,
                    ""Role"" integer NOT NULL,
                    ""JoinedAt"" timestamp with time zone NOT NULL,
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
                    ""CreatedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_ProjectShares"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_ProjectShares_TeamWorkspaces_TeamWorkspaceId"" FOREIGN KEY (""TeamWorkspaceId"") REFERENCES ""TeamWorkspaces"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_ProjectShares_Projects_ProjectId"" FOREIGN KEY (""ProjectId"") REFERENCES ""Projects"" (""Id"") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ProjectShares_TeamWorkspaceId_ProjectId"" ON ""ProjectShares"" (""TeamWorkspaceId"", ""ProjectId"");
                CREATE INDEX IF NOT EXISTS ""IX_ProjectShares_ProjectId"" ON ""ProjectShares"" (""ProjectId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally no-op. This migration is idempotent schema hardening for
            // production databases that may already have been repaired by startup SQL.
        }
    }
}
