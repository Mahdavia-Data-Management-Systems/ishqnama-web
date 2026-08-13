using Ishqnama.Api.Data;
using Ishqnama.Api.Dtos;
using Ishqnama.Api.Mappings;
using Ishqnama.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Api.Endpoints;

internal static class EndpointHelpers
{
    internal static async Task<List<VerseDto>> MapVersesWithTranslations(
        QuranDbContext db, List<Verse> verses, int? translationId)
    {
        if (!translationId.HasValue || verses.Count == 0)
            return verses.Select(v => v.ToDto()).ToList();

        var verseKeySet = verses.Select(v => (v.ChapterNumber, v.VerseNumber)).ToHashSet();
        var chapterNumbers = verses.Select(v => v.ChapterNumber).Distinct().ToList();

        var segments = await db.TranslationSegments
            .Where(ts => ts.TranslationId == translationId.Value
                && chapterNumbers.Contains(ts.ChapterNumber))
            .OrderBy(ts => ts.SegmentIndex)
            .ToListAsync();

        // Filter in-memory to exact (chapter, verse) pairs
        var segmentLookup = segments
            .Where(ts => verseKeySet.Contains((ts.ChapterNumber, ts.VerseNumber)))
            .GroupBy(ts => (ts.ChapterNumber, ts.VerseNumber))
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<TranslationSegmentDto>)g.Select(ts => ts.ToDto()).ToList());

        return verses.Select(v =>
            v.ToDto(segmentLookup.GetValueOrDefault((v.ChapterNumber, v.VerseNumber)))).ToList();
    }
}
