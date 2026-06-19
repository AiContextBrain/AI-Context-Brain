using AiContextBrain.Data;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SettingsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var settings = await GetOrCreateSettingsAsync(user.Id);
        return Ok(ToResponse(settings));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UserSettingsRequest request)
    {
        var user = await _context.ResolveUserFromBearerTokenAsync(
            Request.Headers["Authorization"].FirstOrDefault());
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid or missing token" });
        }

        var settings = await GetOrCreateSettingsAsync(user.Id);
        settings.Notifications = request.Notifications;
        settings.AutoScan = request.AutoScan;
        settings.DarkMode = request.DarkMode;
        settings.AiProvider = NormalizeChoice(request.AiProvider, new[] { "auto", "gemini" }, "auto");
        settings.MaxTokens = Math.Clamp(request.MaxTokens, 1000, PlanLimits.MaxContextSizeTokens(user.Plan));
        settings.ContextFormat = NormalizeChoice(request.ContextFormat, new[] { "json", "markdown" }, "markdown");
        settings.ApiUrl = string.IsNullOrWhiteSpace(request.ApiUrl)
            ? "https://api.aicontextbrain.me"
            : request.ApiUrl.Trim();
        settings.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(ToResponse(settings));
    }

    private async Task<UserSettings> GetOrCreateSettingsAsync(string userId)
    {
        var settings = await _context.UserSettings.FirstOrDefaultAsync(s => s.UserId == userId);
        if (settings != null)
        {
            return settings;
        }

        settings = new UserSettings { UserId = userId };
        _context.UserSettings.Add(settings);
        await _context.SaveChangesAsync();
        return settings;
    }

    private object ToResponse(UserSettings settings)
    {
        return new
        {
            settings.Notifications,
            settings.AutoScan,
            settings.DarkMode,
            AiProvider = NormalizeChoice(settings.AiProvider, new[] { "auto", "gemini" }, "auto"),
            settings.MaxTokens,
            settings.ContextFormat,
            settings.ApiUrl,
            settings.UpdatedAt
        };
    }

    private string NormalizeChoice(string? value, string[] allowed, string fallback)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return normalized != null && allowed.Contains(normalized) ? normalized : fallback;
    }
}

public class UserSettingsRequest
{
    public bool Notifications { get; set; } = true;
    public bool AutoScan { get; set; }
    public bool DarkMode { get; set; } = true;
    public string AiProvider { get; set; } = "auto";
    public int MaxTokens { get; set; } = 8000;
    public string ContextFormat { get; set; } = "markdown";
    public string ApiUrl { get; set; } = "https://api.aicontextbrain.me";
}
