using System.Security.Claims;
using Ishqnama.Api.Contracts;
using Ishqnama.Api.Helpers;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class UserDataEndpoints
{
    public static RouteGroupBuilder MapUserDataEndpoints(this RouteGroupBuilder api)
    {
        var user = api.MapGroup("/user").RequireAuthorization().WithTags("User data");

        user.MapGet("/settings", GetUserSettings);
        user.MapPut("/settings", SaveUserSettings);

        user.MapGet("/bookmarks", GetUserBookmarks);
        user.MapPost("/bookmarks", CreateUserBookmark);
        user.MapPut("/bookmarks/{slug}/position", UpdateBookmarkPosition);
        user.MapDelete("/bookmarks/{slug}", DeleteUserBookmark);

        user.MapGet("/history", GetUserHistory);
        user.MapPost("/history", AddUserHistory);

        return api;
    }

    // Settings

    private static async Task<Ok<UserSettingsDto?>> GetUserSettings(
        UserDataService userDataService, ClaimsPrincipal user)
    {
        var settings = await userDataService.GetSettingsAsync(user.GetUserId());
        return TypedResults.Ok<UserSettingsDto?>(settings);
    }

    private static async Task<Results<Ok, BadRequest<ErrorResponse>>> SaveUserSettings(
        UserDataService userDataService, ClaimsPrincipal user, UserSettingsDto? settings)
    {
        if (settings is null)
            return TypedResults.BadRequest(new ErrorResponse("Invalid request body."));

        await userDataService.SaveSettingsAsync(user.GetUserId(), settings);
        return TypedResults.Ok();
    }

    // Bookmarks

    private static async Task<Ok<IReadOnlyList<UserBookmarkDto>>> GetUserBookmarks(
        UserDataService userDataService, ClaimsPrincipal user)
    {
        var bookmarks = await userDataService.GetBookmarksAsync(user.GetUserId());
        return TypedResults.Ok(bookmarks);
    }

    private static async Task<Results<Created<UserBookmarkDto>, Conflict<ErrorResponse>, BadRequest<ErrorResponse>>> CreateUserBookmark(
        UserDataService userDataService, ClaimsPrincipal user, CreateBookmarkRequest? body)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.Icon))
            return TypedResults.BadRequest(new ErrorResponse("Title and icon are required."));

        try
        {
            var bookmark = await userDataService.CreateBookmarkAsync(user.GetUserId(), body.Title, body.Icon);
            return TypedResults.Created($"/user/bookmarks/{bookmark.Slug}", bookmark);
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.Conflict(new ErrorResponse(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
    }

    private static async Task<Results<Ok, BadRequest<ErrorResponse>, NotFound<ErrorResponse>>> UpdateBookmarkPosition(
        UserDataService userDataService, ClaimsPrincipal user, string slug, UpdatePositionRequest? body)
    {
        if (body is null)
            return TypedResults.BadRequest(new ErrorResponse("Invalid request body."));

        try
        {
            await userDataService.UpdateBookmarkPositionAsync(user.GetUserId(), slug, body.ChapterNumber, body.VerseNumber);
            return TypedResults.Ok();
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
        catch (KeyNotFoundException)
        {
            return TypedResults.NotFound(new ErrorResponse($"Bookmark '{slug}' not found."));
        }
    }

    private static async Task<Results<Ok, BadRequest<ErrorResponse>>> DeleteUserBookmark(
        UserDataService userDataService, ClaimsPrincipal user, string slug)
    {
        try
        {
            await userDataService.DeleteBookmarkAsync(user.GetUserId(), slug);
            return TypedResults.Ok();
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
    }

    // History

    private static async Task<Ok<IReadOnlyList<UserHistoryDto>>> GetUserHistory(
        UserDataService userDataService, ClaimsPrincipal user, string? limit = null)
    {
        // Same leniency as the Functions host: a missing or non-numeric limit falls back to 50.
        var resolvedLimit = int.TryParse(limit, out var l) ? l : 50;
        var history = await userDataService.GetHistoryAsync(user.GetUserId(), resolvedLimit);
        return TypedResults.Ok(history);
    }

    private static async Task<Results<Ok, BadRequest<ErrorResponse>>> AddUserHistory(
        UserDataService userDataService, ClaimsPrincipal user, HistoryRequest? body)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.Title) || string.IsNullOrWhiteSpace(body.Url))
            return TypedResults.BadRequest(new ErrorResponse("Title and url are required."));

        await userDataService.AddHistoryEntryAsync(user.GetUserId(), body.Title, body.Url);
        return TypedResults.Ok();
    }
}
