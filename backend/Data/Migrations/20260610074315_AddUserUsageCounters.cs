using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiContextBrain.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserUsageCounters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Columns already created via self-healing raw SQL in Program.cs
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op
        }
    }
}
