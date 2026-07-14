using System.ComponentModel.DataAnnotations.Schema;

namespace MessagingApi.Models;

/// <summary>
/// Maps the existing Supabase `messages` table (the .NET backend is an
/// alternative API over the SAME schema, not its own). Column names are the
/// snake_case DB names; JSON serialization also emits snake_case so the
/// frontend's MessageRow contract matches byte-for-byte.
/// </summary>
[Table("messages")]
public class Message
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("conversation_id")]
    public Guid ConversationId { get; set; }

    [Column("sender_id")]
    public Guid SenderId { get; set; }

    [Column("encrypted_content")]
    public string EncryptedContent { get; set; } = string.Empty;

    [Column("initialization_vector")]
    public string InitializationVector { get; set; } = string.Empty;

    [Column("sequence_number")]
    public long SequenceNumber { get; set; }

    [Column("deleted")]
    public bool Deleted { get; set; }

    [Column("edited")]
    public bool Edited { get; set; }

    [Column("edited_at")]
    public DateTimeOffset? EditedAt { get; set; }

    [Column("delivered_at")]
    public DateTimeOffset? DeliveredAt { get; set; }

    [Column("read_at")]
    public DateTimeOffset? ReadAt { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }

    [Column("key_version")]
    public int KeyVersion { get; set; }

    [Column("is_system_message")]
    public bool IsSystemMessage { get; set; }

    [Column("system_message_type")]
    public string? SystemMessageType { get; set; }

    [Column("client_generated_id")]
    public Guid? ClientGeneratedId { get; set; }
}
