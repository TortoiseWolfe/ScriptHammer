using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MessagingApi.Auth;
using MessagingApi.Data;
using MessagingApi.Dtos;

namespace MessagingApi.Controllers;

/// <summary>Batch display-profile lookup. POST /api/messaging/profiles { userIds } → UserProfile[].</summary>
[ApiController]
[Route("api/messaging")]
[Authorize]
public class ProfilesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ProfilesController(AppDbContext db) => _db = db;

    [HttpPost("profiles")]
    public async Task<IActionResult> GetProfiles([FromBody] ProfilesDto body)
    {
        // Authenticated read; the caller must be a valid user.
        if (CallerContext.FromPrincipal(User) is null) return Unauthorized();
        if (body.UserIds.Count == 0) return Ok(Array.Empty<object>());

        var profiles = await _db.UserProfiles
            .AsNoTracking()
            .Where(p => body.UserIds.Contains(p.Id))
            .Select(p => new
            {
                id = p.Id,
                username = p.Username,
                display_name = p.DisplayName,
                avatar_url = p.AvatarUrl,
            })
            .ToListAsync();

        return Ok(profiles);
    }
}
