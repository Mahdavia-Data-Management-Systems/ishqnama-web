namespace Ishqnama.Application.Dtos;

public sealed record VerseListGroupDto(
    string? Id,
    int Chapter,
    int FromVerse,
    int ToVerse,
    string? Caption);

/// <summary>
/// A whole list. <see cref="IsMine"/> tells the page whether to offer Edit or Favourite; the
/// owner's account id never leaves the API.
/// </summary>
public sealed record VerseListDto(
    string Id,
    string Title,
    string? Description,
    string OwnerName,
    string Status,
    bool IsMine,
    IReadOnlyList<VerseListGroupDto> Groups,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? PublishedAt);

public sealed record VerseListSummaryDto(
    string Id,
    string Title,
    string? Description,
    string OwnerName,
    string Status,
    int GroupCount,
    DateTimeOffset UpdatedAt);
