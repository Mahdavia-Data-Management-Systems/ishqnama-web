namespace Ishqnama.Application.Dtos;

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
    string? Explanation,
    // The books cited for the explanation's marked passages, one block per
    // <ins data-takhreej="n"> anchor (n = Ordinal). Null when the segment cites nothing, and for
    // anonymous callers, who get no explanation either.
    IReadOnlyList<TakhreejBlockDto>? Takhreej = null);

public sealed record TakhreejBlockDto(
    int Ordinal,
    IReadOnlyList<CitationDto> Citations);

public sealed record CitationDto(
    string Title,
    string? Author,
    int? AuthorDeathYearHijri,
    string? Reference,
    string? Note,
    string? Url);
