using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class SearchFunction(SearchService searchService)
{
    private static readonly string[] ValidScopes = ["both", "tarjuma", "tafseer"];

    [Function("Search")]
    public async Task<IResult> Search(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "search")] HttpRequest req,
        string? q = null, string? scope = null, int? translationId = null, int? page = null, int? pageSize = null)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Results.BadRequest("Query parameter 'q' must be at least 2 characters.");

        var resolvedScope = scope is not null && ValidScopes.Contains(scope) ? scope : "both";

        var results = await searchService.SearchAsync(
            q, resolvedScope, translationId ?? 2, page ?? 1, pageSize ?? 20);

        return Results.Ok(results);
    }
}
