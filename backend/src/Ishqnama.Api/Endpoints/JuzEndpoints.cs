using System.Security.Claims;
using Ishqnama.Api.Helpers;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class JuzEndpoints
{
    public static RouteGroupBuilder MapJuzEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/juz").AllowAnonymous().WithTags("Juz");

        group.MapGet("/", GetAllJuz);
        group.MapGet("/{num:int}/verses", GetJuzVerses);

        return api;
    }

    private static async Task<Ok<List<JuzDto>>> GetAllJuz(JuzService juzService)
    {
        var juz = await juzService.GetAllJuzAsync();
        return TypedResults.Ok(juz);
    }

    private static async Task<Results<Ok<PagedResponse<VerseDto>>, NotFound>> GetJuzVerses(
        JuzService juzService, ClaimsPrincipal user,
        int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        var result = await juzService.GetJuzVersesAsync(num, translationId, page, pageSize);
        return result is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(user.IsAuthenticated() ? result : result.StripExplanations());
    }
}
