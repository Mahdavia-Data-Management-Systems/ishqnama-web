using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class UserDataService(IUserDataRepository repository)
{
    private static readonly HashSet<string> AllowedIcons =
    [
        "book", "bookmark", "heart", "moon", "home", "clock", "user", "check"
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
        if (title.Length > 50)
            throw new ArgumentException("Title must be 50 characters or less.", nameof(title));
        if (!AllowedIcons.Contains(icon))
            throw new ArgumentException($"Icon '{icon}' is not allowed.", nameof(icon));

        var trimmed = title.Trim();
        var existing = await repository.GetBookmarksAsync(userId);
        if (existing.Any(b => string.Equals(b.Title, trimmed, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException($"A bookmark named '{trimmed}' already exists.");

        return await repository.CreateBookmarkAsync(userId, trimmed, icon);
    }

    public Task UpdateBookmarkPositionAsync(string userId, string slug, int chapterNumber, int verseNumber)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        ArgumentOutOfRangeException.ThrowIfLessThan(chapterNumber, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(chapterNumber, 114);
        ArgumentOutOfRangeException.ThrowIfLessThan(verseNumber, 0);
        return repository.UpdateBookmarkPositionAsync(userId, slug, chapterNumber, verseNumber);
    }

    public Task DeleteBookmarkAsync(string userId, string slug)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);
        if (slug == "nazra")
            throw new InvalidOperationException("The default 'Nazra' bookmark cannot be deleted.");
        return repository.DeleteBookmarkAsync(userId, slug);
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
