namespace Ishqnama.Application.Dtos;

public sealed record UserFavoriteDto(
    int ChapterNumber,
    int VerseNumber,
    DateTimeOffset CreatedAt);
