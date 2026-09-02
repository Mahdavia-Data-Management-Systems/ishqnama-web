using System.Net;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Domain.Entities;
using Microsoft.Azure.Cosmos;

namespace Ishqnama.Infrastructure.Repositories;

public sealed class CosmosUserDataRepository(
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
            "SELECT * FROM c WHERE c.type = 'bookmark' ORDER BY c.createdAt DESC");

        var results = new List<UserBookmarkDto>();
        using var feed = _container.GetItemQueryIterator<UserBookmark>(query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });

        while (feed.HasMoreResults)
        {
            var page = await feed.ReadNextAsync();
            results.AddRange(page.Select(b => new UserBookmarkDto(b.ChapterNumber, b.VerseNumber, b.CreatedAt)));
        }

        return results;
    }

    public async Task AddBookmarkAsync(string userId, int chapterNumber, int verseNumber)
    {
        var doc = new UserBookmark
        {
            Id = $"bookmark_{chapterNumber}_{verseNumber}",
            UserId = userId,
            Type = "bookmark",
            ChapterNumber = chapterNumber,
            VerseNumber = verseNumber,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _container.UpsertItemAsync(doc, new PartitionKey(userId));
    }

    public async Task RemoveBookmarkAsync(string userId, int chapterNumber, int verseNumber)
    {
        try
        {
            await _container.DeleteItemAsync<UserBookmark>(
                $"bookmark_{chapterNumber}_{verseNumber}", new PartitionKey(userId));
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            // Already deleted — no-op
        }
    }

    // Favorites

    public async Task<IReadOnlyList<UserFavoriteDto>> GetFavoritesAsync(string userId)
    {
        var query = new QueryDefinition(
            "SELECT * FROM c WHERE c.type = 'favorite' ORDER BY c.createdAt DESC");

        var results = new List<UserFavoriteDto>();
        using var feed = _container.GetItemQueryIterator<UserFavorite>(query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });

        while (feed.HasMoreResults)
        {
            var page = await feed.ReadNextAsync();
            results.AddRange(page.Select(f => new UserFavoriteDto(f.ChapterNumber, f.VerseNumber, f.CreatedAt)));
        }

        return results;
    }

    public async Task AddFavoriteAsync(string userId, int chapterNumber, int verseNumber)
    {
        var doc = new UserFavorite
        {
            Id = $"favorite_{chapterNumber}_{verseNumber}",
            UserId = userId,
            Type = "favorite",
            ChapterNumber = chapterNumber,
            VerseNumber = verseNumber,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await _container.UpsertItemAsync(doc, new PartitionKey(userId));
    }

    public async Task RemoveFavoriteAsync(string userId, int chapterNumber, int verseNumber)
    {
        try
        {
            await _container.DeleteItemAsync<UserFavorite>(
                $"favorite_{chapterNumber}_{verseNumber}", new PartitionKey(userId));
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            // Already deleted — no-op
        }
    }

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
            results.AddRange(page.Select(h => new UserHistoryDto(h.ChapterNumber, h.Timestamp)));
        }

        return results;
    }

    public async Task AddHistoryEntryAsync(string userId, int chapterNumber)
    {
        var now = DateTimeOffset.UtcNow;
        var doc = new UserHistoryEntry
        {
            Id = $"history_{now.ToUnixTimeMilliseconds()}",
            UserId = userId,
            Type = "history",
            ChapterNumber = chapterNumber,
            Timestamp = now
        };
        await _container.UpsertItemAsync(doc, new PartitionKey(userId));
    }
}
