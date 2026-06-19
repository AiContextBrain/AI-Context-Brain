using AiContextBrain.Dtos;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AiContextBrain.Services;

public static class SemanticAnalysisService
{
    private const int Dimensions = 64;

    public static string BuildScanFingerprint(ScanResult scanResult)
    {
        var payload = JsonSerializer.Serialize(new
        {
            scanResult.Framework,
            scanResult.ArchitectureType,
            scanResult.DatabaseType,
            scanResult.AuthSystem,
            folders = scanResult.FolderStructure.OrderBy(f => f),
            deps = scanResult.Metrics.Dependencies.OrderBy(d => d),
            scanResult.Metrics.FilesCount,
            scanResult.Metrics.LinesOfCode,
            scanResult.Metrics.TotalSizeBytes,
            architectureMaps = new
            {
                routeCount = scanResult.Metrics.RouteMap?.Count ?? 0,
                serviceCount = scanResult.Metrics.ServiceGraph?.Count ?? 0,
                entityCount = scanResult.Metrics.EntityMap?.Count ?? 0,
                dtoCount = scanResult.Metrics.DtoMap?.Count ?? 0,
                aiProviderCount = scanResult.Metrics.AiProviderMap?.Count ?? 0,
                planEnforcementCount = scanResult.Metrics.PlanEnforcementMap?.Count ?? 0,
                extensionExportCount = scanResult.Metrics.ExtensionExportMap?.Count ?? 0,
                testBuildCount = scanResult.Metrics.TestBuildMap?.Count ?? 0,
                controllers = scanResult.Metrics.RouteMap?.Select(r => r.Controller).OrderBy(v => v).Distinct(),
                entities = scanResult.Metrics.EntityMap?.Select(e => e.Name).OrderBy(v => v).Distinct(),
                dtos = scanResult.Metrics.DtoMap?.Select(d => d.Name).OrderBy(v => v).Distinct()
            }
        });

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }

    public static string BuildSemanticSummary(ScanResult scanResult)
    {
        var dominantDeps = scanResult.Metrics.Dependencies.Take(12).DefaultIfEmpty("no dependencies reported");
        var folders = scanResult.FolderStructure
            .Where(f => f.EndsWith("/") || !f.Contains('.'))
            .Take(12)
            .DefaultIfEmpty("no folder structure reported");

        return string.Join(" ", new[]
        {
            $"Framework: {scanResult.Framework}.",
            $"Architecture: {scanResult.ArchitectureType}.",
            $"Database: {scanResult.DatabaseType}.",
            $"Auth: {scanResult.AuthSystem}.",
            $"Scale: {scanResult.Metrics.FilesCount} files, {scanResult.Metrics.LinesOfCode} lines.",
            $"Important folders: {string.Join(", ", folders)}.",
            $"Key dependencies: {string.Join(", ", dominantDeps)}.",
            $"Detected patterns: {string.Join(", ", scanResult.DetectedPatterns.Take(12))}."
        });
    }

    public static string BuildSemanticIndex(ScanResult scanResult)
    {
        var index = new
        {
            keywords = new[]
            {
                scanResult.Framework,
                scanResult.ArchitectureType,
                scanResult.DatabaseType,
                scanResult.AuthSystem
            }.Concat(scanResult.DetectedPatterns).Where(v => !string.IsNullOrWhiteSpace(v)).Distinct(),
            folders = scanResult.FolderStructure.Take(40),
            dependencies = scanResult.Metrics.Dependencies.Take(40),
            metrics = new
            {
                scanResult.Metrics.FilesCount,
                scanResult.Metrics.LinesOfCode,
                scanResult.Metrics.FoldersCount
            },
            priority = new[]
            {
                "architecture-rules",
                "coding-conventions",
                "system-decisions",
                "dependencies",
                "folder-structure",
                "semantic-summary"
            }
        };

        return JsonSerializer.Serialize(index);
    }

    public static string BuildEmbeddingVectorJson(string text)
    {
        return JsonSerializer.Serialize(BuildEmbedding(text));
    }

    public static double Score(string query, string? vectorJson, string? fallbackText)
    {
        var queryVector = BuildEmbedding(query);
        var projectVector = ParseVector(vectorJson) ?? BuildEmbedding(fallbackText ?? "");
        return Cosine(queryVector, projectVector);
    }

    private static double[] BuildEmbedding(string text)
    {
        var vector = new double[Dimensions];
        foreach (var token in Tokenize(text))
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            var index = BitConverter.ToUInt16(hash, 0) % Dimensions;
            var sign = (hash[2] & 1) == 0 ? 1 : -1;
            vector[index] += sign * Math.Log(2 + token.Length);
        }

        var norm = Math.Sqrt(vector.Sum(v => v * v));
        if (norm == 0) return vector;
        for (var i = 0; i < vector.Length; i++)
        {
            vector[i] /= norm;
        }

        return vector;
    }

    private static IEnumerable<string> Tokenize(string text)
    {
        return Regex.Matches(text.ToLowerInvariant(), "[a-z0-9_+#.-]{2,}")
            .Select(m => m.Value)
            .Where(t => !StopWords.Contains(t));
    }

    private static double[]? ParseVector(string? vectorJson)
    {
        if (string.IsNullOrWhiteSpace(vectorJson)) return null;
        try { return JsonSerializer.Deserialize<double[]>(vectorJson); }
        catch { return null; }
    }

    private static double Cosine(double[] left, double[] right)
    {
        var length = Math.Min(left.Length, right.Length);
        var dot = 0d;
        for (var i = 0; i < length; i++)
        {
            dot += left[i] * right[i];
        }

        return Math.Round(dot, 4);
    }

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "and", "for", "with", "from", "this", "that", "into", "your", "project",
        "files", "lines", "code", "reported", "detected"
    };
}
