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
/// Conversation-scoped endpoints: create, metadata read, send, history, archive.
/// Re-expresses C3 (creating a 1:1 requires an accepted connection), C1/C2/C7
/// (read scoping), C8 (send = participant + server-set sender), C13 (gap-free
/// sequence — delegated to the DB trigger), C14 (NULL-tolerant idempotency),
/// C5 (per-user archive).
/// </summary>
[ApiController]
[Route("api/messaging")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ConversationsController(AppDbContext db) => _db = db;

    private CallerContext? Caller => CallerContext.FromPrincipal(User);

    /// <summary>POST /api/messaging/conversations { otherUserId } → { id }.
    /// C3 (creating a 1:1 requires an ACCEPTED connection) + C1 (the
    /// existing-conversation lookup is participant-scoped).</summary>
    [HttpPost("conversations")]
    public async Task<IActionResult> Create([FromBody] CreateConversationDto body)
    {
        var caller = Caller;
        if (caller is null) return Unauthorized();

        if (body.OtherUserId == Guid.Empty)
            return BadRequest(new { error = "otherUserId is required" });

        // no_self_conversation CHECK: a 1:1 conversation needs two distinct users.
        if (body.OtherUserId == caller.UserId)
            return BadRequest(new { error = "cannot start a conversation with yourself" });

        var (p1, p2) = CanonicalPair(caller.UserId, body.OtherUserId);

        // C1: the lookup is participant-scoped (the caller IS p1 or p2 by
        // construction, and RLS scopes the read besides) and deliberately
        // connection-INdependent — an existing thread stays reachable after a
        // disconnect, mirroring the RLS SELECT policy. Only creating is gated.
        var existing = await FindConversationId(p1, p2);
        if (existing is not null) return Ok(new { id = existing });

        // C3: creating requires an ACCEPTED connection in EITHER direction.
        if (!await MessagingQueries.HasAcceptedConnection(_db, p1, p2))
            return Forbid();

        // ON CONFLICT DO NOTHING rather than letting unique_conversation raise
        // 23505: RlsActorMiddleware wraps the WHOLE request in one transaction, so
        // a raised Postgres error aborts it and the recovery SELECT below would
        // then fail with "current transaction is aborted". Same idiom as Send's
        // C14 path. RLS's INSERT policy is still the live backstop underneath.
        await _db.Database.ExecuteSqlRawAsync(@"
            INSERT INTO conversations (id, participant_1_id, participant_2_id)
            VALUES (@id, @p1, @p2)
            ON CONFLICT (participant_1_id, participant_2_id) DO NOTHING;",
            new NpgsqlParameter("id", Guid.NewGuid()),
            new NpgsqlParameter("p1", p1),
            new NpgsqlParameter("p2", p2));

        // Resolve whichever row won — ours, or a concurrent caller's. This is the
        // idempotency contract: a race returns the winner, it does not throw.
        var saved = await FindConversationId(p1, p2);
        if (saved is null)
            return StatusCode(500, new { error = "insert did not persist" });

        return Ok(new { id = saved });
    }

    /// <summary>
    /// Order a pair to satisfy the canonical_ordering CHECK
    /// (participant_1_id &lt; participant_2_id), which is what collapses (A,B) and
    /// (B,A) onto a single unique_conversation row.
    ///
    /// Compares the CANONICAL STRING form, not Guid.CompareTo. Guid.CompareTo
    /// orders by the struct's fields — the first 4 bytes as a SIGNED Int32, then
    /// two Int16s — which does NOT match Postgres, where uuid compares as a plain
    /// 16-byte sequence. Ordinal comparison of the lowercase hex rendering is
    /// byte-order-equivalent, so it agrees with both Postgres and the JS-side
    /// `a &lt; b` used by the Supabase provider and the conformance fixtures.
    /// Using Guid.CompareTo here would emit unsorted pairs and trip the CHECK.
    /// </summary>
    private static (Guid, Guid) CanonicalPair(Guid a, Guid b) =>
        string.CompareOrdinal(a.ToString(), b.ToString()) < 0 ? (a, b) : (b, a);

    /// <summary>The 1:1 conversation id for an already canonically-ordered pair.</summary>
    private async Task<Guid?> FindConversationId(Guid p1, Guid p2)
    {
        var conv = await _db.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                c.Participant1Id == p1 && c.Participant2Id == p2 && !c.IsGroup);
        return conv?.Id;
    }

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

        // C30 (#352): a block stops future contact, even though the conversation
        // already exists. Participation used to be the WHOLE rule for sending, so
        // a user blocked after the thread was created kept messaging the person
        // who blocked them.
        //
        // Asked against the conversation's two participants rather than the
        // caller, so it refuses whichever of them is sending. That symmetry is
        // load-bearing: if only the blocked side were refused, comparing the two
        // directions would reveal the block, which is what the generic 403 below
        // exists to prevent.
        //
        // 1:1 ONLY (decision 5). Filtering a blocked member's messages inside a
        // group would leave holes in every other member's view of the thread and
        // leak the block to bystanders; group moderation is its own authority.
        var conv = await _db.Conversations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id);
        if (conv is { IsGroup: false, Participant1Id: Guid p1, Participant2Id: Guid p2 }
            && await MessagingQueries.IsBlockedBetween(_db, p1, p2))
        {
            // Forbid() and nothing else — no body, no reason. The response must
            // not distinguish "you are blocked" from any other refusal.
            return Forbid();
        }

        var newId = Guid.NewGuid();

        // Insert with sequence_number = 0 (the assign_sequence_number BEFORE
        // INSERT trigger overrides it under a per-conversation advisory lock →
        // C13). That trigger is NOT Supabase's to lend: on a database Supabase
        // did not provision it is absent, every insert lands 0, and the second
        // message in a conversation violates unique_sequence. Provision it from
        // dotnet-messaging/db/c13-sequence-assignment.sql — the failure and the
        // fix are both demonstrated in tests/rls/dotnet-sequence-assignment.test.ts.
        // ON CONFLICT (client_generated_id) DO NOTHING → C14 idempotency:
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
