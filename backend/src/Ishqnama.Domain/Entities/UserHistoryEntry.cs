namespace Ishqnama.Domain.Entities;

public sealed class UserHistoryEntry
{
    public string Id { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "history";
    public int ChapterNumber { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}
