using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class SearchEndpoints
{
    private static readonly string[] ValidScopes = ["both", "tarjuma", "tafseer"];

    public static RouteGroupBuilder MapSearchEndpoints(this RouteGroupBuilder api)
    {
        // Authenticated to prevent abuse; also the only reason SearchResultDto.Explanation is never stripped.
        api.MapGet("/search", Search).RequireAuthorization().WithTags("Search");
        return api;
    }

    private static async Task<Results<Ok<PagedResponse<SearchResultDto>>, BadRequest<string>>> Search(
        SearchService searchService,
        string? q = null, string? scope = null, int? translationId = null, int? page = null, int? pageSize = null)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return TypedResults.BadRequest("Query parameter 'q' must be at least 2 characters.");

        var resolvedScope = scope is not null && ValidScopes.Contains(scope) ? scope : "both";

        var results = await searchService.SearchAsync(
            q, resolvedScope, translationId ?? 2, page ?? 1, pageSize ?? 20);

        return TypedResults.Ok(results);
    }
}
