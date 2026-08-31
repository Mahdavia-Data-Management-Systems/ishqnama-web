using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Application.Mappings;
using Ishqnama.Domain.Entities;
using Ishqnama.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ishqnama.Infrastructure.Repositories;

public sealed class CachedQuranReadOnlyRepository : IQuranReadOnlyRepository
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private volatile bool _isLoaded;

    private List<Chapter> _chapters = [];
    private List<ChapterTranslation> _chapterTranslations = [];
    private List<Verse> _verses = [];
    private List<Juz> _juz = [];
    private List<Ruku> _rukus = [];
    private List<Translation> _translations = [];
    private List<TranslationSegment> _translationSegments = [];

    public CachedQuranReadOnlyRepository(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    private async Task EnsureLoadedAsync()
    {
        if (_isLoaded) return;

        await _semaphore.WaitAsync();
        try
        {
            if (_isLoaded) return;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<QuranDbContext>();

            _chapters = await db.Chapters.ToListAsync();
            _chapterTranslations = await db.ChapterTranslations.ToListAsync();
            _verses = await db.Verses.ToListAsync();
            _juz = await db.Juz.ToListAsync();
            _rukus = await db.Rukus.ToListAsync();
            _translations = await db.Translations.ToListAsync();
            _translationSegments = await db.TranslationSegments.ToListAsync();

            _isLoaded = true;
        }
        finally
        {
            _semaphore.Release();
        }
    }

    // --- Chapters ---

    public async Task<List<ChapterDto>> GetChaptersAsync(string? lang = null)
    {
        await EnsureLoadedAsync();

        if (lang is not null)
        {
            var translationLookup = _chapterTranslations
                .Where(ct => ct.LanguageCode == lang)
                .ToDictionary(ct => ct.ChapterNumber, ct => ct.TranslatedName);

            return _chapters
                .OrderBy(c => c.ChapterNumber)
                .Select(c => c.ToDto(translationLookup.GetValueOrDefault(c.ChapterNumber)))
                .ToList();
        }

        return _chapters
            .OrderBy(c => c.ChapterNumber)
            .Select(c => c.ToDto(null))
            .ToList();
    }

    public async Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber)
    {
        await EnsureLoadedAsync();

        var chapter = _chapters.FirstOrDefault(c => c.ChapterNumber == chapterNumber);
        if (chapter is null) return null;

        var translations = _chapterTranslations
            .Where(ct => ct.ChapterNumber == chapterNumber)
            .Select(ct => new ChapterTranslationDto(ct.LanguageCode, ct.TranslatedName))
            .ToList();

        return new ChapterDetailDto(
            chapter.ChapterNumber, chapter.ArabicName, chapter.TransliteratedName,
            chapter.RevelationType, chapter.VerseCount, chapter.RevelationOrder,
            translations);
    }

    public async Task<bool> ChapterExistsAsync(int chapterNumber)
    {
        await EnsureLoadedAsync();
        return _chapters.Any(c => c.ChapterNumber == chapterNumber);
    }

    public async Task<PagedResponse<VerseDto>> GetChapterVersesAsync(
        int chapterNumber, int? translationId, int page, int pageSize)
    {
        await EnsureLoadedAsync();

        var query = _verses
            .Where(v => v.ChapterNumber == chapterNumber)
            .OrderBy(v => v.VerseNumber)
            .ToList();

        var totalCount = query.Count;
        var verses = query.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var verseDtos = MapVersesWithTranslations(verses, translationId);
        return new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount);
    }

    public async Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber)
    {
        await EnsureLoadedAsync();

        var verse = _verses.FirstOrDefault(v => v.ChapterNumber == chapterNumber && v.VerseNumber == verseNumber);
        if (verse is null) return null;

        var segments = _translationSegments
            .Where(ts => ts.ChapterNumber == chapterNumber && ts.VerseNumber == verseNumber)
            .OrderBy(ts => ts.TranslationId).ThenBy(ts => ts.SegmentIndex)
            .Select(ts => ts.ToDto())
            .ToList();

        return verse.ToDto(segments);
    }

    // --- Juz ---

    public async Task<List<JuzDto>> GetAllJuzAsync()
    {
        await EnsureLoadedAsync();

        return _juz.OrderBy(j => j.JuzNumber).Select(j =>
        {
            var juzVerses = _verses
                .Where(v => v.JuzNumber == j.JuzNumber)
                .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
                .ToList();

            var first = juzVerses.FirstOrDefault();
            var last = juzVerses.LastOrDefault();

            return j.ToDto(
                first?.ChapterNumber, first?.VerseNumber,
                last?.ChapterNumber, last?.VerseNumber);
        }).ToList();
    }

    public async Task<bool> JuzExistsAsync(int juzNumber)
    {
        await EnsureLoadedAsync();
        return _juz.Any(j => j.JuzNumber == juzNumber);
    }

    public async Task<PagedResponse<VerseDto>> GetJuzVersesAsync(
        int juzNumber, int? translationId, int page, int pageSize)
    {
        await EnsureLoadedAsync();

        var query = _verses
            .Where(v => v.JuzNumber == juzNumber)
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
            .ToList();

        var totalCount = query.Count;
        var verses = query.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var verseDtos = MapVersesWithTranslations(verses, translationId);
        return new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount);
    }

    // --- Rukus ---

    public async Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null)
    {
        await EnsureLoadedAsync();

        var query = _rukus.AsEnumerable();
        if (chapterNum.HasValue) query = query.Where(r => r.ChapterNumber == chapterNum.Value);
        if (juzNum.HasValue) query = query.Where(r => r.JuzNumber == juzNum.Value);

        return query.OrderBy(r => r.RukuId).Select(r => r.ToDto()).ToList();
    }

    public async Task<bool> RukuExistsAsync(int rukuId)
    {
        await EnsureLoadedAsync();
        return _rukus.Any(r => r.RukuId == rukuId);
    }

    public async Task<List<VerseDto>> GetRukuVersesAsync(int rukuId, int? translationId = null)
    {
        await EnsureLoadedAsync();

        var verses = _verses
            .Where(v => v.RukuId == rukuId)
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
            .ToList();

        return MapVersesWithTranslations(verses, translationId);
    }

    // --- Translations ---

    public async Task<List<TranslationDto>> GetTranslationsAsync()
    {
        await EnsureLoadedAsync();
        return _translations.OrderBy(t => t.TranslationId).Select(t => t.ToDto()).ToList();
    }

    // --- Verse Range ---

    public async Task<List<VerseDto>> GetVerseRangeAsync(
        int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null)
    {
        await EnsureLoadedAsync();

        var verses = _verses
            .Where(v =>
                (v.ChapterNumber > fromChapter || (v.ChapterNumber == fromChapter && v.VerseNumber >= fromVerse)) &&
                (v.ChapterNumber < toChapter || (v.ChapterNumber == toChapter && v.VerseNumber <= toVerse)))
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
            .ToList();

        return MapVersesWithTranslations(verses, translationId);
    }

    // --- Private Helper ---

    private List<VerseDto> MapVersesWithTranslations(List<Verse> verses, int? translationId)
    {
        if (!translationId.HasValue || verses.Count == 0)
            return verses.Select(v => v.ToDto()).ToList();

        var verseKeySet = verses.Select(v => (v.ChapterNumber, v.VerseNumber)).ToHashSet();
        var chapterNumbers = verses.Select(v => v.ChapterNumber).Distinct().ToHashSet();

        var segmentLookup = _translationSegments
            .Where(ts => ts.TranslationId == translationId.Value
                && chapterNumbers.Contains(ts.ChapterNumber)
                && verseKeySet.Contains((ts.ChapterNumber, ts.VerseNumber)))
            .GroupBy(ts => (ts.ChapterNumber, ts.VerseNumber))
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<TranslationSegmentDto>)g.OrderBy(ts => ts.SegmentIndex).Select(ts => ts.ToDto()).ToList());

        return verses.Select(v =>
            v.ToDto(segmentLookup.GetValueOrDefault((v.ChapterNumber, v.VerseNumber)))).ToList();
    }
}
