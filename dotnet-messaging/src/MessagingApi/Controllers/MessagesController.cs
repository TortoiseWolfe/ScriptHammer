using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MessagingApi.Auth;
using MessagingApi.Data;
using MessagingApi.Dtos;

namespace MessagingApi.Controllers;

/// <summary>
/// Per-message endpoints. Re-expresses the messages RLS/trigger contract in C#:
/// C7 (read scoping), C9 (sender-only edit), C10 (15-min window), C11 (recipient
/// mark-read), C12 (soft-delete). Since #321 the backend connects as the
/// least-privilege dotnet_app role with the RLS actor set per request, so the
/// Supabase #281 column-guard trigger + RLS now FIRE as a live backstop — these
/// C# checks are the first layer, no longer the sole guard.
/// </summary>
[ApiController]
[Route("api/messaging")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;
    public MessagesController(AppDbContext db) => _db = db;

    private CallerContext? Caller => CallerContext.FromPrincipal(User);

    // The edit/delete window (matches the RLS "Users can edit own messages"
    // WITH CHECK created_at > now() - INTERVAL '15 minutes').
    private static readonly TimeSpan EditWindow = TimeSpan.FromMinutes(15);

    /// <summary>GET /api/messaging/messages/{id} → MessageRow | null (C7).</summary>
    [HttpGet("messages/{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        var msg = await _db.Messages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
        if (msg is null) return Ok((object?)null);

        // C7: only return it if the caller may see its conversation.
        if (!await MessagingQueries.CanAccessConversation(_db, msg.ConversationId, caller.UserId))
            return Ok((object?)null);

        return Ok(msg);
    }

    /// <summary>PATCH /api/messaging/messages/{id} { ciphertext, iv, keyVersion } → 204.
    /// C9 sender-only + C10 15-min window.</summary>
    [HttpPatch("messages/{id}")]
    public async Task<IActionResult> Edit(Guid id, [FromBody] EditMessageDto body)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == id);
        if (msg is null) return NotFound();

        // C9: only the sender may edit. (Recipient rewrite = the #281 exploit.)
        if (msg.SenderId != caller.UserId) return Forbid();
        // C12-adjacent: a deleted message is not editable.
        if (msg.Deleted) return Forbid();
        // C10: reject outside the 15-minute window (checked on the current row).
        if (DateTimeOffset.UtcNow - msg.CreatedAt > EditWindow) return Forbid();

        msg.EncryptedContent = body.Ciphertext;
        msg.InitializationVector = body.Iv;
        msg.KeyVersion = body.KeyVersion;
        msg.Edited = true;
        msg.EditedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>POST /api/messaging/messages/{id}/delete → 204. C12 soft-delete, sender-only.</summary>
    [HttpPost("messages/{id}/delete")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        var msg = await _db.Messages.FirstOrDefaultAsync(m => m.Id == id);
        if (msg is null) return NotFound();

        if (msg.SenderId != caller.UserId) return Forbid();
        if (DateTimeOffset.UtcNow - msg.CreatedAt > EditWindow) return Forbid();

        // C12: soft-delete only — never physically remove; ciphertext preserved.
        msg.Deleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>POST /api/messaging/messages/read { messageIds } → 204.
    /// C11: only a non-sender participant may set read_at (and only read_at).</summary>
    [HttpPost("messages/read")]
    public Task<IActionResult> MarkRead([FromBody] MessageIdsDto body) =>
        MarkReceipt(body, delivered: false);

    /// <summary>POST /api/messaging/messages/delivered { messageIds } → 204.</summary>
    [HttpPost("messages/delivered")]
    public Task<IActionResult> MarkDelivered([FromBody] MessageIdsDto body) =>
        MarkReceipt(body, delivered: true);

    private async Task<IActionResult> MarkReceipt(MessageIdsDto body, bool delivered)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();
        if (body.MessageIds.Count == 0) return NoContent();

        var now = DateTimeOffset.UtcNow;
        var msgs = await _db.Messages
            .Where(m => body.MessageIds.Contains(m.Id))
            .ToListAsync();

        foreach (var msg in msgs)
        {
            // C11: the caller must be a participant/member of the conversation.
            // A non-participant outsider must NOT set the receipt (row unchanged).
            if (!await MessagingQueries.CanAccessConversation(_db, msg.ConversationId, caller.UserId))
                continue;

            // Only ever touch read_at / delivered_at (never ciphertext — #281).
            // Idempotent: skip if already set. NOTE: a sender self-marking their
            // own message is allowed (pinned benign behavior, C11 self-mark test).
            if (delivered)
            {
                if (msg.DeliveredAt is null) msg.DeliveredAt = now;
            }
            else
            {
                if (msg.ReadAt is null) msg.ReadAt = now;
            }
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
