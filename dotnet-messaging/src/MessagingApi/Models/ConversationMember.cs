using System.ComponentModel.DataAnnotations.Schema;

namespace MessagingApi.Models;

/// <summary>Maps the existing Supabase `conversation_members` table (group membership junction).</summary>
[Table("conversation_members")]
public class ConversationMember
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("conversation_id")]
    public Guid ConversationId { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("role")]
    public string Role { get; set; } = "member";

    [Column("joined_at")]
    public DateTimeOffset JoinedAt { get; set; }

    [Column("left_at")]
    public DateTimeOffset? LeftAt { get; set; }

    [Column("key_version_joined")]
    public int KeyVersionJoined { get; set; }

    [Column("key_status")]
    public string KeyStatus { get; set; } = "active";

    [Column("archived")]
    public bool Archived { get; set; }

    [Column("muted")]
    public bool Muted { get; set; }
}
