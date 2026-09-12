using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class TranslationEndpoints
{
    public static RouteGroupBuilder MapTranslationEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/translations", GetTranslations).AllowAnonymous().WithTags("Translations");
        return api;
    }

    private static async Task<Ok<List<TranslationDto>>> GetTranslations(TranslationService translationService)
    {
        var translations = await translationService.GetTranslationsAsync();
        return TypedResults.Ok(translations);
    }
}
