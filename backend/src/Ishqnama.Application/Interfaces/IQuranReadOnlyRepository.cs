using Ishqnama.Application.Dtos;

namespace Ishqnama.Application.Interfaces;

public interface IQuranReadOnlyRepository
{
    // Chapters
    Task<List<ChapterDto>> GetChaptersAsync(string? lang = null);
    Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber);
    Task<bool> ChapterExistsAsync(int chapterNumber);
    Task<PagedResponse<VerseDto>> GetChapterVersesAsync(int chapterNumber, int? translationId, int page, int pageSize);
    Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber);

    // Juz
    Task<List<JuzDto>> GetAllJuzAsync();
    Task<bool> JuzExistsAsync(int juzNumber);
    Task<PagedResponse<VerseDto>> GetJuzVersesAsync(int juzNumber, int? translationId, int page, int pageSize);

    // Rukus
    Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null);
    Task<bool> RukuExistsAsync(int rukuId);
    Task<List<VerseDto>> GetRukuVersesAsync(int rukuId, int? translationId = null);

    // Translations
    Task<List<TranslationDto>> GetTranslationsAsync();

    // Verse Range
    Task<List<VerseDto>> GetVerseRangeAsync(int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null);
}
