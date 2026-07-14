using System.ComponentModel.DataAnnotations.Schema;

namespace MessagingApi.Models;

/// <summary>Maps the existing Supabase `user_profiles` table (identity anchor; id == JWT sub).</summary>
[Table("user_profiles")]
public class UserProfile
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("username")]
    public string? Username { get; set; }

    [Column("display_name")]
    public string? DisplayName { get; set; }

    [Column("avatar_url")]
    public string? AvatarUrl { get; set; }

    [Column("is_admin")]
    public bool IsAdmin { get; set; }
}
