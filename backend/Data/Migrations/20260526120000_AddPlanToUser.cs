using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Plan",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0); // 0 = Free

            migrationBuilder.AddColumn<int>(
                name: "ScanCount",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScanResetDate",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "NOW() + INTERVAL '1 month'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Plan", table: "Users");
            migrationBuilder.DropColumn(name: "ScanCount", table: "Users");
            migrationBuilder.DropColumn(name: "ScanResetDate", table: "Users");
        }
    }
}
