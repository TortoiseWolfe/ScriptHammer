using Microsoft.EntityFrameworkCore;
using MessagingApi.Models;

namespace MessagingApi.Data;

/// <summary>
/// EF Core context over the EXISTING Supabase messaging schema. This backend is
/// an alternative REST API over the same tables — it does NOT own or create the
/// schema (no EnsureCreated/Migrate). The Supabase monolithic migration remains
/// the single source of truth for DDL, including the concurrency-critical
/// triggers (assign_sequence_number = C13, uniq client_generated_id = C14) and
/// the #281 column-guard (enforce_message_update_columns). Since #321 this backend
/// connects as the least-privilege `dotnet_app` role and sets the RLS actor per
/// request (RlsActorMiddleware), so RLS + the column-guard trigger now ENFORCE —
/// a live backstop behind the controllers' C# checks, not bypassed by a superuser
/// connection.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Message> Messages { get; set; } = null!;
    public DbSet<Conversation> Conversations { get; set; } = null!;
    public DbSet<ConversationMember> ConversationMembers { get; set; } = null!;
    public DbSet<UserConnection> UserConnections { get; set; } = null!;
    public DbSet<UserProfile> UserProfiles { get; set; } = null!;
}
