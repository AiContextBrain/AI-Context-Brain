using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialPostgreSql : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FrameworkPatterns",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DetectionRules = table.Column<string>(type: "jsonb", nullable: false),
                    FolderStructure = table.Column<string>(type: "jsonb", nullable: false),
                    CommonDependencies = table.Column<string>(type: "text", nullable: true),
                    TypicalCommands = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FrameworkPatterns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    ApiToken = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExtensionAuths",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtensionAuths", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtensionAuths_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Projects",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Framework = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ArchitectureType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DatabaseType = table.Column<string>(type: "text", nullable: true),
                    AuthSystem = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Projects_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "AIContexts",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AIContexts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AIContexts_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ArchitectureRules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Pattern = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    FolderPath = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArchitectureRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArchitectureRules_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CodingConventions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Rule = table.Column<string>(type: "text", nullable: false),
                    Example = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Language = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CodingConventions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CodingConventions_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectScans",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ScanDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScanData = table.Column<string>(type: "jsonb", nullable: false),
                    Framework = table.Column<string>(type: "text", nullable: true),
                    ArchitectureType = table.Column<string>(type: "text", nullable: true),
                    FilesCount = table.Column<int>(type: "integer", nullable: false),
                    LinesOfCode = table.Column<int>(type: "integer", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectScans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectScans_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SystemDecisions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Decision = table.Column<string>(type: "text", nullable: false),
                    Reasoning = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Category = table.Column<string>(type: "text", nullable: true),
                    DecisionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProjectId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemDecisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SystemDecisions_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AIContexts_ProjectId",
                table: "AIContexts",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ArchitectureRules_ProjectId",
                table: "ArchitectureRules",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_CodingConventions_ProjectId",
                table: "CodingConventions",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionAuths_Token",
                table: "ExtensionAuths",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionAuths_UserId",
                table: "ExtensionAuths",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_Path",
                table: "Projects",
                column: "Path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Projects_UserId",
                table: "Projects",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectScans_ProjectId",
                table: "ProjectScans",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemDecisions_ProjectId",
                table: "SystemDecisions",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AIContexts");

            migrationBuilder.DropTable(
                name: "ArchitectureRules");

            migrationBuilder.DropTable(
                name: "CodingConventions");

            migrationBuilder.DropTable(
                name: "ExtensionAuths");

            migrationBuilder.DropTable(
                name: "FrameworkPatterns");

            migrationBuilder.DropTable(
                name: "ProjectScans");

            migrationBuilder.DropTable(
                name: "SystemDecisions");

            migrationBuilder.DropTable(
                name: "Projects");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
