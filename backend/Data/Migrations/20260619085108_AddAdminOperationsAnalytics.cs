using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations;

public partial class AddAdminOperationsAnalytics : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Users"
                ADD COLUMN IF NOT EXISTS "AdminNotes" text NULL,
                ADD COLUMN IF NOT EXISTS "AiRequestLimitOverride" integer NULL,
                ADD COLUMN IF NOT EXISTS "BanReason" text NULL,
                ADD COLUMN IF NOT EXISTS "BannedAt" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS "ContextLimitOverride" integer NULL,
                ADD COLUMN IF NOT EXISTS "Country" text NULL,
                ADD COLUMN IF NOT EXISTS "DeletedAt" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS "IsBanned" boolean NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "IsTempEmail" boolean NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS "LastActivityAt" timestamptz NULL,
                ADD COLUMN IF NOT EXISTS "RegistrationSource" text NULL,
                ADD COLUMN IF NOT EXISTS "ScanLimitOverride" integer NULL,
                ADD COLUMN IF NOT EXISTS "TrustScore" integer NOT NULL DEFAULT 100;

            ALTER TABLE "Projects"
                ADD COLUMN IF NOT EXISTS "IsLocalInitialized" boolean NOT NULL DEFAULT TRUE;

            ALTER TABLE "Feedbacks"
                ADD COLUMN IF NOT EXISTS "AdminNote" text NULL,
                ADD COLUMN IF NOT EXISTS "Priority" character varying(20) NOT NULL DEFAULT 'normal',
                ADD COLUMN IF NOT EXISTS "RelatedFeature" text NULL,
                ADD COLUMN IF NOT EXISTS "Status" character varying(20) NOT NULL DEFAULT 'new';

            CREATE TABLE IF NOT EXISTS "AnalyticsSettings" (
                "Id" text NOT NULL,
                "Enabled" boolean NOT NULL DEFAULT FALSE,
                "GoogleAnalyticsId" character varying(50) NULL,
                "ClarityId" character varying(100) NULL,
                "UpdatedAt" timestamptz NOT NULL,
                CONSTRAINT "PK_AnalyticsSettings" PRIMARY KEY ("Id")
            );

            CREATE TABLE IF NOT EXISTS "AuditLogs" (
                "Id" text NOT NULL,
                "AdminUserId" text NOT NULL,
                "Action" character varying(50) NOT NULL,
                "TargetUserId" text NOT NULL,
                "Details" text NULL,
                "CreatedAt" timestamptz NOT NULL,
                CONSTRAINT "PK_AuditLogs" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_AdminUserId" ON "AuditLogs" ("AdminUserId");
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_CreatedAt" ON "AuditLogs" ("CreatedAt");
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_TargetUserId" ON "AuditLogs" ("TargetUserId");

            CREATE TABLE IF NOT EXISTS "DisposableDomains" (
                "Id" text NOT NULL,
                "Domain" character varying(200) NOT NULL,
                "CreatedAt" timestamptz NOT NULL,
                CONSTRAINT "PK_DisposableDomains" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_DisposableDomains_Domain" ON "DisposableDomains" ("Domain");

            CREATE TABLE IF NOT EXISTS "EmailLogs" (
                "Id" text NOT NULL,
                "UserId" text NULL,
                "RecipientEmail" text NOT NULL,
                "EmailType" character varying(50) NOT NULL,
                "Subject" text NOT NULL,
                "Status" character varying(20) NOT NULL DEFAULT 'sent',
                "ErrorMessage" text NULL,
                "CreatedAt" timestamptz NOT NULL,
                CONSTRAINT "PK_EmailLogs" PRIMARY KEY ("Id")
            );
            CREATE INDEX IF NOT EXISTS "IX_EmailLogs_CreatedAt" ON "EmailLogs" ("CreatedAt");
            CREATE INDEX IF NOT EXISTS "IX_EmailLogs_UserId" ON "EmailLogs" ("UserId");
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS "AnalyticsSettings";
            DROP TABLE IF EXISTS "AuditLogs";
            DROP TABLE IF EXISTS "DisposableDomains";
            DROP TABLE IF EXISTS "EmailLogs";

            ALTER TABLE "Feedbacks"
                DROP COLUMN IF EXISTS "AdminNote",
                DROP COLUMN IF EXISTS "Priority",
                DROP COLUMN IF EXISTS "RelatedFeature",
                DROP COLUMN IF EXISTS "Status";

            ALTER TABLE "Projects" DROP COLUMN IF EXISTS "IsLocalInitialized";

            ALTER TABLE "Users"
                DROP COLUMN IF EXISTS "AdminNotes",
                DROP COLUMN IF EXISTS "AiRequestLimitOverride",
                DROP COLUMN IF EXISTS "BanReason",
                DROP COLUMN IF EXISTS "BannedAt",
                DROP COLUMN IF EXISTS "ContextLimitOverride",
                DROP COLUMN IF EXISTS "Country",
                DROP COLUMN IF EXISTS "DeletedAt",
                DROP COLUMN IF EXISTS "IsBanned",
                DROP COLUMN IF EXISTS "IsDeleted",
                DROP COLUMN IF EXISTS "IsTempEmail",
                DROP COLUMN IF EXISTS "LastActivityAt",
                DROP COLUMN IF EXISTS "RegistrationSource",
                DROP COLUMN IF EXISTS "ScanLimitOverride",
                DROP COLUMN IF EXISTS "TrustScore";
            """);
    }
}
