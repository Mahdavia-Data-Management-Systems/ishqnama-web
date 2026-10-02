using System.Security.Claims;
using Ishqnama.Api.Contracts;
using Ishqnama.Api.Helpers;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

/// <summary>
/// Verse lists: the owner's routes under <c>/user/lists</c> (signed in) and the published-list
/// reads under <c>/lists</c> (anonymous; a token only tells the page whether the viewer owns it).
/// Neither is cached: <c>CacheHeaderMiddleware</c> skips both, since a published list is edited live.
/// </summary>
internal static class VerseListEndpoints
{
    public static RouteGroupBuilder MapVerseListEndpoints(this RouteGroupBuilder api)
    {
        var mine = api.MapGroup("/user/lists").RequireAuthorization().WithTags("Verse lists");
        mine.MapGet("/", GetMyLists);
        mine.MapPost("/", CreateList);
        mine.MapGet("/{id}", GetMyList);
        mine.MapPut("/{id}", UpdateList);
        mine.MapPut("/{id}/groups", ReplaceGroups);
        mine.MapPost("/{id}/groups", AppendGroup);
        mine.MapPost("/{id}/publish", PublishList);
        mine.MapPost("/{id}/unpublish", UnpublishList);
        mine.MapDelete("/{id}", DeleteList);

        var published = api.MapGroup("/lists").AllowAnonymous().WithTags("Verse lists");
        published.MapGet("/", GetPublishedSummaries);
        published.MapGet("/{id}", GetPublishedList);

        var favorites = api.MapGroup("/user/favorites").RequireAuthorization().WithTags("Favorites");
        favorites.MapGet("/", GetFavorites);
        favorites.MapPut("/", SaveFavorite);
        favorites.MapDelete("/{id}", DeleteFavorite);

        return api;
    }

    // Owner

    private static async Task<Ok<IReadOnlyList<VerseListSummaryDto>>> GetMyLists(
        VerseListService service, ClaimsPrincipal user)
        => TypedResults.Ok(await service.GetMyListsAsync(user.GetUserId()));

    private static async Task<Results<Created<VerseListDto>, BadRequest<ErrorResponse>, Conflict<ErrorResponse>>> CreateList(
        VerseListService service, ClaimsPrincipal user, VerseListDetailsRequest? body)
    {
        if (body is null)
            return TypedResults.BadRequest(new ErrorResponse("Invalid request body."));
        try
        {
            var list = await service.CreateAsync(user.GetUserId(), user.GetUserName(), body.Title, body.Description);
            return TypedResults.Created($"/user/lists/{list.Id}", list);
        }
        catch (ArgumentException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.Conflict(new ErrorResponse(ex.Message));
        }
    }

    private static async Task<Results<Ok<VerseListDto>, NotFound<ErrorResponse>>> GetMyList(
        VerseListService service, ClaimsPrincipal user, string id)
    {
        try
        {
            return TypedResults.Ok(await service.GetMineAsync(user.GetUserId(), id));
        }
        catch (KeyNotFoundException)
        {
            return ListNotFound();
        }
    }

    private static Task<Results<Ok<VerseListDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>>> UpdateList(
        VerseListService service, ClaimsPrincipal user, string id, VerseListDetailsRequest? body)
        => body is null
            ? Task.FromResult(InvalidBody())
            : Mutate(() => service.UpdateDetailsAsync(user.GetUserId(), user.GetUserName(), id, body.Title, body.Description));

    private static Task<Results<Ok<VerseListDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>>> ReplaceGroups(
        VerseListService service, ClaimsPrincipal user, string id, VerseListGroupsRequest? body)
        => body?.Groups is null
            ? Task.FromResult(InvalidBody())
            : Mutate(() => service.ReplaceGroupsAsync(user.GetUserId(), user.GetUserName(), id, body.Groups));

