using System.ComponentModel.DataAnnotations.Schema;

namespace MessagingApi.Models;

/// <summary>Maps the existing Supabase `conversations` table.</summary>
[Table("conversations")]
public class Conversation
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("participant_1_id")]
    public Guid? Participant1Id { get; set; }

    [Column("participant_2_id")]
    public Guid? Participant2Id { get; set; }

    [Column("last_message_at")]
    public DateTimeOffset? LastMessageAt { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }

    [Column("is_group")]
    public bool IsGroup { get; set; }

    [Column("group_name")]
    public string? GroupName { get; set; }

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("current_key_version")]
    public int CurrentKeyVersion { get; set; }

    [Column("archived_by_participant_1")]
    public bool ArchivedByParticipant1 { get; set; }

    [Column("archived_by_participant_2")]
    public bool ArchivedByParticipant2 { get; set; }
}
