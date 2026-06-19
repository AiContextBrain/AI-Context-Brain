// ============================================
// SaaS Auth Extension - V1 Backend Extension
// Minimal auth system for web dashboard
// ============================================
using AiContextBrain.Data;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILoginThrottleService _loginThrottle;
    private readonly IEmailService _emailService;
    private readonly EmailConfig _emailConfig;
    private const int Pbkdf2Iterations = 100_000;
    private const int MinimumPasswordLength = 8;

    public AuthController(
        ApplicationDbContext context,
        ILoginThrottleService loginThrottle,
        IEmailService emailService,
        EmailConfig emailConfig)
    {
        _context = context;
        _loginThrottle = loginThrottle;
        _emailService = emailService;
        _emailConfig = emailConfig;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] AuthRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new { error = "Email and password required" });
        }

        if (string.IsNullOrEmpty(request.Username))
        {
            return BadRequest(new { error = "Username is required" });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var username = request.Username.Trim().ToLowerInvariant();
        var emailDomain = email.Contains('@') ? email[(email.LastIndexOf('@') + 1)..] : string.Empty;
        var isDisposableEmail = !string.IsNullOrWhiteSpace(emailDomain) &&
            await _context.DisposableDomains.AnyAsync(d => d.Domain == emailDomain);

        if (isDisposableEmail)
        {
            return BadRequest(new
            {
                error = "disposable_email_not_allowed",
                message = "Please use a permanent email address."
            });
        }

        if (username.Length < 3 || username.Length > 30 || !username.All(char.IsLetterOrDigit))
        {
            return BadRequest(new { error = "Username must be between 3 and 30 alphanumeric characters" });
        }

        if (request.Password.Length < MinimumPasswordLength)
        {
            return BadRequest(new { error = $"Password must be at least {MinimumPasswordLength} characters" });
        }

        // Check if user exists
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existingUser != null)
        {
            return Conflict(new { error = "User already exists" });
        }

        var existingUsername = await _context.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (existingUsername != null)
        {
            return Conflict(new { error = "Username is already taken" });
        }

        // Create user
        var refreshToken = GenerateToken();
        var verifyToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var user = new User
        {
            Id = Guid.NewGuid().ToString(),
            Email = email,
            Username = username,
            PasswordHash = HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow,
            ApiToken = GenerateToken(),
            RefreshTokenHash = HashToken(refreshToken),
            RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30),
            IsEmailVerified = false,
            EmailVerificationToken = HashToken(verifyToken),
            EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddDays(1),
            IsTempEmail = false
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var emailSent = true;
        string? emailError = null;
        try
        {
            var verificationLink = $"{ResolveWebBaseUrl()}/verify-email?token={verifyToken}";
            await _emailService.SendVerificationEmailAsync(user.Email, verificationLink);
        }
        catch (Exception ex)
        {
            emailSent = false;
            emailError = BuildEmailDeliveryMessage(ex, "Verification email could not be sent.");
            Console.WriteLine($"[Email Error] Failed to send registration verification email: {ex.Message}");
        }

        return Ok(new
        {
            user = new
            {
                id = user.Id,
                email = user.Email,
                username = user.Username,
                token = user.ApiToken,
                refreshToken,
                plan = user.Plan.ToString(),
                role = user.Role.ToString(),
                isEmailVerified = user.IsEmailVerified
            },
            emailSent,
            emailError
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AuthRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new { error = "Email and password required" });
        }

        var emailOrUsername = request.Email.Trim().ToLowerInvariant();
        var throttleKey = BuildThrottleKey(emailOrUsername);
        if (_loginThrottle.IsBlocked(throttleKey, out var retryAfter))
        {
            return StatusCode(429, new
            {
                error = "too_many_login_attempts",
                retryAfterSeconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds))
            });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == emailOrUsername || u.Username == emailOrUsername);
        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            _loginThrottle.RecordFailure(throttleKey);
            return Unauthorized(new { error = "Invalid credentials" });
        }

        if (user.IsBanned)
        {
            return StatusCode(403, new { error = "account_banned", message = user.BanReason ?? "This account has been suspended." });
        }

        if (user.IsDeleted)
        {
            return StatusCode(403, new { error = "account_deleted", message = "This account is no longer active." });
        }

        _loginThrottle.Reset(throttleKey);

        if (!IsPbkdf2Hash(user.PasswordHash))
        {
            user.PasswordHash = HashPassword(request.Password);
        }

        var refreshToken = GenerateToken();
        user.LastLoginAt = DateTime.UtcNow;
        user.ApiToken = GenerateToken();
        user.RefreshTokenHash = HashToken(refreshToken);
        user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            user = new
            {
                id = user.Id,
                email = user.Email,
                username = user.Username,
                token = user.ApiToken,
                refreshToken,
                plan = user.Plan.ToString(),
                role = user.Role.ToString(),
                isEmailVerified = user.IsEmailVerified
            }
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return BadRequest(new { error = "Refresh token required" });
        }

        var refreshHash = HashToken(request.RefreshToken);
        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.RefreshTokenHash == refreshHash &&
            u.RefreshTokenExpiresAt != null &&
            u.RefreshTokenExpiresAt > DateTime.UtcNow &&
            !u.IsBanned &&
            !u.IsDeleted);

        if (user == null)
        {
            return Unauthorized(new { error = "Invalid refresh token" });
        }

        var refreshToken = GenerateToken();
        user.ApiToken = GenerateToken();
        user.RefreshTokenHash = HashToken(refreshToken);
        user.RefreshTokenExpiresAt = DateTime.UtcNow.AddDays(30);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            user = new
            {
                id = user.Id,
                email = user.Email,
                username = user.Username,
                token = user.ApiToken,
                refreshToken,
                plan = user.Plan.ToString(),
                role = user.Role.ToString(),
                isEmailVerified = user.IsEmailVerified
            }
        });
    }

    [HttpPost("authorize")]
    public async Task<IActionResult> Authorize([FromQuery] string? from)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        // Generate extension-specific token
        var editor = string.IsNullOrEmpty(from) ? "vscode" : SanitizeEditorName(from);
        var extensionToken = $"{editor}_{GenerateToken()}";
        
        // Store extension token
        var extAuth = new ExtensionAuth
        {
            Id = Guid.NewGuid().ToString(),
            UserId = user.Id,
            Token = extensionToken,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        };
        
        _context.ExtensionAuths.Add(extAuth);
        await _context.SaveChangesAsync();

        return Ok(new { extensionToken });
    }

    private string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Pbkdf2Iterations,
            HashAlgorithmName.SHA256,
            32);

        return $"pbkdf2${Pbkdf2Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private bool VerifyPassword(string password, string storedHash)
    {
        if (IsPbkdf2Hash(storedHash))
        {
            var parts = storedHash.Split('$');
            if (parts.Length != 4 || !int.TryParse(parts[1], out var iterations))
            {
                return false;
            }

            var salt = Convert.FromBase64String(parts[2]);
            var expectedHash = Convert.FromBase64String(parts[3]);
            var actualHash = Rfc2898DeriveBytes.Pbkdf2(
                password,
                salt,
                iterations,
                HashAlgorithmName.SHA256,
                expectedHash.Length);

            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }

        using var sha256 = SHA256.Create();
        var legacyHash = Convert.ToBase64String(sha256.ComputeHash(Encoding.UTF8.GetBytes(password)));
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(legacyHash),
            Encoding.UTF8.GetBytes(storedHash));
    }

    private bool IsPbkdf2Hash(string hash)
    {
        return hash.StartsWith("pbkdf2$", StringComparison.Ordinal);
    }

    private string GenerateToken()
    {
        return Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    }

    private string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Base64UrlEncode(bytes);
    }

    private string ResolveWebBaseUrl()
    {
        var origin = Request.Headers["Origin"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(origin)
            && (origin.Contains("localhost", StringComparison.OrdinalIgnoreCase)
                || origin.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase)
                || origin.Contains("aicontextbrain.me", StringComparison.OrdinalIgnoreCase)))
        {
            return origin.TrimEnd('/');
        }

        return _emailConfig.WebBaseUrl.TrimEnd('/');
    }

    private static string BuildEmailDeliveryMessage(Exception ex, string prefix)
    {
        var detail = ex.Message;
        if (detail.Contains("401", StringComparison.OrdinalIgnoreCase)
            || detail.Contains("Unauthorized", StringComparison.OrdinalIgnoreCase))
        {
            return $"{prefix} Resend rejected the API key. Set a valid RESEND_API_KEY in the deployment environment and redeploy.";
        }

        if (detail.Contains("403", StringComparison.OrdinalIgnoreCase)
            || detail.Contains("domain", StringComparison.OrdinalIgnoreCase)
            || detail.Contains("sender", StringComparison.OrdinalIgnoreCase)
            || detail.Contains("from", StringComparison.OrdinalIgnoreCase))
        {
            return $"{prefix} Resend rejected the sender address. Verify the sender/domain in Resend and set RESEND_FROM_EMAIL or SMTP_FROM_EMAIL to that verified address.";
        }

        return $"{prefix} Check Resend API key, verified sender configuration, and provider status.";
    }

    private string BuildThrottleKey(string email)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return $"{ip}:{email}";
    }

    private string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private string SanitizeEditorName(string editor)
    {
        var cleaned = new string(editor
            .Trim()
            .ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c) || c == '-')
            .ToArray());

        return string.IsNullOrEmpty(cleaned) ? "vscode" : cleaned;
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrEmpty(request.Email))
        {
            return BadRequest(new { error = "Email is required" });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && !u.IsBanned && !u.IsDeleted);

        if (user != null)
        {
            var resetToken = GenerateToken();
            user.PasswordResetToken = HashToken(resetToken);
            user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            var resetLink = $"{ResolveWebBaseUrl()}/reset-password?token={resetToken}";
            try
            {
                await _emailService.SendPasswordResetEmailAsync(user.Email, resetLink);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Email Error] Failed to send password reset email: {ex.Message}");
                // Keep the public response indistinguishable from an unknown email.
                // Delivery failures are persisted by EmailService for admin diagnostics.
            }
        }

        return Ok(new
        {
            message = "If the email exists, a password reset link has been sent."
        });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrEmpty(request.Token) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new { error = "Token and password are required" });
        }

        if (request.Password.Length < MinimumPasswordLength)
        {
            return BadRequest(new { error = $"Password must be at least {MinimumPasswordLength} characters" });
        }

        var resetHash = HashToken(request.Token);
        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.PasswordResetToken == resetHash &&
            u.PasswordResetTokenExpiresAt != null && 
            u.PasswordResetTokenExpiresAt > DateTime.UtcNow &&
            !u.IsBanned &&
            !u.IsDeleted);

        if (user == null)
        {
            return BadRequest(new { error = "Invalid or expired reset token" });
        }

        user.PasswordHash = HashPassword(request.Password);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        
        // Revoke current sessions/refresh tokens to force re-login on all devices after password reset
        user.ApiToken = GenerateToken();
        user.RefreshTokenHash = null;
        user.RefreshTokenExpiresAt = null;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Password has been reset successfully" });
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request)
    {
        if (string.IsNullOrEmpty(request.Email))
        {
            return BadRequest(new { error = "Email is required" });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && !u.IsBanned && !u.IsDeleted);
        if (user == null)
        {
            return Ok(new { message = "If the email is unverified, a verification link has been sent." });
        }

        if (user.IsEmailVerified)
        {
            return BadRequest(new { error = "Email is already verified" });
        }

        var verifyToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        user.EmailVerificationToken = HashToken(verifyToken);
        user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddDays(1);
        await _context.SaveChangesAsync();

        var verificationLink = $"{ResolveWebBaseUrl()}/verify-email?token={verifyToken}";

        try
        {
            await _emailService.SendVerificationEmailAsync(user.Email, verificationLink);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Email Error] Failed to send verification email: {ex.Message}");
            return StatusCode(503, new
            {
                error = "email_delivery_failed",
                message = BuildEmailDeliveryMessage(ex, "Verification email could not be sent.")
            });
        }

        return Ok(new { message = "If the email is unverified, a verification link has been sent." });
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        if (string.IsNullOrEmpty(request.Token))
        {
            return BadRequest(new { error = "Token is required" });
        }

        var verifyHash = HashToken(request.Token);
        var user = await _context.Users.FirstOrDefaultAsync(u =>
            (u.EmailVerificationToken == verifyHash || u.EmailVerificationToken == request.Token) &&
            u.EmailVerificationTokenExpiresAt != null && 
            u.EmailVerificationTokenExpiresAt > DateTime.UtcNow &&
            !u.IsBanned &&
            !u.IsDeleted);

        if (user == null)
        {
            return BadRequest(new { error = "Invalid or expired verification token" });
        }

        user.IsEmailVerified = true;
        user.EmailVerificationToken = null;
        user.EmailVerificationTokenExpiresAt = null;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Email verified successfully" });
    }
}

public class AuthRequest
{
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    public string Token { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ResendVerificationRequest
{
    public string Email { get; set; } = string.Empty;
}

public class VerifyEmailRequest
{
    public string Token { get; set; } = string.Empty;
}
