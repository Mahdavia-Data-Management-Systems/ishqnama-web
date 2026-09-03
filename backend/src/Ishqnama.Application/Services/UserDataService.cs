using System.Text.RegularExpressions;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed partial class UserDataService(IUserDataRepository repository)
{
    private static readonly Regex ValidSlugPattern =
        new(@"^[a-z0-9][a-z0-9_-]{0,98}[a-z0-9]$", RegexOptions.Compiled);
    private static readonly HashSet<string> AllowedIcons =
    [
        "bookmark", "heart", "moon", "home", "clock", "user", "check"
    ];

    // Settings
    public Task<UserSettingsDto?> GetSettingsAsync(string userId)
        => repository.GetSettingsAsync(userId);

    public Task SaveSettingsAsync(string userId, UserSettingsDto settings)
        => repository.SaveSettingsAsync(userId, settings);

    // Bookmarks
    public Task<IReadOnlyList<UserBookmarkDto>> GetBookmarksAsync(string userId)
        => repository.GetBookmarksAsync(userId);

    public async Task<UserBookmarkDto> CreateBookmarkAsync(string userId, string title, string icon)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        var trimmed = title.Trim();
        if (trimmed.Length > 50)
            throw new ArgumentException("Title must be 50 characters or less.", nameof(title));
        if (!AllowedIcons.Contains(icon))
            throw new ArgumentException($"Icon '{icon}' is not allowed.", nameof(icon));
        var existing = await repository.GetBookmarksAsync(userId);
        if (existing.Any(b => string.Equals(b.Title, trimmed, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"A bookmark named '{trimmed}' already exists.");

        return await repository.CreateBookmarkAsync(userId, trimmed, icon);
    }

    // Verse counts per chapter (index 0 = chapter 1)
    private static readonly int[] ChapterVerseCounts =
    [
        7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
        112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
        59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
        52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,
        21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
    ];

    public Task UpdateBookmarkPositionAsync(string userId, string slug, int chapterNumber, int verseNumber)
    {
        ValidateSlug(slug);
        ArgumentOutOfRangeException.ThrowIfLessThan(chapterNumber, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(chapterNumber, 114);
        ArgumentOutOfRangeException.ThrowIfLessThan(verseNumber, 0);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(verseNumber, ChapterVerseCounts[chapterNumber - 1]);
        return repository.UpdateBookmarkPositionAsync(userId, slug, chapterNumber, verseNumber);
    }

    public Task DeleteBookmarkAsync(string userId, string slug)
    {
        ValidateSlug(slug);
        if (slug == "nazra")
            throw new InvalidOperationException("The default 'Nazra' bookmark cannot be deleted.");
        return repository.DeleteBookmarkAsync(userId, slug);
    }

    private static void ValidateSlug(string slug)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        if (slug.Length > 100 || !ValidSlugPattern.IsMatch(slug))
            throw new ArgumentException("Invalid bookmark slug.", nameof(slug));
    }

    // Favorites
    public Task<IReadOnlyList<UserFavoriteDto>> GetFavoritesAsync(string userId)
        => repository.GetFavoritesAsync(userId);

    public Task AddFavoriteAsync(string userId, int chapterNumber, int verseNumber)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(chapterNumber, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(chapterNumber, 114);
        ArgumentOutOfRangeException.ThrowIfLessThan(verseNumber, 1);
        return repository.AddFavoriteAsync(userId, chapterNumber, verseNumber);
    }

    public Task RemoveFavoriteAsync(string userId, int chapterNumber, int verseNumber)
        => repository.RemoveFavoriteAsync(userId, chapterNumber, verseNumber);

    // History
    public Task<IReadOnlyList<UserHistoryDto>> GetHistoryAsync(string userId, int limit = 50)
    {
        limit = Math.Clamp(limit, 1, 200);
        return repository.GetHistoryAsync(userId, limit);
    }

    public Task AddHistoryEntryAsync(string userId, int chapterNumber)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(chapterNumber, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(chapterNumber, 114);
        return repository.AddHistoryEntryAsync(userId, chapterNumber);
    }
}
