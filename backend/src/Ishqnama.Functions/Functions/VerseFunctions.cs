using Ishqnama.Application.Services;
using Ishqnama.Functions.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class VerseFunctions(VerseService verseService)
{
    [Function("GetVerseRange")]
    public async Task<IResult> GetVerseRange(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "verses")] HttpRequest req,
        string from, string to, int? translationId = null)
    {
        if (!VerseService.TryParseVerseRef(from, out var fromChapter, out var fromVerse) ||
            !VerseService.TryParseVerseRef(to, out var toChapter, out var toVerse))
        {
            return Results.BadRequest("Invalid verse reference format. Use 'chapter:verse' (e.g., '2:1').");
        }

        var verses = await verseService.GetVerseRangeAsync(fromChapter, fromVerse, toChapter, toVerse, translationId);
        return Results.Ok(req.IsAuthenticated() ? verses : verses.StripExplanations());
    }
}
