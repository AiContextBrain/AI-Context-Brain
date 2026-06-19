using AiContextBrain.Models;
using AiContextBrain.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace AiContextBrain.Services;

public class EmailService : IEmailService
{
    private readonly EmailConfig _config;
    private readonly ILogger<EmailService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private static readonly HttpClient HttpClient = new HttpClient();

    public EmailService(EmailConfig config, ILogger<EmailService> logger, IServiceScopeFactory scopeFactory)
    {
        _config = config;
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    public async Task SendEmailAsync(string to, string subject, string htmlBody, string textBody, string emailType = "generic")
    {
        if (string.IsNullOrWhiteSpace(_config.ResendApiKey))
        {
            const string error = "Resend API key is not configured. Set RESEND_API_KEY.";
            await LogDeliveryAsync(to, subject, emailType, "failed", error);
            throw new InvalidOperationException(error);
        }

        if (string.IsNullOrWhiteSpace(_config.FromEmail))
        {
            const string error = "Sender email is not configured. Set SMTP_FROM_EMAIL or Email__FromEmail to a Resend-verified sender.";
            await LogDeliveryAsync(to, subject, emailType, "failed", error);
            throw new InvalidOperationException(error);
        }

        _logger.LogInformation("Attempting to send email to {To} via Resend API...", to);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.ResendApiKey);

        var payload = new
        {
            from = $"{_config.FromName} <{_config.FromEmail}>",
            to = new[] { to },
            subject = subject,
            html = htmlBody,
            text = textBody
        };

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        var timeoutMs = _config.TimeoutMs > 0 ? _config.TimeoutMs : 30000;
        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs));
        HttpResponseMessage response;
        try
        {
            response = await HttpClient.SendAsync(request, cts.Token);
        }
        catch (Exception ex)
        {
            await LogDeliveryAsync(to, subject, emailType, "failed", ex.Message);
            throw;
        }
        using (response)
        {
        var responseContent = await response.Content.ReadAsStringAsync();

        if (response.IsSuccessStatusCode)
        {
            _logger.LogInformation("Successfully sent email to {To} via Resend API. Response={Response}", to, responseContent);
            await LogDeliveryAsync(to, subject, emailType, "sent", null);
            return;
        }

        _logger.LogError("Resend API failed: Status={Status}, Response={Response}", response.StatusCode, responseContent);
        var error = $"Resend email delivery failed ({(int)response.StatusCode} {response.StatusCode}). {ExtractResendError(responseContent)}";
        await LogDeliveryAsync(to, subject, emailType, "failed", error);
        throw new InvalidOperationException(error);
        }
    }

    public async Task SendVerificationEmailAsync(string userEmail, string verificationLink)
    {
        var subject = "Verify your email - AI Context Brain";
        var html = GetTemplate($@"
            <h1>Verify your email address</h1>
            <p>Welcome to AI Context Brain! Please verify your email address to unlock full platform optimization capabilities, sync your AI-ready context files, and secure your account.</p>
            <div style='text-align: center; margin: 32px 0;'>
                <a href='{verificationLink}' class='btn'>Verify Email Address</a>
            </div>
            <div class='link-label'>If the button above does not work, copy and paste the following URL into your browser:</div>
            <div style='margin-top: 8px;'><a href='{verificationLink}' class='link-text'>{verificationLink}</a></div>
        ");

        var text = $"Welcome to AI Context Brain!\n\nPlease verify your email address by visiting this link: {verificationLink}\n\nThank you!\nAI Context Brain Team";

        await SendEmailAsync(userEmail, subject, html, text, "verification");
    }

    public async Task SendPasswordResetEmailAsync(string userEmail, string resetLink)
    {
        var subject = "Reset your password - AI Context Brain";
        var html = GetTemplate($@"
            <h1>Password Reset Request</h1>
            <p>We received a request to reset the password for your AI Context Brain account. Click the button below to set a new password. This link is valid for 1 hour.</p>
            <div style='text-align: center; margin: 32px 0;'>
                <a href='{resetLink}' class='btn'>Reset Password</a>
            </div>
            <div class='link-label'>If you did not request a password reset, you can safely ignore this email.</div>
            <div style='margin-top: 8px;'><a href='{resetLink}' class='link-text'>{resetLink}</a></div>
        ");

        var text = $"We received a request to reset your password.\n\nPlease reset your password by visiting this link: {resetLink}\n\nThis link is valid for 1 hour. If you didn't request this, ignore this email.\n\nAI Context Brain Team";

        await SendEmailAsync(userEmail, subject, html, text, "password_reset");
    }

    public async Task SendWelcomeEmailAsync(string userEmail)
    {
        var subject = "Welcome to AI Context Brain!";
        var html = GetTemplate($@"
            <h1>Welcome to the Intelligence Layer</h1>
            <p>Your AI Context Brain account is active and ready. Stop repeating your project layouts and rules to Cursor, Claude Code, GitHub Copilot, or Windsurf.</p>
            <p>To get started:</p>
            <ul style='color: #9ca3af; font-size: 14px; line-height: 1.6; padding-left: 20px; margin: 16px 0;'>
                <li style='margin-bottom: 8px;'>Install the VS Code extension from the marketplace.</li>
                <li style='margin-bottom: 8px;'>Run a local codebase scan.</li>
                <li style='margin-bottom: 8px;'>Connect your editor and see your AI assistant code with full architectural intelligence.</li>
            </ul>
            <div style='text-align: center; margin: 32px 0;'>
                <a href='https://aicontextbrain.me/dashboard' class='btn'>Go to Dashboard</a>
            </div>
        ");

        var text = $"Welcome to AI Context Brain!\n\nYour account is active. Connect VS Code, Cursor, Windsurf, or Claude Code to start coding with full context sync.\n\nDashboard: https://aicontextbrain.me/dashboard\n\nAI Context Brain Team";

        await SendEmailAsync(userEmail, subject, html, text, "welcome");
    }

    public async Task SendBillingEmailAsync(string userEmail, string subject, string body)
    {
        var html = GetTemplate($@"
            <h1>Billing Notification</h1>
            <p>{body}</p>
            <div style='text-align: center; margin: 32px 0;'>
                <a href='https://aicontextbrain.me/profile' class='btn'>View Subscription</a>
            </div>
        ");

        var text = $"Billing Notification:\n\n{body}\n\nView details: https://aicontextbrain.me/profile\n\nAI Context Brain Team";

        await SendEmailAsync(userEmail, subject, html, text, "billing");
    }

    public async Task SendSecurityAlertEmailAsync(string userEmail, string subject, string body)
    {
        var html = GetTemplate($@"
            <h1 style='color: #f87171;'>Security Alert</h1>
            <p>{body}</p>
            <p style='font-size: 13px; color: #f87171; font-weight: 600; margin-top: 16px;'>If this action was not performed by you, please reset your password immediately or contact security@aicontextbrain.me.</p>
            <div style='text-align: center; margin: 32px 0;'>
                <a href='https://aicontextbrain.me/profile' class='btn' style='background-color: #ef4444; background: #ef4444;'>Secure Account</a>
            </div>
        ");

        var text = $"Security Alert:\n\n{body}\n\nIf this was not you, change your password immediately: https://aicontextbrain.me/forgot-password\n\nAI Context Brain Team";

        await SendEmailAsync(userEmail, subject, html, text, "security_alert");
    }

    private async Task LogDeliveryAsync(string recipient, string subject, string emailType, string status, string? error)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var normalizedEmail = recipient.Trim().ToLowerInvariant();
            var userId = await context.Users.AsNoTracking()
                .Where(u => u.Email == normalizedEmail)
                .Select(u => u.Id)
                .FirstOrDefaultAsync();

            context.EmailLogs.Add(new EmailLog
            {
                UserId = userId,
                RecipientEmail = normalizedEmail,
                EmailType = emailType,
                Subject = subject,
                Status = status,
                ErrorMessage = error
            });
            await context.SaveChangesAsync();
        }
        catch (Exception logException)
        {
            _logger.LogWarning(logException, "Email delivery result could not be persisted for {Recipient}", recipient);
        }
    }

    private static string ExtractResendError(string responseContent)
    {
        if (string.IsNullOrWhiteSpace(responseContent))
        {
            return "Resend returned an empty error response.";
        }

        try
        {
            using var document = JsonDocument.Parse(responseContent);
            var root = document.RootElement;
            if (root.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.String)
            {
                return message.GetString() ?? "Unknown Resend error.";
            }
            if (root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.String)
            {
                return error.GetString() ?? "Unknown Resend error.";
            }
            if (root.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
            {
                return name.GetString() ?? "Unknown Resend error.";
            }
        }
        catch
        {
            // Fall through to the trimmed raw response.
        }

        return responseContent.Length > 400 ? responseContent[..400] : responseContent;
    }

    private string GetTemplate(string content)
    {
        return $@"
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset='utf-8'>
          <meta name='viewport' content='width=device-width, initial-scale=1.0'>
          <style>
            body {{ background-color: #0b0f19; color: #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased; }}
            .container {{ max-width: 580px; margin: 0 auto; background-color: #121826; border: 1px solid #222d45; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.6); }}
            .header-accent {{ height: 4px; background: linear-gradient(90deg, #4f7cff, #8b5cf6); }}
            .content-box {{ padding: 40px; }}
            .logo {{ font-size: 18px; font-weight: 800; color: #ffffff; margin-top: 0; margin-bottom: 32px; letter-spacing: -0.025em; display: block; text-decoration: none; }}
            .logo-icon {{ background: #ffffff; color: #0b0f19; border-radius: 8px; width: 28px; height: 28px; display: inline-block; text-align: center; line-height: 28px; margin-right: 10px; font-size: 12px; font-weight: 800; vertical-align: middle; }}
            h1 {{ color: #ffffff; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 18px; letter-spacing: -0.025em; }}
            p {{ font-size: 14px; line-height: 1.6; color: #9ca3af; margin-top: 0; margin-bottom: 22px; }}
            .btn {{ display: inline-block; background-color: #4f7cff; background: linear-gradient(135deg,#4f7cff,#8b5cf6); color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 18px rgba(79,124,255,0.3); text-align: center; }}
            .divider {{ height: 1px; background-color: #222d45; margin: 32px 0; }}
            .footer {{ font-size: 12px; color: #6b7280; text-align: center; line-height: 1.6; }}
            .link-text {{ color: #8b5cf6; font-size: 12px; word-break: break-all; text-decoration: none; }}
            .link-label {{ font-size: 12px; color: #6b7280; margin-bottom: 6px; }}
          </style>
        </head>
        <body>
          <div class='container'>
            <div class='header-accent'></div>
            <div class='content-box'>
              <div class='logo'>
                <span class='logo-icon'>AI</span> AI Context Brain
              </div>
              {content}
              <div class='divider'></div>
              <div class='footer'>
                This is an automated transactional security notification from AI Context Brain.<br>
                AI Context Brain &copy; 2026
              </div>
            </div>
          </div>
        </body>
        </html>";
    }
}
