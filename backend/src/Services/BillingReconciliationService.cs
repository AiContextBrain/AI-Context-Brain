using AiContextBrain.Data;
using AiContextBrain.Models;
using Microsoft.EntityFrameworkCore;

namespace AiContextBrain.Services;

public class BillingReconciliationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BillingReconciliationService> _logger;

    public BillingReconciliationService(
        IServiceScopeFactory scopeFactory,
        ILogger<BillingReconciliationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await ReconcileExpiredSubscriptionsAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task ReconcileExpiredSubscriptionsAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var candidates = await context.Users
                .Where(u => u.Plan != UserPlan.Free
                    && u.PaddleSubscriptionStatus != null
                    && (u.PaddleSubscriptionStatus == "canceled"
                        || u.PaddleSubscriptionStatus == "cancelled"
                        || u.PaddleSubscriptionStatus == "past_due"
                        || u.PaddleSubscriptionStatus == "paused"))
                .ToListAsync(cancellationToken);

            var changed = 0;
            foreach (var user in candidates)
            {
                if (user.ApplyBillingState())
                {
                    changed++;
                }
            }

            if (changed > 0)
            {
                await context.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Billing reconciliation downgraded {Count} expired subscriptions to Free.", changed);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Billing reconciliation failed.");
        }
    }
}
