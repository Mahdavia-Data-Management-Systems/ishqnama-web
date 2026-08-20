using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class RukuFunctions(RukuService rukuService)
{
    [Function("GetRukus")]
    public async Task<IResult> GetRukus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "rukus")] HttpRequest req,
        int? chapterNum = null, int? juzNum = null)
    {
        var rukus = await rukuService.GetRukusAsync(chapterNum, juzNum);
        return Results.Ok(rukus);
    }

    [Function("GetRukuVerses")]
    public async Task<IResult> GetRukuVerses(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "rukus/{id:int}/verses")] HttpRequest req,
        int id, int? translationId = null)
    {
        var verses = await rukuService.GetRukuVersesAsync(id, translationId);
        return verses is null ? Results.NotFound() : Results.Ok(verses);
    }
}
