using System.Collections.Concurrent;

namespace AiContextBrain.Services;

public interface ILoginThrottleService
{
    bool IsBlocked(string key, out TimeSpan retryAfter);
    void RecordFailure(string key);
    void Reset(string key);
}

public class LoginThrottleService : ILoginThrottleService
{
    private sealed class AttemptWindow
    {
        public int Count { get; set; }
        public DateTime FirstAttemptAt { get; set; } = DateTime.UtcNow;
        public DateTime? BlockedUntil { get; set; }
    }

    private readonly ConcurrentDictionary<string, AttemptWindow> _attempts = new();
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan BlockDuration = TimeSpan.FromMinutes(15);
    private const int MaxAttempts = 5;

    public bool IsBlocked(string key, out TimeSpan retryAfter)
    {
        retryAfter = TimeSpan.Zero;
        if (!_attempts.TryGetValue(key, out var window))
        {
            return false;
        }

        if (DateTime.UtcNow - window.FirstAttemptAt > Window)
        {
            _attempts.TryRemove(key, out _);
            return false;
        }

        if (window.BlockedUntil is { } blockedUntil && blockedUntil > DateTime.UtcNow)
        {
            retryAfter = blockedUntil - DateTime.UtcNow;
            return true;
        }

        return false;
    }

    public void RecordFailure(string key)
    {
        var window = _attempts.AddOrUpdate(
            key,
            _ => new AttemptWindow { Count = 1 },
            (_, existing) =>
            {
                if (DateTime.UtcNow - existing.FirstAttemptAt > Window)
                {
                    existing.Count = 1;
                    existing.FirstAttemptAt = DateTime.UtcNow;
                    existing.BlockedUntil = null;
                }
                else
                {
                    existing.Count++;
                    if (existing.Count >= MaxAttempts)
                    {
                        existing.BlockedUntil = DateTime.UtcNow.Add(BlockDuration);
                    }
                }

                return existing;
            });

        if (window.Count >= MaxAttempts)
        {
            window.BlockedUntil ??= DateTime.UtcNow.Add(BlockDuration);
        }
    }

    public void Reset(string key)
    {
        _attempts.TryRemove(key, out _);
    }
}
