using Ishqnama.Api.Data;
using Ishqnama.Api.Dtos;
using Ishqnama.Api.Mappings;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Api.Endpoints;

public static class TranslationEndpoints
{
    public static RouteGroupBuilder MapTranslationEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/translations")
            .WithTags("Translations");

        group.MapGet("/", GetTranslations)
            .CacheOutput("Immutable");

        return group;
    }

    private static async Task<Ok<List<TranslationDto>>> GetTranslations(QuranDbContext db)
    {
        var translations = await db.Translations
            .OrderBy(t => t.TranslationId)
            .Select(t => t.ToDto())
            .ToListAsync();
        return TypedResults.Ok(translations);
    }
}
