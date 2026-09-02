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

    [Function("AddUserBookmark")]
    public async Task<IResult> AddUserBookmark(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "user/bookmarks")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var body = await req.ReadFromJsonAsync<BookmarkRequest>();
        if (body is null) return Results.BadRequest(new { error = "Invalid request body." });

        await userDataService.AddBookmarkAsync(userId, body.ChapterNumber, body.VerseNumber);
        return Results.Ok();
    }

    [Function("RemoveUserBookmark")]
    public async Task<IResult> RemoveUserBookmark(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "user/bookmarks/{chapter:int}/{verse:int}")] HttpRequest req,
        int chapter, int verse)
    {
        var userId = GetUserId(req.HttpContext);
        await userDataService.RemoveBookmarkAsync(userId, chapter, verse);
        return Results.Ok();
    }

    // Favorites

    [Function("GetUserFavorites")]
    public async Task<IResult> GetUserFavorites(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "user/favorites")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var favorites = await userDataService.GetFavoritesAsync(userId);
        return Results.Ok(favorites);
    }

    [Function("AddUserFavorite")]
    public async Task<IResult> AddUserFavorite(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "user/favorites")] HttpRequest req)
    {
        var userId = GetUserId(req.HttpContext);
        var body = await req.ReadFromJsonAsync<BookmarkRequest>();
        if (body is null) return Results.BadRequest(new { error = "Invalid request body." });

        await userDataService.AddFavoriteAsync(userId, body.ChapterNumber, body.VerseNumber);
        return Results.Ok();
    }

    [Function("RemoveUserFavorite")]
    public async Task<IResult> RemoveUserFavorite(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "user/favorites/{chapter:int}/{verse:int}")] HttpRequest req,
        int chapter, int verse)
    {
        var userId = GetUserId(req.HttpContext);
        await userDataService.RemoveFavoriteAsync(userId, chapter, verse);
        return Results.Ok();
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

    private sealed record BookmarkRequest(int ChapterNumber, int VerseNumber);
    private sealed record HistoryRequest(int ChapterNumber);
}
