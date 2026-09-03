namespace Ishqnama.Domain.Entities;

public sealed class UserBookmark
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "bookmark";
    public string Slug { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Icon { get; set; } = null!;
    public int ChapterNumber { get; set; }
    public int VerseNumber { get; set; }
    public bool IsDefault { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
