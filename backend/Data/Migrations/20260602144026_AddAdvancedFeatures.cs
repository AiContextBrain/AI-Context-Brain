using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdvancedFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /*
            migrationBuilder.AlterColumn<int>(
                name: "ScanCount",
                table: "Users",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "Plan",
                table: "Users",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefreshTokenExpiresAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefreshTokenHash",
                table: "Users",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
            */

            migrationBuilder.AddColumn<int>(
                name: "AddedFilesCount",
                table: "ProjectScans",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ChangedFilesJson",
                table: "ProjectScans",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeletedFilesCount",
                table: "ProjectScans",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsIncrementalScan",
                table: "ProjectScans",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ModifiedFilesCount",
                table: "ProjectScans",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            /*
            migrationBuilder.AddColumn<string>(
                name: "ScanFingerprint",
                table: "ProjectScans",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SemanticSummary",
                table: "ProjectScans",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmbeddingVectorJson",
                table: "Projects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ScanFingerprint",
                table: "Projects",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SemanticIndexJson",
                table: "Projects",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SemanticSummary",
                table: "Projects",
                type: "text",
                nullable: true);
            */

            migrationBuilder.AddColumn<string>(
                name: "AutoFixSuggestion",
                table: "ArchitectureRules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "ArchitectureRules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RuleType",
                table: "ArchitectureRules",
                type: "text",
                nullable: false,
                defaultValue: "Regex");

            migrationBuilder.AddColumn<string>(
                name: "Severity",
                table: "ArchitectureRules",
                type: "text",
                nullable: false,
                defaultValue: "Warning");

            /*
            migrationBuilder.CreateTable(
                name: "ActivityLogs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: true),
                    ProjectName = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TeamWorkspaces",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OwnerUserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamWorkspaces", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamWorkspaces_Users_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSettings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Notifications = table.Column<bool>(type: "boolean", nullable: false),
                    AutoScan = table.Column<bool>(type: "boolean", nullable: false),
                    DarkMode = table.Column<bool>(type: "boolean", nullable: false),
                    AiProvider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    MaxTokens = table.Column<int>(type: "integer", nullable: false),
                    ContextFormat = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ApiUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectShares",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamWorkspaceId = table.Column<string>(type: "text", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectShares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectShares_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectShares_TeamWorkspaces_TeamWorkspaceId",
                        column: x => x.TeamWorkspaceId,
                        principalTable: "TeamWorkspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TeamMembers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    TeamWorkspaceId = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamMembers_TeamWorkspaces_TeamWorkspaceId",
                        column: x => x.TeamWorkspaceId,
                        principalTable: "TeamWorkspaces",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectShares_ProjectId",
                table: "ProjectShares",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectShares_TeamWorkspaceId_ProjectId",
                table: "ProjectShares",
                columns: new[] { "TeamWorkspaceId", "ProjectId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamMembers_TeamWorkspaceId_UserId",
                table: "TeamMembers",
                columns: new[] { "TeamWorkspaceId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamMembers_UserId",
                table: "TeamMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamWorkspaces_OwnerUserId",
                table: "TeamWorkspaces",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSettings_UserId",
                table: "UserSettings",
                column: "UserId",
                unique: true);
            */
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /*
            migrationBuilder.DropTable(
                name: "ActivityLogs");

            migrationBuilder.DropTable(
                name: "ProjectShares");

            migrationBuilder.DropTable(
                name: "TeamMembers");

            migrationBuilder.DropTable(
                name: "UserSettings");

            migrationBuilder.DropTable(
                name: "TeamWorkspaces");

            migrationBuilder.DropColumn(
                name: "RefreshTokenExpiresAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RefreshTokenHash",
                table: "Users");
            */

            migrationBuilder.DropColumn(
                name: "AddedFilesCount",
                table: "ProjectScans");

            migrationBuilder.DropColumn(
                name: "ChangedFilesJson",
                table: "ProjectScans");

            migrationBuilder.DropColumn(
                name: "DeletedFilesCount",
                table: "ProjectScans");

            migrationBuilder.DropColumn(
                name: "IsIncrementalScan",
                table: "ProjectScans");

            migrationBuilder.DropColumn(
                name: "ModifiedFilesCount",
                table: "ProjectScans");

            /*
            migrationBuilder.DropColumn(
                name: "ScanFingerprint",
                table: "ProjectScans");

            migrationBuilder.DropColumn(
                name: "SemanticSummary",
                table: "ProjectScans");

            migrationBuilder.DropColumn(
                name: "EmbeddingVectorJson",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "ScanFingerprint",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "SemanticIndexJson",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "SemanticSummary",
                table: "Projects");
            */

            migrationBuilder.DropColumn(
                name: "AutoFixSuggestion",
                table: "ArchitectureRules");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "ArchitectureRules");

            migrationBuilder.DropColumn(
                name: "RuleType",
                table: "ArchitectureRules");

            migrationBuilder.DropColumn(
                name: "Severity",
                table: "ArchitectureRules");

            /*
            migrationBuilder.AlterColumn<int>(
                name: "ScanCount",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<int>(
                name: "Plan",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer");
            */
        }
    }
}
