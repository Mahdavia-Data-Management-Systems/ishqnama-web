namespace Ishqnama.Api.Dtos;

public sealed record RukuDto(
    int RukuId,
    int ChapterNumber,
    int JuzNumber,
    int RankInChapter,
    int RankInJuz,
    int VerseCount);
