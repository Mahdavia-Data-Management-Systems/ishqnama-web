using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class TranslationFunctions(TranslationService translationService)
{
    [Function("GetTranslations")]
    public async Task<IResult> GetTranslations(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "translations")] HttpRequest req)
    {
        var translations = await translationService.GetTranslationsAsync();
        return Results.Ok(translations);
    }
}
