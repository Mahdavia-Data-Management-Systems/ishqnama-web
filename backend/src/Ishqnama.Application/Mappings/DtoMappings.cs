using Ishqnama.Application.Dtos;
using Ishqnama.Domain.Entities;

namespace Ishqnama.Application.Mappings;

public static class DtoMappings
{
    public static ChapterDto ToDto(this Chapter c, string? translatedName = null) =>
        new(c.ChapterNumber, c.ArabicName, c.TransliteratedName,
            c.RevelationType, c.VerseCount, translatedName);

    public static ChapterDetailDto ToDetailDto(this Chapter c) =>
        new(c.ChapterNumber, c.ArabicName, c.TransliteratedName,
            c.RevelationType, c.VerseCount, c.RevelationOrder,
            c.ChapterTranslations.Select(ct => new ChapterTranslationDto(ct.LanguageCode, ct.TranslatedName)).ToList());

    public static VerseDto ToDto(this Verse v, IReadOnlyList<TranslationSegmentDto>? translations = null) =>
        new(v.ChapterNumber, v.VerseNumber, v.ArabicText,
            v.JuzNumber, v.RukuId, v.HasSajdah, translations);

    public static TranslationSegmentDto ToDto(this TranslationSegment ts) =>
        new(ts.TranslationId, ts.SegmentIndex, ts.TranslationText, ts.Explanation,
            ts.Citations.ToTakhreej());

    /// <summary>
    /// A segment's citations as takhreej blocks: one block per anchor ordinal, in ordinal order,
    /// its citations in sort order. Null when there are none.
    /// </summary>
    public static IReadOnlyList<TakhreejBlockDto>? ToTakhreej(this IEnumerable<TranslationSegmentCitation> citations)
    {
        var blocks = citations
            .GroupBy(c => c.BlockOrdinal)
            .OrderBy(g => g.Key)
            .Select(g => new TakhreejBlockDto(
                g.Key,
                g.OrderBy(c => c.SortOrder).Select(c => c.ToDto()).ToList()))
            .ToList();

        return blocks.Count == 0 ? null : blocks;
    }

    public static CitationDto ToDto(this TranslationSegmentCitation c) =>
        new(c.Book.Title, c.Book.Author, c.Book.AuthorDeathYearHijri,
            c.Reference, c.Note, c.Url);

    public static JuzDto ToDto(this Juz j, int? startChapter = null, int? startVerse = null,
        int? endChapter = null, int? endVerse = null) =>
        new(j.JuzNumber, j.ArabicName, j.TransliteratedName,
            startChapter, startVerse, endChapter, endVerse);

    public static RukuDto ToDto(this Ruku r) =>
        new(r.RukuId, r.ChapterNumber, r.JuzNumber,
            r.RankInChapter, r.RankInJuz, r.VerseCount);

    public static TranslationDto ToDto(this Translation t) =>
        new(t.TranslationId, t.LanguageCode, t.ScriptCode,
            t.BookName, t.Translator, t.Description,
            t.BookNameInScript, t.TranslatorInScript, t.DescriptionInScript);
}
