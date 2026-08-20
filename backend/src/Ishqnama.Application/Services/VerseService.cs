using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class VerseService(IQuranReadOnlyRepository repository)
{
    public Task<List<VerseDto>> GetVerseRangeAsync(
        int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null)
        => repository.GetVerseRangeAsync(fromChapter, fromVerse, toChapter, toVerse, translationId);

    public static bool TryParseVerseRef(string input, out int chapter, out int verse)
    {
        chapter = 0; verse = 0;
        var parts = input.Split(':');
        return parts.Length == 2 &&
               int.TryParse(parts[0], out chapter) &&
               int.TryParse(parts[1], out verse);
    }
}
