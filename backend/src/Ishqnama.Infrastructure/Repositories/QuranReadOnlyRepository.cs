using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Application.Mappings;
using Ishqnama.Domain.Entities;
using Ishqnama.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Infrastructure.Repositories;

public sealed class QuranReadOnlyRepository(QuranDbContext db) : IQuranReadOnlyRepository
{
    // --- Chapters ---

    public async Task<List<ChapterDto>> GetChaptersAsync(string? lang = null)
    {
        if (lang is not null)
        {
            return await db.Chapters
                .GroupJoin(
                    db.ChapterTranslations.Where(ct => ct.LanguageCode == lang),
                    c => c.ChapterNumber, ct => ct.ChapterNumber,
                    (c, translations) => new { Chapter = c, Translation = translations.FirstOrDefault() })
                .OrderBy(x => x.Chapter.ChapterNumber)
                .Select(x => x.Chapter.ToDto(x.Translation != null ? x.Translation.TranslatedName : null))
                .ToListAsync();
        }

        return await db.Chapters
            .OrderBy(c => c.ChapterNumber)
            .Select(c => c.ToDto(null))
            .ToListAsync();
    }

    public async Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber)
    {
        var chapter = await db.Chapters
            .Include(c => c.ChapterTranslations)
            .FirstOrDefaultAsync(c => c.ChapterNumber == chapterNumber);
        return chapter?.ToDetailDto();
    }

    public Task<bool> ChapterExistsAsync(int chapterNumber)
        => db.Chapters.AnyAsync(c => c.ChapterNumber == chapterNumber);

    public async Task<PagedResponse<VerseDto>> GetChapterVersesAsync(
        int chapterNumber, int? translationId, int page, int pageSize)
    {
        var query = db.Verses
            .Where(v => v.ChapterNumber == chapterNumber)
            .OrderBy(v => v.VerseNumber);

        var totalCount = await query.CountAsync();
        var verses = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var verseDtos = await MapVersesWithTranslationsAsync(verses, translationId);
        return new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount);
    }

    public async Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber)
    {
        var verse = await db.Verses
            .FirstOrDefaultAsync(v => v.ChapterNumber == chapterNumber && v.VerseNumber == verseNumber);
        if (verse is null) return null;

        var segments = await db.TranslationSegments
            .Where(ts => ts.ChapterNumber == chapterNumber && ts.VerseNumber == verseNumber)
            .OrderBy(ts => ts.TranslationId).ThenBy(ts => ts.SegmentIndex)
            .Select(ts => ts.ToDto())
            .ToListAsync();
        return verse.ToDto(segments);
    }

    // --- Juz ---

    public async Task<List<JuzDto>> GetAllJuzAsync()
    {
        var juzList = await db.Juz.OrderBy(j => j.JuzNumber).ToListAsync();
        var juzDtos = new List<JuzDto>();

        foreach (var j in juzList)
        {
            var firstVerse = await db.Verses
                .Where(v => v.JuzNumber == j.JuzNumber)
                .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
                .Select(v => new { v.ChapterNumber, v.VerseNumber })
                .FirstOrDefaultAsync();

            var lastVerse = await db.Verses
                .Where(v => v.JuzNumber == j.JuzNumber)
                .OrderByDescending(v => v.ChapterNumber).ThenByDescending(v => v.VerseNumber)
                .Select(v => new { v.ChapterNumber, v.VerseNumber })
                .FirstOrDefaultAsync();

            juzDtos.Add(j.ToDto(
                firstVerse?.ChapterNumber, firstVerse?.VerseNumber,
                lastVerse?.ChapterNumber, lastVerse?.VerseNumber));
        }
        return juzDtos;
    }

    public Task<bool> JuzExistsAsync(int juzNumber)
        => db.Juz.AnyAsync(j => j.JuzNumber == juzNumber);

    public async Task<PagedResponse<VerseDto>> GetJuzVersesAsync(
        int juzNumber, int? translationId, int page, int pageSize)
    {
        var query = db.Verses
            .Where(v => v.JuzNumber == juzNumber)
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber);

        var totalCount = await query.CountAsync();
        var verses = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var verseDtos = await MapVersesWithTranslationsAsync(verses, translationId);
        return new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount);
    }

    // --- Rukus ---

    public async Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null)
    {
        var query = db.Rukus.AsQueryable();
        if (chapterNum.HasValue) query = query.Where(r => r.ChapterNumber == chapterNum.Value);
        if (juzNum.HasValue) query = query.Where(r => r.JuzNumber == juzNum.Value);

        return await query.OrderBy(r => r.RukuId).Select(r => r.ToDto()).ToListAsync();
    }

    public Task<bool> RukuExistsAsync(int rukuId)
        => db.Rukus.AnyAsync(r => r.RukuId == rukuId);

    public async Task<List<VerseDto>> GetRukuVersesAsync(int rukuId, int? translationId = null)
    {
        var verses = await db.Verses
            .Where(v => v.RukuId == rukuId)
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
            .ToListAsync();
        return await MapVersesWithTranslationsAsync(verses, translationId);
    }

    // --- Translations ---

    public async Task<List<TranslationDto>> GetTranslationsAsync()
        => await db.Translations.OrderBy(t => t.TranslationId).Select(t => t.ToDto()).ToListAsync();

    // --- Verse Range ---

    public async Task<List<VerseDto>> GetVerseRangeAsync(
        int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null)
    {
        var verses = await db.Verses
            .Where(v =>
                (v.ChapterNumber > fromChapter || (v.ChapterNumber == fromChapter && v.VerseNumber >= fromVerse)) &&
                (v.ChapterNumber < toChapter || (v.ChapterNumber == toChapter && v.VerseNumber <= toVerse)))
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
            .ToListAsync();

        return await MapVersesWithTranslationsAsync(verses, translationId);
    }

    // --- Search ---

    public async Task<PagedResponse<SearchResultDto>> SearchAsync(
        string query, string scope, int translationId, int page, int pageSize)
    {
        var escaped = query.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
        var pattern = $"%{escaped}%";

        var baseQuery = db.TranslationSegments
            .Where(ts => ts.TranslationId == translationId);

        IQueryable<TranslationSegment> matchingSegments = scope switch
        {
            "tarjuma" => baseQuery.Where(ts => EF.Functions.ILike(ts.TranslationText!, pattern, "\\")),
            "tafseer" => baseQuery.Where(ts => EF.Functions.ILike(ts.Explanation!, pattern, "\\")),
            _ => baseQuery.Where(ts => EF.Functions.ILike(ts.TranslationText!, pattern, "\\") || EF.Functions.ILike(ts.Explanation!, pattern, "\\")),
        };

        // Get distinct verse keys ordered
        var verseKeys = matchingSegments
            .Select(ts => new { ts.ChapterNumber, ts.VerseNumber })
            .Distinct()
            .OrderBy(k => k.ChapterNumber).ThenBy(k => k.VerseNumber);

        var totalCount = await verseKeys.CountAsync();

        var pagedKeys = await verseKeys
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();

        var pagedKeySet = pagedKeys.Select(k => (k.ChapterNumber, k.VerseNumber)).ToHashSet();
        var pagedChapters = pagedKeys.Select(k => k.ChapterNumber).Distinct().ToList();
        var pagedVerses = pagedKeys.Select(k => k.VerseNumber).Distinct().ToList();

        // IN(chapters) × IN(verses) is a cross-product, not composite key match —
        // client-side pagedKeySet filter below removes the false positives.
        // Acceptable because pageSize ≤ 50 bounds the over-fetch.
        var results = await (
            from ts in matchingSegments
            join v in db.Verses on new { ts.ChapterNumber, ts.VerseNumber } equals new { v.ChapterNumber, v.VerseNumber }
            join c in db.Chapters on ts.ChapterNumber equals c.ChapterNumber
            where pagedChapters.Contains(ts.ChapterNumber)
                && pagedVerses.Contains(ts.VerseNumber)
            orderby ts.ChapterNumber, ts.VerseNumber, ts.SegmentIndex
            select new { ts.ChapterNumber, c.TransliteratedName, ts.VerseNumber, v.ArabicText, ts.TranslationText, ts.Explanation, ts.SegmentIndex }
        ).ToListAsync();

        var dtos = results
            .Where(r => pagedKeySet.Contains((r.ChapterNumber, r.VerseNumber)))
            .GroupBy(r => (r.ChapterNumber, r.VerseNumber))
            .OrderBy(g => g.Key.ChapterNumber).ThenBy(g => g.Key.VerseNumber)
            .Select(g =>
            {
                var first = g.OrderBy(x => x.SegmentIndex).First();
                return new SearchResultDto(
                    first.ChapterNumber, first.TransliteratedName, first.VerseNumber,
                    first.ArabicText, first.TranslationText, first.Explanation);
            })
            .ToList();

        return new PagedResponse<SearchResultDto>(dtos, page, pageSize, totalCount);
    }

    // --- Private Helper ---

    private async Task<List<VerseDto>> MapVersesWithTranslationsAsync(
        List<Verse> verses, int? translationId)
    {
        if (!translationId.HasValue || verses.Count == 0)
            return verses.Select(v => v.ToDto()).ToList();

        var verseKeySet = verses.Select(v => (v.ChapterNumber, v.VerseNumber)).ToHashSet();
        var chapterNumbers = verses.Select(v => v.ChapterNumber).Distinct().ToList();

        var segments = await db.TranslationSegments
            .Where(ts => ts.TranslationId == translationId.Value
                && chapterNumbers.Contains(ts.ChapterNumber))
            .OrderBy(ts => ts.SegmentIndex)
            .ToListAsync();

        var segmentLookup = segments
            .Where(ts => verseKeySet.Contains((ts.ChapterNumber, ts.VerseNumber)))
            .GroupBy(ts => (ts.ChapterNumber, ts.VerseNumber))
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<TranslationSegmentDto>)g.Select(ts => ts.ToDto()).ToList());

        return verses.Select(v =>
            v.ToDto(segmentLookup.GetValueOrDefault((v.ChapterNumber, v.VerseNumber)))).ToList();
    }
}
