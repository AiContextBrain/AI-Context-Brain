using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceLsWithPaddle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop Lemon Squeezy columns (if they exist)
            migrationBuilder.Sql(@"
                ALTER TABLE ""Users""
                    DROP COLUMN IF EXISTS ""LsCustomerId"",
                    DROP COLUMN IF EXISTS ""LsSubscriptionId"",
                    DROP COLUMN IF EXISTS ""LsSubscriptionStatus"",
                    DROP COLUMN IF EXISTS ""LsVariantId"",
                    DROP COLUMN IF EXISTS ""LsCurrentPeriodEnd"";
            ");

            // Add Paddle columns (IF NOT EXISTS — idempotent)
            migrationBuilder.Sql(@"
                ALTER TABLE ""Users""
                    ADD COLUMN IF NOT EXISTS ""PaddleCustomerId"" text,
                    ADD COLUMN IF NOT EXISTS ""PaddleSubscriptionId"" text,
                    ADD COLUMN IF NOT EXISTS ""PaddleSubscriptionStatus"" text,
                    ADD COLUMN IF NOT EXISTS ""PaddlePriceId"" text,
                    ADD COLUMN IF NOT EXISTS ""PaddleCurrentPeriodEnd"" timestamp with time zone;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "PaddleCustomerId", table: "Users");
            migrationBuilder.DropColumn(name: "PaddleSubscriptionId", table: "Users");
            migrationBuilder.DropColumn(name: "PaddleSubscriptionStatus", table: "Users");
            migrationBuilder.DropColumn(name: "PaddlePriceId", table: "Users");
            migrationBuilder.DropColumn(name: "PaddleCurrentPeriodEnd", table: "Users");
        }
    }
}
