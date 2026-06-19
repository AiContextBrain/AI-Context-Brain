using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AiContextBrain.Data;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class PaymentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    // Paddle config — set in environment variables
    private string PaddleApiKey => _config["Paddle:ApiKey"] ?? "";
    private string PaddleWebhookSecret => _config["Paddle:WebhookSecret"] ?? "";
    private string ProMonthlyPriceId => _config["Paddle:ProMonthlyPriceId"] ?? "";
    private string ProYearlyPriceId => _config["Paddle:ProYearlyPriceId"] ?? "";
    private string TeamMonthlyPriceId => _config["Paddle:TeamMonthlyPriceId"] ?? "";
    private string TeamYearlyPriceId => _config["Paddle:TeamYearlyPriceId"] ?? "";
    private string WebUrl => _config["App:WebUrl"] ?? "https://aicontextbrain.me";

    // Paddle API base (sandbox vs production)
    private string PaddleApiBase => PaddleApiKey.StartsWith("test_") 
        ? "https://sandbox-api.paddle.com" 
        : "https://api.paddle.com";

    public PaymentController(ApplicationDbContext context, IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _config = config;
        _http = httpClientFactory.CreateClient("Paddle");
    }

    // POST /payment/checkout
    // Body: { "plan": "pro"|"team", "billing": "monthly"|"yearly" }
    [HttpPost("checkout")]
    public async Task<IActionResult> CreateCheckout([FromBody] CheckoutRequest request)
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var normalizedPlan = request.Plan?.Trim().ToLowerInvariant();
        var normalizedBilling = request.Billing?.Trim().ToLowerInvariant();
        if (normalizedPlan is not ("pro" or "team"))
        {
            return BadRequest(new { error = "invalid_plan", allowed = new[] { "pro", "team" } });
        }
        if (normalizedBilling is not ("monthly" or "yearly"))
        {
            return BadRequest(new { error = "invalid_billing", allowed = new[] { "monthly", "yearly" } });
        }

        var priceId = (normalizedPlan, normalizedBilling) switch
        {
            ("pro", "yearly")   => ProYearlyPriceId,
            ("pro", "monthly")  => ProMonthlyPriceId,
            ("team", "monthly") => TeamMonthlyPriceId,
            ("team", "yearly")  => TeamYearlyPriceId,
            _                   => ""
        };

        if (string.IsNullOrEmpty(priceId))
            return StatusCode(500, new { error = "Payment not configured. Contact support." });

        var successUrl = $"{WebUrl}/dashboard?payment=success";
        var cancelUrl  = $"{WebUrl}/pricing?payment=cancelled";

        // Paddle Billing: create transaction (checkout session)
        var payload = new
        {
            items = new[] { new { price_id = priceId, quantity = 1 } },
            customer = string.IsNullOrEmpty(user.PaddleCustomerId)
                ? new { email = user.Email }
                : null,
            customer_id = string.IsNullOrEmpty(user.PaddleCustomerId) ? null : user.PaddleCustomerId,
            custom_data = new Dictionary<string, string> { { "user_id", user.Id } },
            success_url = successUrl,
            cancel_url = cancelUrl,
        };

        var req = new HttpRequestMessage(HttpMethod.Post, $"{PaddleApiBase}/transactions");
        req.Headers.Add("Authorization", $"Bearer {PaddleApiKey}");
        req.Content = new StringContent(JsonSerializer.Serialize(payload,
            new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }),
            Encoding.UTF8, "application/json");

        var resp = await _http.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();

        if (!resp.IsSuccessStatusCode)
        {
            Console.WriteLine($"[Paddle] Checkout creation failed ({(int)resp.StatusCode}): {body}");
            return StatusCode(502, new { error = "Failed to create checkout" });
        }

        using var doc = JsonDocument.Parse(body);
        var data = doc.RootElement.GetProperty("data");
        var transactionId = data.GetProperty("id").GetString();
        var checkoutUrl = data.GetProperty("checkout").GetProperty("url").GetString();

        return Ok(new { transactionId, checkoutUrl });
    }

    // GET /payment/portal
    [HttpGet("portal")]
    public async Task<IActionResult> GetPortal()
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        if (string.IsNullOrEmpty(user.PaddleCustomerId))
            return NotFound(new { error = "No active subscription found" });

        // Generate Paddle customer portal session
        var req = new HttpRequestMessage(HttpMethod.Post,
            $"{PaddleApiBase}/customers/{user.PaddleCustomerId}/auth-token");
        req.Headers.Add("Authorization", $"Bearer {PaddleApiKey}");
        req.Content = new StringContent("{}", Encoding.UTF8, "application/json");

        var resp = await _http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
            return StatusCode(502, new { error = "Could not open billing portal" });

        var body = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var authToken = doc.RootElement.GetProperty("data").GetProperty("customer_auth_token").GetString();

        var portalBase = PaddleApiKey.StartsWith("test_")
            ? "https://sandbox-buyer-portal.paddle.com"
            : "https://buyer.paddle.com";
        var portalUrl = $"{portalBase}?customerAuthToken={authToken}";

        return Ok(new { portalUrl });
    }

    // GET /payment/subscription
    [HttpGet("subscription")]
    public async Task<IActionResult> GetSubscription()
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });

        var status = user.PaddleSubscriptionStatus ?? "none";
        var willDowngradeAtPeriodEnd = status is "canceled" or "cancelled" or "past_due"
            && user.PaddleCurrentPeriodEnd.HasValue
            && user.PaddleCurrentPeriodEnd.Value > DateTime.UtcNow;

        return Ok(new
        {
            plan = user.Plan.ToString(),
            status,
            currentPeriodEnd = user.PaddleCurrentPeriodEnd,
            willDowngradeAtPeriodEnd,
            downgradeAt = willDowngradeAtPeriodEnd ? user.PaddleCurrentPeriodEnd : null,
            customerId = user.PaddleCustomerId,
            subscriptionId = user.PaddleSubscriptionId,
            priceId = user.PaddlePriceId,
        });
    }

    // POST /payment/subscription/cancel
    // Cancels at the end of the current billing period; access remains active until then.
    [HttpPost("subscription/cancel")]
    public async Task<IActionResult> CancelSubscription()
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });
        if (string.IsNullOrWhiteSpace(user.PaddleSubscriptionId))
            return NotFound(new { error = "No active subscription found" });

        var payload = new { effective_from = "next_billing_period" };
        var req = new HttpRequestMessage(HttpMethod.Post, $"{PaddleApiBase}/subscriptions/{user.PaddleSubscriptionId}/cancel");
        req.Headers.Add("Authorization", $"Bearer {PaddleApiKey}");
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var resp = await _http.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
        {
            Console.WriteLine($"[Paddle] Subscription cancellation failed ({(int)resp.StatusCode}): {body}");
            return StatusCode(502, new { error = "Could not cancel subscription" });
        }

        TryApplySubscriptionResponse(user, body);
        user.PaddleSubscriptionStatus = "canceled";
        user.ApplyBillingState();
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Subscription will cancel at the end of the current billing period.",
            plan = user.Plan.ToString(),
            status = user.PaddleSubscriptionStatus,
            currentPeriodEnd = user.PaddleCurrentPeriodEnd,
            willDowngradeAtPeriodEnd = user.PaddleCurrentPeriodEnd.HasValue && user.PaddleCurrentPeriodEnd.Value > DateTime.UtcNow
        });
    }

    // POST /payment/subscription/resume
    // Removes a scheduled cancellation by clearing Paddle's scheduled_change.
    [HttpPost("subscription/resume")]
    public async Task<IActionResult> ResumeSubscription()
    {
        var user = await GetUserAsync();
        if (user == null) return Unauthorized(new { error = "Invalid or missing token" });
        if (string.IsNullOrWhiteSpace(user.PaddleSubscriptionId))
            return NotFound(new { error = "No subscription found" });

        var payload = new { scheduled_change = (object?)null };
        var req = new HttpRequestMessage(HttpMethod.Patch, $"{PaddleApiBase}/subscriptions/{user.PaddleSubscriptionId}");
        req.Headers.Add("Authorization", $"Bearer {PaddleApiKey}");
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var resp = await _http.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
        {
            Console.WriteLine($"[Paddle] Subscription resume failed ({(int)resp.StatusCode}): {body}");
            return StatusCode(502, new { error = "Could not resume subscription" });
        }

        TryApplySubscriptionResponse(user, body);
        user.PaddleSubscriptionStatus = "active";
        user.Plan = ResolvePlan(user.PaddlePriceId ?? "", "active");
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Subscription resumed.",
            plan = user.Plan.ToString(),
            status = user.PaddleSubscriptionStatus,
            currentPeriodEnd = user.PaddleCurrentPeriodEnd,
            willDowngradeAtPeriodEnd = false
        });
    }

    // POST /payment/webhook
    // Paddle sends signed events here
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        var signature = Request.Headers["Paddle-Signature"].FirstOrDefault() ?? "";
        using var reader = new StreamReader(Request.Body);
        var rawBody = await reader.ReadToEndAsync();

        if (!VerifyPaddleSignature(rawBody, signature))
            return Unauthorized(new { error = "Invalid signature" });

        using var doc = JsonDocument.Parse(rawBody);
        var root = doc.RootElement;
        var eventType = root.GetProperty("event_type").GetString();
        var data = root.GetProperty("data");

        // Extract user_id from custom_data (top-level or nested in items)
        var userId = (string?)null;
        if (data.TryGetProperty("custom_data", out var cd) && cd.ValueKind != JsonValueKind.Null)
            if (cd.TryGetProperty("user_id", out var uidEl))
                userId = uidEl.GetString();

        // Fallback: check items[0].custom_data
        if (string.IsNullOrEmpty(userId) && data.TryGetProperty("items", out var itemsEl) && itemsEl.GetArrayLength() > 0)
            if (itemsEl[0].TryGetProperty("custom_data", out var icd) && icd.ValueKind != JsonValueKind.Null)
                if (icd.TryGetProperty("user_id", out var iuid))
                    userId = iuid.GetString();

        User? user = null;
        if (!string.IsNullOrEmpty(userId))
            user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

        // Fallback: find user by Paddle customer_id
        if (user == null && data.TryGetProperty("customer_id", out var cidEl))
            user = await _context.Users.FirstOrDefaultAsync(u => u.PaddleCustomerId == cidEl.GetString());

        if (user == null) return Ok(new { message = "user not found, skipped" });

        switch (eventType)
        {
            case "transaction.completed":
            {
                // Immediately upgrade plan on successful payment
                var txCustomerId = data.TryGetProperty("customer_id", out var tcid) ? tcid.GetString() : null;
                var txPriceId = (string?)null;
                if (data.TryGetProperty("items", out var txItems2) && txItems2.GetArrayLength() > 0)
                    if (txItems2[0].TryGetProperty("price", out var txPrice))
                        if (txPrice.TryGetProperty("id", out var txPidEl))
                            txPriceId = txPidEl.GetString();
                if (txCustomerId != null) user.PaddleCustomerId = txCustomerId;
                if (txPriceId != null)
                {
                    user.PaddlePriceId = txPriceId;
                    user.Plan = ResolvePlan(txPriceId, "active");
                    user.PaddleSubscriptionStatus = "active";
                }
                ApplyPeriodEnd(user, data);
                break;
            }

            case "subscription.created":
            case "subscription.updated":
            case "subscription.activated":
            {
                var status = data.GetProperty("status").GetString();
                var subId = data.GetProperty("id").GetString();
                var customerId = data.GetProperty("customer_id").GetString();

                // Get price id from first item
                var priceId = (string?)null;
                if (data.TryGetProperty("items", out var items) && items.GetArrayLength() > 0)
                    priceId = items[0].GetProperty("price").GetProperty("id").GetString();

                user.PaddleCustomerId = customerId;
                user.PaddleSubscriptionId = subId;
                user.PaddleSubscriptionStatus = HasScheduledCancellation(data) ? "canceled" : status;
                user.PaddlePriceId = priceId;
                ApplyPeriodEnd(user, data);
                user.Plan = ResolvePlan(priceId ?? "", status ?? "");
                user.ApplyBillingState();
                break;
            }

            case "subscription.canceled":
            case "subscription.cancelled":
            {
                user.PaddleSubscriptionStatus = "canceled";
                ApplyPeriodEnd(user, data);
                if (user.PaddleCurrentPeriodEnd.HasValue && user.PaddleCurrentPeriodEnd > DateTime.UtcNow)
                    break; // keep plan until period ends
                user.Plan = UserPlan.Free;
                break;
            }

            case "subscription.past_due":
            {
                user.PaddleSubscriptionStatus = "past_due";
                ApplyPeriodEnd(user, data);
                user.ApplyBillingState();
                break;
            }

            case "subscription.paused":
            {
                user.PaddleSubscriptionStatus = "paused";
                ApplyPeriodEnd(user, data);
                user.Plan = UserPlan.Free;
                break;
            }

            case "subscription.resumed":
            {
                user.PaddleSubscriptionStatus = "active";
                ApplyPeriodEnd(user, data);
                user.Plan = ResolvePlan(user.PaddlePriceId ?? "", "active");
                break;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { received = true, eventType });
    }

    private UserPlan ResolvePlan(string priceId, string status)
    {
        if (status is not ("active" or "trialing")) return UserPlan.Free;

        if (priceId == TeamMonthlyPriceId || priceId == TeamYearlyPriceId)
            return UserPlan.Team;

        if (priceId == ProMonthlyPriceId || priceId == ProYearlyPriceId)
            return UserPlan.Pro;

        Console.WriteLine($"[Paddle] Unknown price id '{priceId}' for status '{status}'. Access remains on Free plan.");
        return UserPlan.Free;
    }

    private static void ApplyPeriodEnd(User user, JsonElement data)
    {
        if (data.TryGetProperty("current_billing_period", out var period)
            && period.TryGetProperty("ends_at", out var endsAt)
            && endsAt.ValueKind != JsonValueKind.Null
            && endsAt.TryGetDateTime(out var parsedEnd))
        {
            user.PaddleCurrentPeriodEnd = parsedEnd;
            return;
        }

        if (data.TryGetProperty("billing_period", out var billingPeriod)
            && billingPeriod.TryGetProperty("ends_at", out var billingEndsAt)
            && billingEndsAt.ValueKind != JsonValueKind.Null
            && billingEndsAt.TryGetDateTime(out var parsedBillingEnd))
        {
            user.PaddleCurrentPeriodEnd = parsedBillingEnd;
        }
    }

    private static void TryApplySubscriptionResponse(User user, string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("data", out var data))
            {
                return;
            }

            if (data.TryGetProperty("status", out var statusEl))
                user.PaddleSubscriptionStatus = statusEl.GetString();
            if (data.TryGetProperty("id", out var idEl))
                user.PaddleSubscriptionId = idEl.GetString();
            if (data.TryGetProperty("customer_id", out var customerEl))
                user.PaddleCustomerId = customerEl.GetString();
            if (data.TryGetProperty("items", out var items) && items.GetArrayLength() > 0)
                if (items[0].TryGetProperty("price", out var price) && price.TryGetProperty("id", out var priceId))
                    user.PaddlePriceId = priceId.GetString();

            ApplyPeriodEnd(user, data);
            if (HasScheduledCancellation(data))
            {
                user.PaddleSubscriptionStatus = "canceled";
            }
        }
        catch
        {
            // The local subscription state still updates below even if Paddle changes the response shape.
        }
    }

    private static bool HasScheduledCancellation(JsonElement data)
    {
        return data.TryGetProperty("scheduled_change", out var scheduledChange)
            && scheduledChange.ValueKind != JsonValueKind.Null
            && scheduledChange.TryGetProperty("action", out var action)
            && string.Equals(action.GetString(), "cancel", StringComparison.OrdinalIgnoreCase);
    }

    private Task<User?> GetUserAsync()
    {
        return _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
    }

    // Paddle webhook signature: TS=timestamp;H1=hmac_hash
    private bool VerifyPaddleSignature(string body, string signatureHeader)
    {
        if (string.IsNullOrEmpty(PaddleWebhookSecret))
        {
            var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "";
            return environment.Equals("Development", StringComparison.OrdinalIgnoreCase);
        }

        try
        {
            var parts = signatureHeader.Split(';');
            var ts = parts.FirstOrDefault(p => p.StartsWith("ts="))?.Substring(3) ?? "";
            var h1 = parts.FirstOrDefault(p => p.StartsWith("h1="))?.Substring(3) ?? "";
            if (!long.TryParse(ts, out var unixTimestamp))
            {
                return false;
            }

            var signedAt = DateTimeOffset.FromUnixTimeSeconds(unixTimestamp);
            if (DurationBetween(DateTimeOffset.UtcNow, signedAt) > TimeSpan.FromMinutes(5))
            {
                return false;
            }

            var signed = $"{ts}:{body}";
            var key = Encoding.UTF8.GetBytes(PaddleWebhookSecret);
            var expected = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(signed));
            var actual = Convert.FromHexString(h1);
            return actual.Length == expected.Length && CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch { return false; }
    }

    private static TimeSpan DurationBetween(DateTimeOffset left, DateTimeOffset right)
    {
        var duration = left - right;
        return duration < TimeSpan.Zero ? duration.Negate() : duration;
    }
}

public class CheckoutRequest
{
    public string Plan { get; set; } = "pro";
    public string Billing { get; set; } = "monthly";
}
