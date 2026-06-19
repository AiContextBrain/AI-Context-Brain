using System;
using System.Threading.Tasks;
using Npgsql;

class Program
{
    static async Task Main(string[] args)
    {
        var connString = "Host=aws-0-eu-west-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.ifpthidrknejmfupwdhs;Password=LPLWsgRoi8qoQqFB;SslMode=Require;TrustServerCertificate=True;";
        
        Console.WriteLine("Connecting to Supabase database to update user...");
        using var conn = new NpgsqlConnection(connString);
        try
        {
            await conn.OpenAsync();
            Console.WriteLine("✔ Connected successfully.");

            // Update query
            using var cmd = new NpgsqlCommand(
                "UPDATE \"Users\" SET \"IsEmailVerified\" = true, \"Role\" = 1 WHERE \"Email\" = 'ismailmrc24@gmail.com';", 
                conn
            );
            
            var affected = await cmd.ExecuteNonQueryAsync();
            Console.WriteLine($"✔ Update completed. Affected rows: {affected}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✘ Error: {ex.Message}");
        }
    }
}
