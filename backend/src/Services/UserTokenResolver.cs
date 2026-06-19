using AiContextBrain.Data;
using AiContextBrain.Models;
using Microsoft.EntityFrameworkCore;

namespace AiContextBrain.Services;

public static class UserTokenResolver
{
    public static async Task<User?> ResolveUserFromBearerTokenAsync(
        this ApplicationDbContext context,
        string? authorizationHeader)
    {
        var token = authorizationHeader?.Replace("Bearer ", "", StringComparison.OrdinalIgnoreCase).Trim();
        if (string.IsNullOrEmpty(token))
        {
            return null;
        }

        var user = await context.Users.FirstOrDefaultAsync(u => u.ApiToken == token);
        if (user != null)
        {
            // Block banned or soft-deleted users
            if (user.IsBanned || user.IsDeleted) return null;

            var now = DateTime.UtcNow;
            var shouldUpdateActivity = !user.LastActivityAt.HasValue || user.LastActivityAt.Value < now.AddMinutes(-5);
            var billingChanged = user.ApplyBillingState(now);
            if (shouldUpdateActivity)
            {
                user.LastActivityAt = now;
            }
            if (billingChanged || shouldUpdateActivity)
            {
                await context.SaveChangesAsync();
            }
            return user;
        }

        var extAuth = await context.ExtensionAuths
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Token == token && e.ExpiresAt > DateTime.UtcNow);

        if (extAuth?.User != null)
        {
            // Block banned or soft-deleted users
            if (extAuth.User.IsBanned || extAuth.User.IsDeleted) return null;

            var now = DateTime.UtcNow;
            var shouldUpdateActivity = !extAuth.User.LastActivityAt.HasValue || extAuth.User.LastActivityAt.Value < now.AddMinutes(-5);
            var billingChanged = extAuth.User.ApplyBillingState(now);
            if (shouldUpdateActivity)
            {
                extAuth.User.LastActivityAt = now;
            }
            if (billingChanged || shouldUpdateActivity)
            {
                await context.SaveChangesAsync();
            }
        }

        return extAuth?.User;
    }
}
