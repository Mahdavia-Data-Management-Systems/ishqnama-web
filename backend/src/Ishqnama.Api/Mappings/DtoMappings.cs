using Ishqnama.Api.Dtos;
using Ishqnama.Api.Models;

namespace Ishqnama.Api.Mappings;

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
        new(ts.TranslationId, ts.SegmentIndex, ts.TranslationText, ts.Explanation);

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
