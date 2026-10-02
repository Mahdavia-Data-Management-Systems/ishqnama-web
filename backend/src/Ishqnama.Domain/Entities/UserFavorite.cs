namespace Ishqnama.Domain.Entities;

/// <summary>
/// Something a reader has saved as a favourite, in their own partition of <c>user-data</c>.
/// <see cref="Kind"/> says what it points at; only <c>list</c> exists today, and later kinds
/// (chapter, ruku, verses) add their own target fields. The id is derived from the target, so
/// saving the same favourite twice is an upsert.
/// </summary>
public sealed class UserFavorite
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "favorite";
    public string Kind { get; set; } = null!;
    public string? ListId { get; set; }
    public string Title { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}
