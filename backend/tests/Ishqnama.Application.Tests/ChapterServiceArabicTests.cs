using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Application.Services;

namespace Ishqnama.Application.Tests;

public sealed class ChapterServiceArabicTests
{
    private readonly RangeRecorder _repository = new();
    private readonly ChapterService _service;

    public ChapterServiceArabicTests() => _service = new ChapterService(_repository);

    [Fact]
    public async Task Returns_only_the_arabic_of_the_range()
    {
        var verses = await _service.GetArabicVersesAsync(2, 255, 257);

        Assert.Equal((2, 255, 2, 257, (int?)null), _repository.LastRange);
        Assert.Equal([255, 256, 257], verses!.Select(v => v.VerseNumber));
        Assert.Equal("text 2:255", verses![0].ArabicText);
    }

    [Fact]
    public async Task Omitting_the_bounds_returns_the_whole_chapter()
    {
        await _service.GetArabicVersesAsync(1, null, null);

        Assert.Equal((1, 1, 1, 7, (int?)null), _repository.LastRange);
    }

    [Fact]
    public async Task Unknown_chapters_are_not_found()
        => Assert.Null(await _service.GetArabicVersesAsync(115, null, null));

    [Theory]
    [InlineData(0, 3)]
    [InlineData(1, 8)]
    [InlineData(5, 3)]
    public async Task Bad_ranges_are_rejected(int from, int to)
        => await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => _service.GetArabicVersesAsync(1, from, to));

    private sealed class RangeRecorder : IQuranReadOnlyRepository
    {
        public (int, int, int, int, int?) LastRange { get; private set; }

        public Task<List<VerseDto>> GetVerseRangeAsync(int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null)
        {
            LastRange = (fromChapter, fromVerse, toChapter, toVerse, translationId);
            return Task.FromResult(Enumerable.Range(fromVerse, toVerse - fromVerse + 1)
                .Select(v => new VerseDto(fromChapter, v, $"text {fromChapter}:{v}", 1, 1, false))
                .ToList());
        }

        public Task<List<ChapterDto>> GetChaptersAsync(string? lang = null) => throw new NotSupportedException();
        public Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber) => throw new NotSupportedException();
        public Task<bool> ChapterExistsAsync(int chapterNumber) => throw new NotSupportedException();
        public Task<PagedResponse<VerseDto>> GetChapterVersesAsync(int chapterNumber, int? translationId, int page, int pageSize) => throw new NotSupportedException();
        public Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber) => throw new NotSupportedException();
        public Task<List<JuzDto>> GetAllJuzAsync() => throw new NotSupportedException();
        public Task<bool> JuzExistsAsync(int juzNumber) => throw new NotSupportedException();
        public Task<PagedResponse<VerseDto>> GetJuzVersesAsync(int juzNumber, int? translationId, int page, int pageSize) => throw new NotSupportedException();
        public Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null) => throw new NotSupportedException();
        public Task<bool> RukuExistsAsync(int rukuId) => throw new NotSupportedException();
        public Task<List<VerseDto>> GetRukuVersesAsync(int rukuId, int? translationId = null) => throw new NotSupportedException();
        public Task<List<TranslationDto>> GetTranslationsAsync() => throw new NotSupportedException();
        public Task<PagedResponse<SearchResultDto>> SearchAsync(string query, string scope, int translationId, int page, int pageSize) => throw new NotSupportedException();
    }
}
