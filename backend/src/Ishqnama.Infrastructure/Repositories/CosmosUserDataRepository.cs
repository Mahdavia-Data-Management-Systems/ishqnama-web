using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Domain.Entities;
using Microsoft.Azure.Cosmos;

namespace Ishqnama.Infrastructure.Repositories;

public sealed partial class CosmosUserDataRepository(
    CosmosClient cosmosClient,
    string databaseName,
    string containerName) : IUserDataRepository
{
    private readonly Container _container = cosmosClient.GetContainer(databaseName, containerName);

    // Settings

    public async Task<UserSettingsDto?> GetSettingsAsync(string userId)
    {
        try
        {
            var response = await _container.ReadItemAsync<UserSettings>(
                "settings", new PartitionKey(userId));
            var s = response.Resource;
            return new UserSettingsDto(s.Mode, s.Lang, s.FontScale, s.ShowTafseer);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task SaveSettingsAsync(string userId, UserSettingsDto settings)
    {
        var doc = new UserSettings
        {
            Id = "settings",
            UserId = userId,
            Type = "settings",
            Mode = settings.Mode,
            Lang = settings.Lang,
            FontScale = settings.FontScale,
            ShowTafseer = settings.ShowTafseer
        };
        await _container.UpsertItemAsync(doc, new PartitionKey(userId));
    }

    // Bookmarks

    public async Task<IReadOnlyList<UserBookmarkDto>> GetBookmarksAsync(string userId)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.type = 'bookmark' ORDER BY c.isDefault DESC, c.createdAt DESC");

        var results = new List<UserBookmarkDto>();
        using var feed = _container.GetItemQueryIterator<UserBookmark>(query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });

        while (feed.HasMoreResults)
        {
            var page = await feed.ReadNextAsync();
            results.AddRange(page.Select(ToDto));
        }

        if (results.All(b => !b.IsDefault))
        {
            var nazra = await CreateDefaultBookmarkAsync(userId);
            results.Insert(0, nazra);
        }

        return results;
    }

    public async Task<UserBookmarkDto?> GetBookmarkAsync(string userId, string slug)
    {
        try
        {
            var response = await _container.ReadItemAsync<UserBookmark>(
                $"bookmark_{slug}", new PartitionKey(userId));
            return ToDto(response.Resource);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<UserBookmarkDto> CreateBookmarkAsync(string userId, string title, string icon)
    {
        var slug = GenerateSlug(title);
        var now = DateTimeOffset.UtcNow;
        var doc = new UserBookmark
        {
            Id = $"bookmark_{slug}",
            UserId = userId,
            Type = "bookmark",
            Slug = slug,
            Title = title,
            Icon = icon,
            ChapterNumber = 1,
            VerseNumber = 0,
            IsDefault = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        await _container.CreateItemAsync(doc, new PartitionKey(userId));
        return ToDto(doc);
    }

    public async Task UpdateBookmarkPositionAsync(string userId, string slug, int chapterNumber, int verseNumber)
    {
        var pk = new PartitionKey(userId);
        try
        {
            var response = await _container.ReadItemAsync<UserBookmark>(
                $"bookmark_{slug}", pk);
            var doc = response.Resource;
            doc.ChapterNumber = chapterNumber;
            doc.VerseNumber = verseNumber;
            doc.UpdatedAt = DateTimeOffset.UtcNow;
            await _container.ReplaceItemAsync(doc, doc.Id, pk);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            throw new KeyNotFoundException($"Bookmark '{slug}' not found.");
        }
    }

    public async Task DeleteBookmarkAsync(string userId, string slug)
    {
        try
        {
            await _container.DeleteItemAsync<UserBookmark>(
                $"bookmark_{slug}", new PartitionKey(userId));
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            // Already deleted — no-op
        }
    }

    private async Task<UserBookmarkDto> CreateDefaultBookmarkAsync(string userId)
    {
        var now = DateTimeOffset.UtcNow;
        var doc = new UserBookmark
        {
            Id = "bookmark_nazra",
            UserId = userId,
            Type = "bookmark",
            Slug = "nazra",
            Title = "Nazra",
            Icon = "book",
            ChapterNumber = 1,
            VerseNumber = 0,
            IsDefault = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        try
        {
            await _container.CreateItemAsync(doc, new PartitionKey(userId));
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.Conflict)
        {
            // Race condition — another request created it concurrently
        }
        return ToDto(doc);
    }

    private static UserBookmarkDto ToDto(UserBookmark b) =>
        new(b.Slug, b.Title, b.Icon, b.ChapterNumber, b.VerseNumber, b.IsDefault, b.CreatedAt, b.UpdatedAt);

    private static string GenerateSlug(string title)
    {
        var slug = title.ToLowerInvariant().Trim();
        slug = SlugInvalidCharsRegex.Replace(slug, "");
        slug = SlugWhitespaceRegex.Replace(slug, "-");
        slug = slug.Trim('-');
        if (slug.Length == 0)
            slug = "bookmark";
        if (slug.Length > 40)
            slug = slug[..40].TrimEnd('-');
        // Append timestamp suffix for uniqueness
        slug = $"{slug}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture)}";
        return slug;
    }

    private static readonly Regex SlugInvalidCharsRegex = new(@"[^\w\s-]", RegexOptions.Compiled);
    private static readonly Regex SlugWhitespaceRegex = new(@"\s+", RegexOptions.Compiled);

    // History

    public async Task<IReadOnlyList<UserHistoryDto>> GetHistoryAsync(string userId, int limit = 50)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.type = 'history' ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit")
            .WithParameter("@limit", limit);

        var results = new List<UserHistoryDto>();
        using var feed = _container.GetItemQueryIterator<UserHistoryEntry>(query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });

        while (feed.HasMoreResults)
        {
            var page = await feed.ReadNextAsync();
            results.AddRange(page.Select(h => new UserHistoryDto(h.Title, h.Url, h.Timestamp)));
        }

        return results;
    }

    public async Task AddHistoryEntryAsync(string userId, string title, string url)
    {
        var now = DateTimeOffset.UtcNow;
        var doc = new UserHistoryEntry
        {
            Id = $"history_{now.ToUnixTimeMilliseconds()}",
            UserId = userId,
            Type = "history",
            Title = title,
            Url = url,
            Timestamp = now
        };
        await _container.UpsertItemAsync(doc, new PartitionKey(userId));
    }
}
