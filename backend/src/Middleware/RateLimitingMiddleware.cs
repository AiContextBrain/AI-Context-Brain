// ============================================
// Production Rate Limiting Middleware
// Per-IP, Per-User, Per-Endpoint throttling
// ============================================
using System.Collections.Concurrent;

namespace AiContextBrain.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;

    // Sliding window tracking: key -> (count, windowStart)
    private static readonly ConcurrentDictionary<string, RateWindow> _windows = new();
    private static readonly Timer _cleanupTimer;

    // Rate limit configurations
    private const int IpLimitPerMinute = 120;
    private const int UserLimitPerMinute = 180;
    private const int SensitiveLimitPerMinute = 30;
    private static readonly TimeSpan WindowDuration = TimeSpan.FromMinutes(1);

    // Sensitive endpoint prefixes (case-insensitive match)
    private static readonly string[] SensitiveEndpoints = new[]
    {
        "/project/scan-repo",
        "/project/generate-context",
        "/project/preview-context",
        "/architectureguard/suggest-fix",
        "/architectureguard/suggest-improvements",
        "/architectureguard/validate-file",
        "/architectureguard/validate-project",
        "/auth/login",
        "/auth/register",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/resend-verification",
        "/auth/verify-email"
    };

    static RateLimitingMiddleware()
    {
        // Cleanup expired windows every 5 minutes
        _cleanupTimer = new Timer(CleanupExpiredWindows, null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
    }

    public RateLimitingMiddleware(RequestDelegate next, ILogger<RateLimitingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        // Skip health endpoints
        if (path == "/" || path == "/api/health" || path.StartsWith("/health"))
        {
            await _next(context);
            return;
        }

        // 1. Per-IP rate limit (always applied)
        var ipKey = $"ip:{ip}";
        if (!TryConsumeToken(ipKey, IpLimitPerMinute))
        {
            _logger.LogWarning("Rate limit exceeded for IP {IP} on {Path}", ip, path);
            await WriteRateLimitResponse(context, "Too many requests from this IP address");
            return;
        }

        // 2. Per-User rate limit (if authenticated)
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        var token = authHeader?.Replace("Bearer ", "");
        if (!string.IsNullOrEmpty(token))
        {
            // Use token hash as key to avoid storing raw tokens
            var userKey = $"user:{token.GetHashCode():X8}";
            if (!TryConsumeToken(userKey, UserLimitPerMinute))
            {
                _logger.LogWarning("Rate limit exceeded for authenticated user on {Path}", path);
                await WriteRateLimitResponse(context, "Too many requests for this account");
                return;
            }

            // 3. Sensitive endpoint limit (stricter)
            if (IsSensitiveEndpoint(path))
            {
                var sensitiveKey = $"sensitive:{token.GetHashCode():X8}:{GetEndpointGroup(path)}";
                if (!TryConsumeToken(sensitiveKey, SensitiveLimitPerMinute))
                {
                    _logger.LogWarning("Sensitive endpoint rate limit exceeded for user on {Path}", path);
                    await WriteRateLimitResponse(context, "Rate limit exceeded for this operation. Please wait before retrying.");
                    return;
                }
            }
        }
        else
        {
            // Unauthenticated sensitive endpoint — stricter IP limit
            if (IsSensitiveEndpoint(path))
            {
                var anonSensitiveKey = $"anon-sensitive:{ip}:{GetEndpointGroup(path)}";
                if (!TryConsumeToken(anonSensitiveKey, 5)) // 5 req/min for unauthenticated
                {
                    _logger.LogWarning("Unauthenticated sensitive endpoint rate limit for IP {IP} on {Path}", ip, path);
                    await WriteRateLimitResponse(context, "Too many requests. Please authenticate or wait before retrying.");
                    return;
                }
            }
        }

        await _next(context);
    }

    private static bool TryConsumeToken(string key, int maxRequests)
    {
        var now = DateTime.UtcNow;
        var window = _windows.AddOrUpdate(
            key,
            _ => new RateWindow { Count = 1, WindowStart = now },
            (_, existing) =>
            {
                if (now - existing.WindowStart > WindowDuration)
                {
                    // Window expired — reset
                    existing.Count = 1;
                    existing.WindowStart = now;
                }
                else
                {
                    existing.Count++;
                }
                return existing;
            });

        return window.Count <= maxRequests;
    }

    private static bool IsSensitiveEndpoint(string path)
    {
        foreach (var endpoint in SensitiveEndpoints)
        {
            if (path.Contains(endpoint, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static string GetEndpointGroup(string path)
    {
        // Group related endpoints for shared limits
        if (path.Contains("scan-repo")) return "scan";
        if (path.Contains("generate-context")) return "generate";
        if (path.Contains("preview-context")) return "preview";
        if (path.Contains("suggest")) return "suggest";
        if (path.Contains("validate")) return "validate";
        if (path.Contains("login") || path.Contains("register") || path.Contains("forgot") || path.Contains("reset") || path.Contains("verify") || path.Contains("resend")) return "auth";
        return "general";
    }

    private static async Task WriteRateLimitResponse(HttpContext context, string message)
    {
        context.Response.StatusCode = 429;
        context.Response.Headers["Retry-After"] = "60";
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(new
        {
            error = "rate_limit_exceeded",
            message,
            retryAfterSeconds = 60
        }));
    }

    private static void CleanupExpiredWindows(object? state)
    {
        var now = DateTime.UtcNow;
        var cutoff = now - TimeSpan.FromMinutes(2);
        var expiredKeys = _windows
            .Where(kvp => kvp.Value.WindowStart < cutoff)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredKeys)
        {
            _windows.TryRemove(key, out _);
        }
    }

    private class RateWindow
    {
        public int Count { get; set; }
        public DateTime WindowStart { get; set; }
    }
}
