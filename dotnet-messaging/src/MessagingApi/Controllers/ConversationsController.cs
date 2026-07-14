using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using MessagingApi.Auth;
using MessagingApi.Data;
using MessagingApi.Dtos;
using MessagingApi.Models;

namespace MessagingApi.Controllers;

/// <summary>
/// Conversation-scoped endpoints: metadata read, send, history, archive.
/// Re-expresses C1/C2/C7 (read scoping), C8 (send = participant + server-set
/// sender), C13 (gap-free sequence — delegated to the DB trigger), C14
/// (NULL-tolerant idempotency), C5 (per-user archive).
/// </summary>
[ApiController]
[Route("api/messaging")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ConversationsController(AppDbContext db) => _db = db;

    private CallerContext? Caller => CallerContext.FromPrincipal(User);

    /// <summary>GET /api/messaging/conversations/{id} → ConversationMeta | null (C1/C2/C7).</summary>
    [HttpGet("conversations/{id}")]
    public async Task<IActionResult> GetMeta(Guid id)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        // C7: non-participants get null (200), never a 403 (a throw fails the test).
        if (!await MessagingQueries.CanAccessConversation(_db, id, caller.UserId))
            return Ok((object?)null);

        var conv = await _db.Conversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        if (conv is null) return Ok((object?)null);

        return Ok(new
        {
            participant_1_id = conv.Participant1Id,
            participant_2_id = conv.Participant2Id,
            is_group = conv.IsGroup,
            current_key_version = conv.CurrentKeyVersion,
            created_by = conv.CreatedBy,
        });
    }

    /// <summary>GET /api/messaging/conversations/{id}/messages?cursor=&amp;limit= → { rows, hasMore } (C7).</summary>
    [HttpGet("conversations/{id}/messages")]
    public async Task<IActionResult> GetMessages(Guid id, [FromQuery] long? cursor, [FromQuery] int limit)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        // C7/C29: a non-participant gets an empty page, never leaked rows.
        if (!await MessagingQueries.CanAccessConversation(_db, id, caller.UserId))
            return Ok(new { rows = Array.Empty<Message>(), hasMore = false });

        var q = _db.Messages.AsNoTracking().Where(m => m.ConversationId == id);
        if (cursor is not null) q = q.Where(m => m.SequenceNumber < cursor.Value);

        // Fetch one extra to compute hasMore; newest-first.
        var rows = await q
            .OrderByDescending(m => m.SequenceNumber)
            .Take(limit + 1)
            .ToListAsync();

        var hasMore = rows.Count > limit;
        var page = hasMore ? rows.Take(limit).ToList() : rows;
        return Ok(new { rows = page, hasMore });
    }

    /// <summary>POST /api/messaging/conversations/{id}/messages { ciphertext, iv, keyVersion, clientGeneratedId } → MessageRow.
    /// C8 (participant + server-set sender), C13 (DB trigger sequence), C14 (idempotency).</summary>
    [HttpPost("conversations/{id}/messages")]
    public async Task<IActionResult> Send(Guid id, [FromBody] SendMessageDto body)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        // C8: the caller must be an active participant/member of the conversation.
        if (!await MessagingQueries.CanAccessConversation(_db, id, caller.UserId))
            return Forbid();

        var newId = Guid.NewGuid();

        // Insert with sequence_number = 0 (the assign_sequence_number BEFORE
        // INSERT trigger overrides it under a per-conversation advisory lock →
        // C13). ON CONFLICT (client_generated_id) DO NOTHING → C14 idempotency:
        // a replay with the same non-null id is a no-op; NULL sends coexist.
        // sender_id is set server-side to the caller — never trusted from body.
        const string sql = @"
            INSERT INTO messages
              (id, conversation_id, sender_id, encrypted_content, initialization_vector,
               sequence_number, key_version, deleted, edited, client_generated_id)
            VALUES
              (@id, @conv, @sender, @content, @iv, 0, @kv, false, false, @cgid)
            ON CONFLICT (client_generated_id) DO NOTHING;";

        await _db.Database.ExecuteSqlRawAsync(
            sql,
            new NpgsqlParameter("id", newId),
            new NpgsqlParameter("conv", id),
            new NpgsqlParameter("sender", caller.UserId),
            new NpgsqlParameter("content", body.Ciphertext),
            new NpgsqlParameter("iv", body.Iv),
            new NpgsqlParameter("kv", body.KeyVersion),
            new NpgsqlParameter("cgid", (object?)body.ClientGeneratedId ?? DBNull.Value));

        // Resolve the row to return: our new id if it inserted, otherwise the
        // pre-existing row for this idempotency key (the replay case).
        Message? saved = await _db.Messages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == newId);
        if (saved is null && body.ClientGeneratedId is not null)
        {
            saved = await _db.Messages.AsNoTracking()
                .FirstOrDefaultAsync(m => m.ClientGeneratedId == body.ClientGeneratedId);
        }
        if (saved is null)
            return StatusCode(500, new { error = "insert did not persist" });

        // Bump last_message_at (best-effort; mirrors the app's post-send update).
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE conversations SET last_message_at = now() WHERE id = @c",
            new NpgsqlParameter("c", id));

        return Ok(saved);
    }

    /// <summary>POST /api/messaging/conversations/{id}/archive { value } → 204 (C5, per-user).</summary>
    [HttpPost("conversations/{id}/archive")]
    public async Task<IActionResult> Archive(Guid id, [FromBody] ArchiveDto body)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        var conv = await _db.Conversations.FirstOrDefaultAsync(c => c.Id == id);
        if (conv is null) return NotFound();

        if (conv.IsGroup)
        {
            var member = await _db.ConversationMembers.FirstOrDefaultAsync(m =>
                m.ConversationId == id && m.UserId == caller.UserId && m.LeftAt == null);
            if (member is null) return Forbid();
            member.Archived = body.Value;
        }
        else if (conv.Participant1Id == caller.UserId)
        {
            conv.ArchivedByParticipant1 = body.Value;
        }
        else if (conv.Participant2Id == caller.UserId)
        {
            conv.ArchivedByParticipant2 = body.Value;
        }
        else
        {
            return Forbid();
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