    private static Task<Results<Ok<VerseListDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>>> AppendGroup(
        VerseListService service, ClaimsPrincipal user, string id, VerseListGroupDto? body)
        => body is null
            ? Task.FromResult(InvalidBody())
            : Mutate(() => service.AppendGroupAsync(user.GetUserId(), user.GetUserName(), id, body));

    private static Task<Results<Ok<VerseListDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>>> PublishList(
        VerseListService service, ClaimsPrincipal user, string id)
        => Mutate(() => service.SetPublishedAsync(user.GetUserId(), user.GetUserName(), id, published: true));

    private static Task<Results<Ok<VerseListDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>>> UnpublishList(
        VerseListService service, ClaimsPrincipal user, string id)
        => Mutate(() => service.SetPublishedAsync(user.GetUserId(), user.GetUserName(), id, published: false));

    private static async Task<Results<Ok, NotFound<ErrorResponse>>> DeleteList(
        VerseListService service, ClaimsPrincipal user, string id)
    {
        try
        {
            await service.DeleteAsync(user.GetUserId(), id);
            return TypedResults.Ok();
        }
        catch (KeyNotFoundException)
        {
            return ListNotFound();
        }
    }

    // Published

    private static async Task<Results<Ok<VerseListDto>, NotFound<ErrorResponse>>> GetPublishedList(
        VerseListService service, ClaimsPrincipal user, string id)
    {
        var viewerId = user.IsAuthenticated() ? user.GetUserId() : null;
        var list = await service.GetPublishedAsync(id, viewerId);
        return list is null ? ListNotFound() : TypedResults.Ok(list);
    }

    private static async Task<Results<Ok<IReadOnlyList<VerseListSummaryDto>>, BadRequest<ErrorResponse>>> GetPublishedSummaries(
        VerseListService service, string? ids = null)
    {
        var requested = (ids ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        try
        {
            return TypedResults.Ok(await service.GetPublishedSummariesAsync(requested));
        }
        catch (ArgumentException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
    }

    // Favorites

    private static async Task<Ok<IReadOnlyList<FavoriteDto>>> GetFavorites(
        VerseListService service, ClaimsPrincipal user)
        => TypedResults.Ok(await service.GetFavoritesAsync(user.GetUserId()));

    private static async Task<Results<Ok<FavoriteDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>>> SaveFavorite(
        VerseListService service, ClaimsPrincipal user, FavoriteRequest? body)
    {
        if (body is null)
            return TypedResults.BadRequest(new ErrorResponse("Invalid request body."));
        try
        {
            return TypedResults.Ok(await service.SaveFavoriteAsync(user.GetUserId(), body.Kind, body.ListId));
        }
        catch (ArgumentException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
        catch (KeyNotFoundException)
        {
            return ListNotFound();
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.Conflict(new ErrorResponse(ex.Message));
        }
    }

    private static async Task<Results<Ok, BadRequest<ErrorResponse>>> DeleteFavorite(
        VerseListService service, ClaimsPrincipal user, string id)
    {
        try
        {
            await service.DeleteFavoriteAsync(user.GetUserId(), id);
            return TypedResults.Ok();
        }
        catch (ArgumentException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
    }

    // Helpers

    private static async Task<Results<Ok<VerseListDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>>> Mutate(
        Func<Task<VerseListDto>> action)
    {
        try
        {
            return TypedResults.Ok(await action());
        }
        catch (ArgumentException ex)
        {
            return TypedResults.BadRequest(new ErrorResponse(ex.Message));
        }
        catch (KeyNotFoundException)
        {
            return ListNotFound();
        }
        catch (InvalidOperationException ex)
        {
            return TypedResults.Conflict(new ErrorResponse(ex.Message));
        }
    }

    private static Results<Ok<VerseListDto>, BadRequest<ErrorResponse>, NotFound<ErrorResponse>, Conflict<ErrorResponse>> InvalidBody()
        => TypedResults.BadRequest(new ErrorResponse("Invalid request body."));

    private static NotFound<ErrorResponse> ListNotFound()
        => TypedResults.NotFound(new ErrorResponse("List not found."));
}
