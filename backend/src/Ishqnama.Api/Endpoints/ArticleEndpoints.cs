using System.Text;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class ArticleEndpoints
{
    public static RouteGroupBuilder MapArticleEndpoints(this RouteGroupBuilder api)
    {
        // Signed-in readers only: the essays are not in the static site, so this is the only way to read them.
        api.MapGet("/articles/nooreimaan/{slug}", GetNoorEImaanEssay).RequireAuthorization().WithTags("Articles");
        return api;
    }

    private static Results<ContentHttpResult, NotFound> GetNoorEImaanEssay(string slug, ArticleService articles)
    {
        var json = articles.GetNoorEImaanEssay(slug);
        return json is null
            ? TypedResults.NotFound()
            : TypedResults.Text(json, "application/json", Encoding.UTF8);
    }
}
