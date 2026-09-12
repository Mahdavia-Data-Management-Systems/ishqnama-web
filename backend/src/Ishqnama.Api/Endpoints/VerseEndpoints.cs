using System.Security.Claims;
using Ishqnama.Api.Helpers;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class VerseEndpoints
{
    public static RouteGroupBuilder MapVerseEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/verses", GetVerseRange).AllowAnonymous().WithTags("Verses");
        return api;
    }

    private static async Task<Results<Ok<List<VerseDto>>, BadRequest<string>>> GetVerseRange(
        VerseService verseService, ClaimsPrincipal user,
        string? from = null, string? to = null, int? translationId = null)
    {
        if (from is null || to is null ||
            !VerseService.TryParseVerseRef(from, out var fromChapter, out var fromVerse) ||
            !VerseService.TryParseVerseRef(to, out var toChapter, out var toVerse))
        {
            return TypedResults.BadRequest("Invalid verse reference format. Use 'chapter:verse' (e.g., '2:1').");
        }

        var verses = await verseService.GetVerseRangeAsync(fromChapter, fromVerse, toChapter, toVerse, translationId);
        return TypedResults.Ok(user.IsAuthenticated() ? verses : verses.StripExplanations());
    }
}
