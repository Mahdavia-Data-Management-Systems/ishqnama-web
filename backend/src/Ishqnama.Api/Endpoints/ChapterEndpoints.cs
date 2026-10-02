using System.Security.Claims;
using Ishqnama.Api.Contracts;
using Ishqnama.Api.Helpers;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class ChapterEndpoints
{
    public static RouteGroupBuilder MapChapterEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/chapters").AllowAnonymous().WithTags("Chapters");

        group.MapGet("/", GetChapters);
        group.MapGet("/{num:int}", GetChapter);
        group.MapGet("/{num:int}/verses", GetChapterVerses);
        group.MapGet("/{num:int}/verses/{verseNum:int}", GetVerse);
        group.MapGet("/{num:int}/arabic", GetArabicVerses);

        return api;
    }

    private static async Task<Ok<List<ChapterDto>>> GetChapters(
        ChapterService chapterService, string? lang = null)
    {
        var chapters = await chapterService.GetChaptersAsync(lang);
        return TypedResults.Ok(chapters);
    }

    private static async Task<Results<Ok<ChapterDetailDto>, NotFound>> GetChapter(
        ChapterService chapterService, int num)
    {
        var chapter = await chapterService.GetChapterAsync(num);
        return chapter is null ? TypedResults.NotFound() : TypedResults.Ok(chapter);
    }

    private static async Task<Results<Ok<PagedResponse<VerseDto>>, NotFound>> GetChapterVerses(
        ChapterService chapterService, ClaimsPrincipal user,
        int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        var result = await chapterService.GetChapterVersesAsync(num, translationId, page, pageSize);
        return result is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(user.IsAuthenticated() ? result : result.StripExplanations());
    }

    private static async Task<Results<Ok<VerseDto>, NotFound>> GetVerse(
        ChapterService chapterService, ClaimsPrincipal user, int num, int verseNum)
    {
        var verse = await chapterService.GetVerseAsync(num, verseNum);
        return verse is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(user.IsAuthenticated() ? verse : verse.StripExplanations());
    }

    // The text alone, for verse lists: no translations or tafseer, so no token is ever needed
    // and every caller shares the same cached response.
    private static async Task<Results<Ok<List<ArabicVerseDto>>, NotFound, BadRequest<ErrorResponse>>> GetArabicVerses(
        ChapterService chapterService, int num, int? from = null, int? to = null)
    {
        try
        {
            var verses = await chapterService.GetArabicVersesAsync(num, from, to);
            return verses is null ? TypedResults.NotFound() : TypedResults.Ok(verses);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
    }
}
