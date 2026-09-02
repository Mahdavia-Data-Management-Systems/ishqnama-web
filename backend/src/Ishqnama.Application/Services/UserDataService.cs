using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class UserDataService(IUserDataRepository repository)
{
    // Settings
    public Task<UserSettingsDto?> GetSettingsAsync(string userId)
        => repository.GetSettingsAsync(userId);

    public Task SaveSettingsAsync(string userId, UserSettingsDto settings)
        => repository.SaveSettingsAsync(userId, settings);

    // Bookmarks
    public Task<IReadOnlyList<UserBookmarkDto>> GetBookmarksAsync(string userId)
        => repository.GetBookmarksAsync(userId);

    public Task AddBookmarkAsync(string userId, int chapterNumber, int verseNumber)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(chapterNumber, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(chapterNumber, 114);
        ArgumentOutOfRangeException.ThrowIfLessThan(verseNumber, 1);
        return repository.AddBookmarkAsync(userId, chapterNumber, verseNumber);
    }

    public Task RemoveBookmarkAsync(string userId, int chapterNumber, int verseNumber)
        => repository.RemoveBookmarkAsync(userId, chapterNumber, verseNumber);

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
