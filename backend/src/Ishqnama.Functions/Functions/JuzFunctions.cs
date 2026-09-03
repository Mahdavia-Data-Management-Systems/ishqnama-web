using Ishqnama.Application.Services;
using Ishqnama.Functions.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class JuzFunctions(JuzService juzService)
{
    [Function("GetAllJuz")]
    public async Task<IResult> GetAllJuz(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "juz")] HttpRequest req)
    {
        var juz = await juzService.GetAllJuzAsync();
        return Results.Ok(juz);
    }

    [Function("GetJuzVerses")]
    public async Task<IResult> GetJuzVerses(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "juz/{num:int}/verses")] HttpRequest req,
        int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        var result = await juzService.GetJuzVersesAsync(num, translationId, page, pageSize);
        return result is null ? Results.NotFound() : Results.Ok(req.IsAuthenticated() ? result : result.StripExplanations());
    }
}
