using Ishqnama.Application.Dtos;

namespace Ishqnama.Application.Interfaces;

public interface IUserDataRepository
{
    // Settings
    Task<UserSettingsDto?> GetSettingsAsync(string userId);
    Task SaveSettingsAsync(string userId, UserSettingsDto settings);

    // Bookmarks
    Task<IReadOnlyList<UserBookmarkDto>> GetBookmarksAsync(string userId);
    Task AddBookmarkAsync(string userId, int chapterNumber, int verseNumber);
    Task RemoveBookmarkAsync(string userId, int chapterNumber, int verseNumber);

    // Favorites
    Task<IReadOnlyList<UserFavoriteDto>> GetFavoritesAsync(string userId);
    Task AddFavoriteAsync(string userId, int chapterNumber, int verseNumber);
    Task RemoveFavoriteAsync(string userId, int chapterNumber, int verseNumber);

    // History
    Task<IReadOnlyList<UserHistoryDto>> GetHistoryAsync(string userId, int limit = 50);
    Task AddHistoryEntryAsync(string userId, int chapterNumber);
}
