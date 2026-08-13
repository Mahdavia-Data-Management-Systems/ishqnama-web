using Ishqnama.Api.Data;
using Ishqnama.Api.Dtos;
using Ishqnama.Api.Mappings;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Api.Endpoints;

public static class JuzEndpoints
{
    public static RouteGroupBuilder MapJuzEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/juz")
            .WithTags("Juz");

        group.MapGet("/", GetAllJuz)
            .CacheOutput("Immutable");

        group.MapGet("/{num:int}/verses", GetJuzVerses)
            .CacheOutput("ByVerse");

        return group;
    }

    private static async Task<Ok<List<JuzDto>>> GetAllJuz(QuranDbContext db)
    {
        var juzList = await db.Juz
            .OrderBy(j => j.JuzNumber)
            .ToListAsync();

        var juzDtos = new List<JuzDto>();
        foreach (var j in juzList)
        {
            var firstVerse = await db.Verses
                .Where(v => v.JuzNumber == j.JuzNumber)
                .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
                .Select(v => new { v.ChapterNumber, v.VerseNumber })
                .FirstOrDefaultAsync();

            var lastVerse = await db.Verses
                .Where(v => v.JuzNumber == j.JuzNumber)
                .OrderByDescending(v => v.ChapterNumber).ThenByDescending(v => v.VerseNumber)
                .Select(v => new { v.ChapterNumber, v.VerseNumber })
                .FirstOrDefaultAsync();

            juzDtos.Add(j.ToDto(
                firstVerse?.ChapterNumber, firstVerse?.VerseNumber,
                lastVerse?.ChapterNumber, lastVerse?.VerseNumber));
        }

        return TypedResults.Ok(juzDtos);
    }

    private static async Task<Results<Ok<PagedResponse<VerseDto>>, NotFound>> GetJuzVerses(
        QuranDbContext db, int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        if (!await db.Juz.AnyAsync(j => j.JuzNumber == num))
            return TypedResults.NotFound();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.Verses
            .Where(v => v.JuzNumber == num)
            .OrderBy(v => v.ChapterNumber)
            .ThenBy(v => v.VerseNumber);

        var totalCount = await query.CountAsync();

        var verses = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var verseDtos = await EndpointHelpers.MapVersesWithTranslations(db, verses, translationId);

        return TypedResults.Ok(new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount));
    }
}
