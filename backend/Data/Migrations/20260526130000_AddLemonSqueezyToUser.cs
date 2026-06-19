using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLemonSqueezyToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LsCustomerId",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LsSubscriptionId",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LsSubscriptionStatus",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LsVariantId",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LsCurrentPeriodEnd",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "LsCustomerId", table: "Users");
            migrationBuilder.DropColumn(name: "LsSubscriptionId", table: "Users");
            migrationBuilder.DropColumn(name: "LsSubscriptionStatus", table: "Users");
            migrationBuilder.DropColumn(name: "LsVariantId", table: "Users");
            migrationBuilder.DropColumn(name: "LsCurrentPeriodEnd", table: "Users");
        }
    }
}
