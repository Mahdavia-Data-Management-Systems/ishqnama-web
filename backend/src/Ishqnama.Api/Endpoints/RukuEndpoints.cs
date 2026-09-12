using System.Security.Claims;
using Ishqnama.Api.Helpers;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class RukuEndpoints
{
    public static RouteGroupBuilder MapRukuEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/rukus").AllowAnonymous().WithTags("Rukus");

        group.MapGet("/", GetRukus);
        group.MapGet("/{id:int}/verses", GetRukuVerses);

        return api;
    }

    private static async Task<Ok<List<RukuDto>>> GetRukus(
        RukuService rukuService, int? chapterNum = null, int? juzNum = null)
    {
        var rukus = await rukuService.GetRukusAsync(chapterNum, juzNum);
        return TypedResults.Ok(rukus);
    }

    private static async Task<Results<Ok<List<VerseDto>>, NotFound>> GetRukuVerses(
        RukuService rukuService, ClaimsPrincipal user, int id, int? translationId = null)
    {
        var verses = await rukuService.GetRukuVersesAsync(id, translationId);
        return verses is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(user.IsAuthenticated() ? verses : verses.StripExplanations());
    }
}
