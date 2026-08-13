using Ishqnama.Api.Data;
using Ishqnama.Api.Dtos;
using Ishqnama.Api.Mappings;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Api.Endpoints;

public static class ChapterEndpoints
{
    public static RouteGroupBuilder MapChapterEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/chapters")
            .WithTags("Chapters");

        group.MapGet("/", GetChapters)
            .CacheOutput("Immutable");

        group.MapGet("/{num:int}", GetChapter)
            .CacheOutput("SingleItem");

        group.MapGet("/{num:int}/verses", GetChapterVerses)
            .CacheOutput("ByVerse");

        group.MapGet("/{num:int}/verses/{verseNum:int}", GetVerse)
            .CacheOutput("SingleVerse");

        return group;
    }

    private static async Task<Ok<List<ChapterDto>>> GetChapters(
        QuranDbContext db, string? lang = null)
    {
        if (lang is not null)
        {
            var chaptersWithTranslation = await db.Chapters
                .GroupJoin(
                    db.ChapterTranslations.Where(ct => ct.LanguageCode == lang),
                    c => c.ChapterNumber,
                    ct => ct.ChapterNumber,
                    (c, translations) => new { Chapter = c, Translation = translations.FirstOrDefault() })
                .OrderBy(x => x.Chapter.ChapterNumber)
                .Select(x => x.Chapter.ToDto(x.Translation != null ? x.Translation.TranslatedName : null))
                .ToListAsync();
            return TypedResults.Ok(chaptersWithTranslation);
        }

        var chapters = await db.Chapters
            .OrderBy(c => c.ChapterNumber)
            .Select(c => c.ToDto())
            .ToListAsync();
        return TypedResults.Ok(chapters);
    }

    private static async Task<Results<Ok<ChapterDetailDto>, NotFound>> GetChapter(
        QuranDbContext db, int num)
    {
        var chapter = await db.Chapters
            .Include(c => c.ChapterTranslations)
            .FirstOrDefaultAsync(c => c.ChapterNumber == num);

        if (chapter is null)
            return TypedResults.NotFound();

        return TypedResults.Ok(chapter.ToDetailDto());
    }

    private static async Task<Results<Ok<PagedResponse<VerseDto>>, NotFound>> GetChapterVerses(
        QuranDbContext db, int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        if (!await db.Chapters.AnyAsync(c => c.ChapterNumber == num))
            return TypedResults.NotFound();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.Verses
            .Where(v => v.ChapterNumber == num)
            .OrderBy(v => v.VerseNumber);

        var totalCount = await query.CountAsync();

        var verses = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var verseDtos = await EndpointHelpers.MapVersesWithTranslations(db, verses, translationId);

        return TypedResults.Ok(new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount));
    }

    private static async Task<Results<Ok<VerseDto>, NotFound>> GetVerse(
        QuranDbContext db, int num, int verseNum)
    {
        var verse = await db.Verses
            .FirstOrDefaultAsync(v => v.ChapterNumber == num && v.VerseNumber == verseNum);

        if (verse is null)
            return TypedResults.NotFound();

        var segments = await db.TranslationSegments
            .Where(ts => ts.ChapterNumber == num && ts.VerseNumber == verseNum)
            .OrderBy(ts => ts.TranslationId)
            .ThenBy(ts => ts.SegmentIndex)
            .Select(ts => ts.ToDto())
            .ToListAsync();

        return TypedResults.Ok(verse.ToDto(segments));
    }
}
