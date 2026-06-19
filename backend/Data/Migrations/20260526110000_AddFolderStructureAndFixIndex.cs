using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFolderStructureAndFixIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add FolderStructureJson column to ProjectScans
            migrationBuilder.AddColumn<string>(
                name: "FolderStructureJson",
                table: "ProjectScans",
                type: "jsonb",
                nullable: false,
                defaultValue: "[]");

            // Drop old unique index on Path
            migrationBuilder.DropIndex(
                name: "IX_Projects_Path",
                table: "Projects");

            // Create new composite unique index on (Path, UserId)
            migrationBuilder.CreateIndex(
                name: "IX_Projects_Path_UserId",
                table: "Projects",
                columns: new[] { "Path", "UserId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Projects_Path_UserId",
                table: "Projects");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_Path",
                table: "Projects",
                column: "Path",
                unique: true);

            migrationBuilder.DropColumn(
                name: "FolderStructureJson",
                table: "ProjectScans");
        }
    }
}
