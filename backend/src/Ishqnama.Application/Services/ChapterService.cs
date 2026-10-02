using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class ChapterService(IQuranReadOnlyRepository repository)
{
    public Task<List<ChapterDto>> GetChaptersAsync(string? lang = null)
        => repository.GetChaptersAsync(lang);

    public Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber)
        => repository.GetChapterAsync(chapterNumber);

    public async Task<PagedResponse<VerseDto>?> GetChapterVersesAsync(
        int chapterNumber, int? translationId, int page, int pageSize)
    {
        if (!await repository.ChapterExistsAsync(chapterNumber))
            return null;

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        return await repository.GetChapterVersesAsync(chapterNumber, translationId, page, pageSize);
    }

    public Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber)
        => repository.GetVerseAsync(chapterNumber, verseNumber);

    /// <summary>
    /// The Arabic of verses <paramref name="from"/> to <paramref name="to"/> of a chapter (the whole
    /// chapter when both are omitted), for pages that print the text alone. Returns null for an
    /// unknown chapter and throws <see cref="ArgumentOutOfRangeException"/> for a bad range.
    /// </summary>
    public async Task<List<ArabicVerseDto>?> GetArabicVersesAsync(int chapterNumber, int? from, int? to)
    {
        if (!QuranShape.IsChapter(chapterNumber))
            return null;

        var verseCount = QuranShape.VerseCount(chapterNumber);
        var first = from ?? 1;
        var last = to ?? verseCount;
        ArgumentOutOfRangeException.ThrowIfLessThan(first, 1, nameof(from));
        ArgumentOutOfRangeException.ThrowIfGreaterThan(last, verseCount, nameof(to));
        ArgumentOutOfRangeException.ThrowIfGreaterThan(first, last, nameof(from));

        var verses = await repository.GetVerseRangeAsync(chapterNumber, first, chapterNumber, last);
        return verses.Select(v => new ArabicVerseDto(v.VerseNumber, v.ArabicText, v.HasSajdah)).ToList();
    }
}
