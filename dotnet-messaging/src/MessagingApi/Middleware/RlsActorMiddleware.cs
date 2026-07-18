using System.Text.Json;
using MessagingApi.Auth;
using MessagingApi.Data;
using Microsoft.EntityFrameworkCore;

namespace MessagingApi.Middleware;

/// <summary>
/// Establishes the Postgres RLS actor for each authenticated request (#321).
///
/// The backend logs in as the least-privilege <c>dotnet_app</c> role (NOT the
/// postgres superuser), which is subject to Row-Level Security and the #281
/// column-guard trigger. Per request this opens ONE transaction and runs
/// <c>SET LOCAL ROLE authenticated</c> + <c>set_config('request.jwt.claims', …, true)</c>
/// so <c>auth.uid()</c>/<c>auth.role()</c> resolve inside the participant-scoped
/// RLS policies and the trigger — making the DB a live backstop behind the
/// controllers' C# authorization checks (belt-and-suspenders).
///
/// <para><c>SET LOCAL</c> is transaction-scoped, so the actor is discarded on
/// COMMIT/ROLLBACK and never leaks onto the next request that draws the same
/// pooled connection (Npgsql pools connections; multiplexing is off).</para>
///
/// <para>The <see cref="AppDbContext"/> is request-scoped and shared, so every
/// controller's EF query / <c>ExecuteSqlRawAsync</c> / <c>SaveChangesAsync</c>
/// enlists in this transaction automatically — no controller changes are needed.
/// A side benefit is that each request is now atomic.</para>
/// </summary>
public sealed class RlsActorMiddleware
{
    private readonly RequestDelegate _next;

    public RlsActorMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        var caller = CallerContext.FromPrincipal(context.User);

        // Anonymous / unauthenticated requests (e.g. /health) do no
        // participant-scoped DB work — every authenticated endpoint early-returns
        // Unauthorized when the caller is null. Skip the transaction + actor.
        if (caller is null)
        {
            await _next(context);
            return;
        }

        // Always assume the `authenticated` role — this is a user-facing API and
        // dotnet_app is deliberately NOT granted service_role, so it cannot (and
        // must not) SET ROLE into a BYPASSRLS role. Admin flows are expressed as
        // auth.uid()-keyed RLS policies, not via service_role.
        var claims = JsonSerializer.Serialize(new
        {
            sub = caller.UserId.ToString(),
            role = "authenticated",
        });

        await using var tx = await db.Database.BeginTransactionAsync();

        // Order: become authenticated, then publish the JWT claims. `true` =
        // is_local (transaction-scoped). The claims JSON is passed as a bound
        // parameter — never string-concatenated — even though `sub` is a
        // server-validated GUID.
        await db.Database.ExecuteSqlRawAsync("SET LOCAL ROLE authenticated");
        await db.Database.ExecuteSqlRawAsync(
            "SELECT set_config('request.jwt.claims', {0}, true)",
            claims);

        try
        {
            await _next(context);
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
