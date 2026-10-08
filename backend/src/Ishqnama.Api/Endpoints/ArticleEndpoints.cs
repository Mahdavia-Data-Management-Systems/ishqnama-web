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

    private static Results<ContentHttpResult, StatusCodeHttpResult, NotFound> GetNoorEImaanEssay(
        string slug, ArticleService articles, HttpContext context)
    {
        var essay = articles.GetNoorEImaanEssay(slug);
        if (essay is null)
            return TypedResults.NotFound();

        // The ETag follows the essay's text, so a corrected essay reaches readers who have the old one cached.
        context.Response.Headers.ETag = essay.ETag;
        if (context.Request.Headers.IfNoneMatch.ToString() == essay.ETag)
            return TypedResults.StatusCode(StatusCodes.Status304NotModified);

        return TypedResults.Text(essay.Json, "application/json", Encoding.UTF8);
    }
}
