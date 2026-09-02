namespace Ishqnama.Domain.Entities;

public sealed class UserBookmark
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "bookmark";
    public int ChapterNumber { get; set; }
    public int VerseNumber { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
