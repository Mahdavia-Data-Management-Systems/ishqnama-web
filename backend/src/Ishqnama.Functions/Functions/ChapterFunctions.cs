using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class ChapterFunctions(ChapterService chapterService)
{
    [Function("GetChapters")]
    public async Task<IResult> GetChapters(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters")] HttpRequest req,
        string? lang = null)
    {
        var chapters = await chapterService.GetChaptersAsync(lang);
        return Results.Ok(chapters);
    }

    [Function("GetChapter")]
    public async Task<IResult> GetChapter(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters/{num:int}")] HttpRequest req,
        int num)
    {
        var chapter = await chapterService.GetChapterAsync(num);
        return chapter is null ? Results.NotFound() : Results.Ok(chapter);
    }

    [Function("GetChapterVerses")]
    public async Task<IResult> GetChapterVerses(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters/{num:int}/verses")] HttpRequest req,
        int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        var result = await chapterService.GetChapterVersesAsync(num, translationId, page, pageSize);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    [Function("GetVerse")]
    public async Task<IResult> GetVerse(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters/{num:int}/verses/{verseNum:int}")] HttpRequest req,
        int num, int verseNum)
    {
        var verse = await chapterService.GetVerseAsync(num, verseNum);
        return verse is null ? Results.NotFound() : Results.Ok(verse);
    }
}
