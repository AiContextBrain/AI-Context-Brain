using System.Threading.Tasks;

namespace AiContextBrain.Services;

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string htmlBody, string textBody, string emailType = "generic");
    Task SendVerificationEmailAsync(string userEmail, string verificationLink);
    Task SendPasswordResetEmailAsync(string userEmail, string resetLink);
    Task SendWelcomeEmailAsync(string userEmail);
    Task SendBillingEmailAsync(string userEmail, string subject, string body);
    Task SendSecurityAlertEmailAsync(string userEmail, string subject, string body);
}
