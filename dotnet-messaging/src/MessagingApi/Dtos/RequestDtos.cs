using System.Text.Json.Serialization;

namespace MessagingApi.Dtos;

// Request bodies use the EXACT camelCase keys the DotnetMessagingProvider sends
// (dotnet-provider.ts). [JsonPropertyName] pins them so the global snake_case
// naming policy doesn't rename them. Response ROW shapes stay snake_case (the
// entities) to match the frontend's MessageRow contract.

public sealed class SendMessageDto
{
    [JsonPropertyName("ciphertext")]
    public string Ciphertext { get; set; } = string.Empty;

    [JsonPropertyName("iv")]
    public string Iv { get; set; } = string.Empty;

    [JsonPropertyName("keyVersion")]
    public int KeyVersion { get; set; }

    [JsonPropertyName("clientGeneratedId")]
    public Guid? ClientGeneratedId { get; set; }
}

public sealed class EditMessageDto
{
    [JsonPropertyName("ciphertext")]
    public string Ciphertext { get; set; } = string.Empty;

    [JsonPropertyName("iv")]
    public string Iv { get; set; } = string.Empty;

    [JsonPropertyName("keyVersion")]
    public int KeyVersion { get; set; }
}

public sealed class ProfilesDto
{
    [JsonPropertyName("userIds")]
    public List<Guid> UserIds { get; set; } = new();
}

public sealed class MessageIdsDto
{
    [JsonPropertyName("messageIds")]
    public List<Guid> MessageIds { get; set; } = new();
}

public sealed class ArchiveDto
{
    [JsonPropertyName("value")]
    public bool Value { get; set; }
}

/// <summary>The getOrCreateConversation request: the OTHER 1:1 participant.
/// The caller is never taken from the body — it comes from the bearer token.</summary>
public sealed class CreateConversationDto
{
    [JsonPropertyName("otherUserId")]
    public Guid OtherUserId { get; set; }
}

/// <summary>The getMessages page response: { rows, hasMore }.</summary>
public sealed class MessagesPageDto
{
    [JsonPropertyName("rows")]
    public required IEnumerable<object> Rows { get; set; }

    [JsonPropertyName("hasMore")]
    public required bool HasMore { get; set; }
}
