using Microsoft.EntityFrameworkCore;
using MessagingApi.Models;

namespace MessagingApi.Data;

/// <summary>
/// The authorization primitives that re-express the Supabase RLS contract
/// explicitly in app code, since a .NET backend has no in-database auth.uid().
/// Every messaging endpoint scopes through these. The contract is the 13 named
/// clauses catalogued in docs/messaging/AUTHORIZATION-CONTRACT.md (C1, C2, C3,
/// C5, C7–C14, C29) — the old "C1–C29" banner was aspirational; C4, C6 and
/// C15–C28 were never authored.
/// </summary>
public static class MessagingQueries
{
    /// <summary>
    /// (C1/C2/C7) True iff <paramref name="userId"/> may see the conversation —
    /// a 1:1 participant, the group creator, or an ACTIVE group member
    /// (left_at IS NULL). Mirrors is_conversation_member + the 1:1 participant
    /// predicate.
    /// </summary>
    public static async Task<bool> CanAccessConversation(
        AppDbContext db, Guid conversationId, Guid userId)
    {
        var conv = await db.Conversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conv is null) return false;

        if (!conv.IsGroup)
            return conv.Participant1Id == userId || conv.Participant2Id == userId;

        if (conv.CreatedBy == userId) return true;
        return await IsActiveMember(db, conversationId, userId);
    }

    /// <summary>Active (left_at IS NULL) membership in a group conversation.</summary>
    public static Task<bool> IsActiveMember(
        AppDbContext db, Guid conversationId, Guid userId) =>
        db.ConversationMembers
            .AsNoTracking()
            .AnyAsync(m =>
                m.ConversationId == conversationId
                && m.UserId == userId
                && m.LeftAt == null);

    /// <summary>
    /// (C3) True iff an ACCEPTED user_connections row exists between the two
    /// users. Checks BOTH orderings deliberately: unique_connection is
    /// (requester_id, addressee_id) and is NOT symmetric, so the single accepted
    /// row may point either way — exactly what the RLS INSERT policy
    /// "Users can create conversations with connections" does with its
    /// OR-ed requester/addressee pair.
    /// </summary>
    public static Task<bool> HasAcceptedConnection(
        AppDbContext db, Guid userA, Guid userB) =>
        db.UserConnections
            .AsNoTracking()
            .AnyAsync(c =>
                c.Status == "accepted"
                && ((c.RequesterId == userA && c.AddresseeId == userB)
                    || (c.RequesterId == userB && c.AddresseeId == userA)));
}
