using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class UserDataFunctions(UserDataService userDataService)
{
    private static string GetUserId(HttpContext httpContext) =>
        (string)httpContext.Items["UserId"]!;

    // Settings

    [Function("GetUserSettings")]
    public async Task<IResult> GetUserSettings(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "user/settings")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var settings = await userDataService.GetSettingsAsync(userId);
        return Results.Ok(settings);
    }

    [Function("SaveUserSettings")]
    public async Task<IResult> SaveUserSettings(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "user/settings")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var settings = await req.ReadFromJsonAsync<UserSettingsDto>();
        if (settings is null) return Results.BadRequest(new { error = "Invalid request body." });

        await userDataService.SaveSettingsAsync(userId, settings);
        return Results.Ok();
    }

    // Bookmarks

    [Function("GetUserBookmarks")]
    public async Task<IResult> GetUserBookmarks(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "user/bookmarks")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var bookmarks = await userDataService.GetBookmarksAsync(userId);
        return Results.Ok(bookmarks);
    }

    [Function("CreateUserBookmark")]
    public async Task<IResult> CreateUserBookmark(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "user/bookmarks")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var body = await req.ReadFromJsonAsync<CreateBookmarkRequest>();
        if (body is null || string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.Icon))
            return Results.BadRequest(new { error = "Title and icon are required." });

        try
        {
            var bookmark = await userDataService.CreateBookmarkAsync(userId, body.Title, body.Icon);
            return Results.Created($"/user/bookmarks/{bookmark.Slug}", bookmark);
        }
        catch (InvalidOperationException ex)
        {
            return Results.Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    [Function("UpdateBookmarkPosition")]
    public async Task<IResult> UpdateBookmarkPosition(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "user/bookmarks/{slug}/position")] HttpRequest req,
        string slug)
    {
        var userId = GetUserId(req.HttpContext);
        var body = await req.ReadFromJsonAsync<UpdatePositionRequest>();
        if (body is null) return Results.BadRequest(new { error = "Invalid request body." });

        try
        {
            await userDataService.UpdateBookmarkPositionAsync(userId, slug, body.ChapterNumber, body.VerseNumber);
            return Results.Ok();
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return Results.NotFound(new { error = $"Bookmark '{slug}' not found." });
        }
    }

    [Function("DeleteUserBookmark")]
    public async Task<IResult> DeleteUserBookmark(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "user/bookmarks/{slug}")] HttpRequest req,
        string slug)
    {
        var userId = GetUserId(req.HttpContext);

        try
        {
            await userDataService.DeleteBookmarkAsync(userId, slug);
            return Results.Ok();
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    // History

    [Function("GetUserHistory")]
    public async Task<IResult> GetUserHistory(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "user/history")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var limit = int.TryParse(req.Query["limit"], out var l) ? l : 50;
        var history = await userDataService.GetHistoryAsync(userId, limit);
        return Results.Ok(history);
    }

    [Function("AddUserHistory")]
    public async Task<IResult> AddUserHistory(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "user/history")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var body = await req.ReadFromJsonAsync<HistoryRequest>();
        if (body is null) return Results.BadRequest(new { error = "Invalid request body." });

        await userDataService.AddHistoryEntryAsync(userId, body.ChapterNumber);
        return Results.Ok();
    }

    // Request models

    private sealed record CreateBookmarkRequest(string Title, string Icon);
    private sealed record UpdatePositionRequest(int ChapterNumber, int VerseNumber);
    private sealed record HistoryRequest(int ChapterNumber);
}
