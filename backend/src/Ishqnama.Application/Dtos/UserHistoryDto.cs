namespace Ishqnama.Application.Dtos;

public sealed record UserHistoryDto(
    int ChapterNumber,
    DateTimeOffset Timestamp);
