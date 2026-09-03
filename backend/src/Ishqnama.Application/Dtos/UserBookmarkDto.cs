namespace Ishqnama.Application.Dtos;

public sealed record UserBookmarkDto(
    string Slug,
    string Title,
    string Icon,
    int ChapterNumber,
    int VerseNumber,
    bool IsDefault,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
