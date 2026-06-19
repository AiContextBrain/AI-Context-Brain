using AiContextBrain.Data;
using AiContextBrain.Dtos;
using AiContextBrain.Models;
using AiContextBrain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace AiContextBrain.Controllers;

[ApiController]
[Route("[controller]")]
public class FeedbackController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FeedbackController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> SubmitFeedback([FromBody] FeedbackRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Content))
        {
            return BadRequest(new { error = "Feedback content cannot be empty." });
        }

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        User? user = null;

        if (!string.IsNullOrEmpty(authHeader))
        {
            try
            {
                user = await _context.ResolveUserFromBearerTokenAsync(authHeader);
            }
            catch
            {
                // Ignore resolve user failure for submission to allow fallback
            }
        }

        var feedback = new Feedback
        {
            UserId = user?.Id,
            Content = request.Content,
            Rating = Math.Clamp(request.Rating, 1, 5),
            Category = string.IsNullOrWhiteSpace(request.Category) ? "general" : request.Category,
            CreatedAt = DateTime.UtcNow
        };

        _context.Feedbacks.Add(feedback);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Feedback submitted successfully.", id = feedback.Id });
    }

    [HttpGet("admin")]
    public async Task<IActionResult> GetFeedbacksAdmin()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader))
        {
            return Unauthorized(new { error = "Authorization token is missing." });
        }

        var user = await _context.ResolveUserFromBearerTokenAsync(authHeader);
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid token." });
        }

        if (user.Role != UserRole.Admin)
        {
            return Forbid();
        }

        var feedbacks = await _context.Feedbacks
            .Include(f => f.User)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new
            {
                id = f.Id,
                content = f.Content,
                rating = f.Rating,
                category = f.Category,
                createdAt = f.CreatedAt,
                userEmail = f.User != null ? f.User.Email : "Anonymous"
            })
            .ToListAsync();

        return Ok(new { feedbacks });
    }
}
