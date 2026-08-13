using Ishqnama.Api.Data;
using Ishqnama.Api.Dtos;
using Ishqnama.Api.Mappings;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Api.Endpoints;

public static class RukuEndpoints
{
    public static RouteGroupBuilder MapRukuEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/rukus")
            .WithTags("Rukus");

        group.MapGet("/", GetRukus)
            .CacheOutput("ByVerse");

        group.MapGet("/{id:int}/verses", GetRukuVerses)
            .CacheOutput("ByVerse");

        return group;
    }

    private static async Task<Ok<List<RukuDto>>> GetRukus(
        QuranDbContext db, int? chapterNum = null, int? juzNum = null)
    {
        var query = db.Rukus.AsQueryable();

        if (chapterNum.HasValue)
            query = query.Where(r => r.ChapterNumber == chapterNum.Value);
        if (juzNum.HasValue)
            query = query.Where(r => r.JuzNumber == juzNum.Value);

        var rukus = await query
            .OrderBy(r => r.RukuId)
            .Select(r => r.ToDto())
            .ToListAsync();

        return TypedResults.Ok(rukus);
    }

    private static async Task<Results<Ok<List<VerseDto>>, NotFound>> GetRukuVerses(
        QuranDbContext db, int id, int? translationId = null)
    {
        if (!await db.Rukus.AnyAsync(r => r.RukuId == id))
            return TypedResults.NotFound();

        var verses = await db.Verses
            .Where(v => v.RukuId == id)
            .OrderBy(v => v.ChapterNumber)
            .ThenBy(v => v.VerseNumber)
            .ToListAsync();

        var verseDtos = await EndpointHelpers.MapVersesWithTranslations(db, verses, translationId);
        return TypedResults.Ok(verseDtos);
    }
}
