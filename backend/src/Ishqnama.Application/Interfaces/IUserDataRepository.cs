using Ishqnama.Application.Dtos;

namespace Ishqnama.Application.Interfaces;

public interface IUserDataRepository
{
    // Settings
    Task<UserSettingsDto?> GetSettingsAsync(string userId);
    Task SaveSettingsAsync(string userId, UserSettingsDto settings);

    // Bookmarks
    Task<IReadOnlyList<UserBookmarkDto>> GetBookmarksAsync(string userId);
    Task<UserBookmarkDto?> GetBookmarkAsync(string userId, string slug);
    Task<UserBookmarkDto> CreateBookmarkAsync(string userId, string title, string icon);
    Task UpdateBookmarkPositionAsync(string userId, string slug, int chapterNumber, int verseNumber);
    Task DeleteBookmarkAsync(string userId, string slug);

    // History
    Task<IReadOnlyList<UserHistoryDto>> GetHistoryAsync(string userId, int limit = 50);
    Task AddHistoryEntryAsync(string userId, int chapterNumber);
}
