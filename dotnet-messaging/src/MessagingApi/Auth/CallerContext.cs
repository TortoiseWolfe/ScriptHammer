using System.Security.Claims;

namespace MessagingApi.Auth;

/// <summary>
/// The authenticated caller, resolved from the validated Supabase JWT. This is
/// the explicit replacement for Postgres `auth.uid()` — every authorization
/// check in the messaging controllers keys off <see cref="UserId"/>.
/// </summary>
public sealed class CallerContext
{
    public Guid UserId { get; }
    public string Role { get; }

    private CallerContext(Guid userId, string role)
    {
        UserId = userId;
        Role = role;
    }

    /// <summary>
    /// Build from the request principal. Returns null if there is no valid `sub`
    /// claim (the JwtBearer middleware has already rejected unsigned/expired
    /// tokens with 401 before we get here).
    /// </summary>
    public static CallerContext? FromPrincipal(ClaimsPrincipal? principal)
    {
        if (principal is null) return null;
        // Supabase user tokens carry the user id in `sub`. JwtBearer maps `sub`
        // to ClaimTypes.NameIdentifier by default, but we read both to be safe.
        var sub =
            principal.FindFirstValue("sub")
            ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(sub) || !Guid.TryParse(sub, out var userId))
            return null;

        var role = principal.FindFirstValue("role") ?? "authenticated";
        return new CallerContext(userId, role);
    }
}
