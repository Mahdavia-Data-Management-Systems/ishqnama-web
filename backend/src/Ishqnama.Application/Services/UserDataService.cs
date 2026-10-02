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

    public Task UpdateBookmarkPositionAsync(string userId, string slug, int chapterNumber, int verseNumber)
    {
        ValidateSlug(slug);
        var verseCount = QuranShape.VerseCount(chapterNumber);
        ArgumentOutOfRangeException.ThrowIfLessThan(verseNumber, 0);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(verseNumber, verseCount);
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

    // History
    public Task<IReadOnlyList<UserHistoryDto>> GetHistoryAsync(string userId, int limit = 50)
    {
        limit = Math.Clamp(limit, 1, 200);
        return repository.GetHistoryAsync(userId, limit);
    }

    public Task AddHistoryEntryAsync(string userId, string title, string url)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        if (title.Length > 200)
            throw new ArgumentException("Title must be 200 characters or less.", nameof(title));
        ArgumentException.ThrowIfNullOrWhiteSpace(url);
        if (!url.StartsWith('/'))
            throw new ArgumentException("Url must start with '/'.", nameof(url));
        if (url.Length > 500)
            throw new ArgumentException("Url must be 500 characters or less.", nameof(url));
        return repository.AddHistoryEntryAsync(userId, title, url);
    }
}
