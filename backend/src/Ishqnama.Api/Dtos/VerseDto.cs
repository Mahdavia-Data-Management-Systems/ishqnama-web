namespace Ishqnama.Api.Dtos;

public sealed record VerseDto(
    int ChapterNumber,
    int VerseNumber,
    string ArabicText,
    int JuzNumber,
    int RukuId,
    bool HasSajdah,
    IReadOnlyList<TranslationSegmentDto>? Translations = null);

public sealed record TranslationSegmentDto(
    int TranslationId,
    int SegmentIndex,
    string? TranslationText,
    string? Explanation);
