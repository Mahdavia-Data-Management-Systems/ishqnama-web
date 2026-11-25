namespace Ishqnama.Application.Dtos;

/// <summary>
/// One book the tafseer cites, with how often. <c>Citations</c> is every place it is cited, in
/// reading order; it is null for an anonymous caller, who gets the books and their counts only.
/// </summary>
public sealed record BibliographyBookDto(
    int BookId,
    string Title,
    string? Author,
    int? AuthorDeathYearHijri,
    string? Kind,
    int CitationCount,
    IReadOnlyList<BookCitationDto>? Citations);

/// <summary>One citation of a book: the verse whose tafseer cites it, and what it points at.</summary>
public sealed record BookCitationDto(
    int ChapterNumber,
    int VerseNumber,
    int RukuId,
    string? Reference,
    string? Note,
    string? Url);
