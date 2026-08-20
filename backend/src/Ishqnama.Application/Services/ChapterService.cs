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
}
