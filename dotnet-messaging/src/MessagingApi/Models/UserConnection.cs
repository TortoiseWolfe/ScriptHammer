using System.ComponentModel.DataAnnotations.Schema;

namespace MessagingApi.Models;

/// <summary>Maps the existing Supabase `user_connections` table (contact/friend requests).</summary>
[Table("user_connections")]
public class UserConnection
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("requester_id")]
    public Guid RequesterId { get; set; }

    [Column("addressee_id")]
    public Guid AddresseeId { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending";

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
}
