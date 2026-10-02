namespace Ishqnama.Domain.Entities;

/// <summary>
/// A reader's list of verse groups, stored in the <c>lists</c> container partitioned by
/// <see cref="Id"/>, so a published list's shared link is a point read for anyone.
/// </summary>
public sealed class VerseList
{
    public string Id { get; set; } = null!;
    public string Type { get; set; } = "list";
    public string OwnerId { get; set; } = null!;
    public string OwnerName { get; set; } = "";
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string Status { get; set; } = VerseListStatus.Draft;
    public List<VerseListGroup> Groups { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
}

public static class VerseListStatus
{
    public const string Draft = "draft";
    public const string Published = "published";
}
