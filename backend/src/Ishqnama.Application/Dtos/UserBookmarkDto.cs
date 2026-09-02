namespace Ishqnama.Application.Dtos;

public sealed record UserBookmarkDto(
    int ChapterNumber,
    int VerseNumber,
    DateTimeOffset CreatedAt);
