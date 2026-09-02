namespace Ishqnama.Domain.Entities;

public sealed class UserFavorite
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "favorite";
    public int ChapterNumber { get; set; }
    public int VerseNumber { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
