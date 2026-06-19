using AiContextBrain.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("public-config")]
public class PublicConfigController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PublicConfigController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("analytics")]
    public async Task<IActionResult> GetAnalytics()
    {
        var settings = await _context.AnalyticsSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == "global");

        return Ok(new
        {
            enabled = settings?.Enabled ?? false,
            gaId = settings?.GoogleAnalyticsId ?? string.Empty,
            clarityId = settings?.ClarityId ?? string.Empty
        });
    }
}
