using Ishqnama.Api.Data;
using Ishqnama.Api.Dtos;
using Ishqnama.Api.Mappings;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Api.Endpoints;

public static class VerseEndpoints
{
    public static RouteGroupBuilder MapVerseEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/verses")
            .WithTags("Verses");

        group.MapGet("/", GetVerseRange)
            .CacheOutput("ByVerse");

        return group;
    }

    private static async Task<Results<Ok<List<VerseDto>>, BadRequest<string>>> GetVerseRange(
        QuranDbContext db, string from, string to, int? translationId = null)
    {
        if (!TryParseVerseRef(from, out var fromChapter, out var fromVerse) ||
            !TryParseVerseRef(to, out var toChapter, out var toVerse))
            return TypedResults.BadRequest("Invalid verse reference format. Use 'chapter:verse' (e.g., '2:1').");

        var verses = await db.Verses
            .Where(v =>
                (v.ChapterNumber > fromChapter || (v.ChapterNumber == fromChapter && v.VerseNumber >= fromVerse)) &&
                (v.ChapterNumber < toChapter || (v.ChapterNumber == toChapter && v.VerseNumber <= toVerse)))
            .OrderBy(v => v.ChapterNumber)
            .ThenBy(v => v.VerseNumber)
            .ToListAsync();

        if (translationId.HasValue)
        {
            var verseKeys = verses.Select(v => new { v.ChapterNumber, v.VerseNumber }).ToList();
            var segments = await db.TranslationSegments
                .Where(ts => ts.TranslationId == translationId.Value &&
                    verses.Select(v => v.ChapterNumber).Distinct().Contains(ts.ChapterNumber))
                .Where(ts =>
                    (ts.ChapterNumber > fromChapter || (ts.ChapterNumber == fromChapter && ts.VerseNumber >= fromVerse)) &&
                    (ts.ChapterNumber < toChapter || (ts.ChapterNumber == toChapter && ts.VerseNumber <= toVerse)))
                .OrderBy(ts => ts.SegmentIndex)
                .ToListAsync();

            var segmentLookup = segments
                .GroupBy(ts => (ts.ChapterNumber, ts.VerseNumber))
                .ToDictionary(g => g.Key, g => (IReadOnlyList<TranslationSegmentDto>)g.Select(ts => ts.ToDto()).ToList());

            return TypedResults.Ok(verses.Select(v =>
                v.ToDto(segmentLookup.GetValueOrDefault((v.ChapterNumber, v.VerseNumber)))).ToList());
        }

        return TypedResults.Ok(verses.Select(v => v.ToDto()).ToList());
    }

    private static bool TryParseVerseRef(string input, out int chapter, out int verse)
    {
        chapter = 0;
        verse = 0;
        var parts = input.Split(':');
        return parts.Length == 2 &&
               int.TryParse(parts[0], out chapter) &&
               int.TryParse(parts[1], out verse);
    }
}
