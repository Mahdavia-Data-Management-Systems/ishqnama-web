using System.Security.Claims;
using Ishqnama.Api.Helpers;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class BibliographyEndpoints
{
    public static RouteGroupBuilder MapBibliographyEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/bibliography", GetBibliography).AllowAnonymous().WithTags("Bibliography");
        return api;
    }

    // Everyone gets the books and how often each is cited; where and what they cite is takhreej,
    // which is part of the tafseer, so it needs a token like the explanations do.
    private static async Task<Ok<List<BibliographyBookDto>>> GetBibliography(
        BibliographyService bibliographyService, ClaimsPrincipal user)
    {
        var books = await bibliographyService.GetBibliographyAsync();
        return TypedResults.Ok(user.IsAuthenticated() ? books : books.StripCitations());
    }
}
