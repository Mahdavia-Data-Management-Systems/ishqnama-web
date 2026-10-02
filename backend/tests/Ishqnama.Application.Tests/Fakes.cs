using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Domain.Entities;

namespace Ishqnama.Application.Tests;

internal sealed class InMemoryVerseListRepository : IVerseListRepository
{
    public Dictionary<string, VerseList> Lists { get; } = new(StringComparer.Ordinal);

    public Task<VerseList?> GetAsync(string id)
        => Task.FromResult(Lists.TryGetValue(id, out var list) ? Clone(list) : null);

    public Task<IReadOnlyList<VerseList>> GetManyAsync(IReadOnlyCollection<string> ids)
        => Task.FromResult<IReadOnlyList<VerseList>>(
            ids.Where(Lists.ContainsKey).Select(id => Clone(Lists[id])).ToList());

    public Task<IReadOnlyList<VerseList>> GetByOwnerAsync(string ownerId)
        => Task.FromResult<IReadOnlyList<VerseList>>(
            Lists.Values.Where(l => l.OwnerId == ownerId).OrderByDescending(l => l.UpdatedAt).Select(Clone).ToList());

    public Task<int> CountByOwnerAsync(string ownerId)
        => Task.FromResult(Lists.Values.Count(l => l.OwnerId == ownerId));

    public Task CreateAsync(VerseList list)
    {
        Lists.Add(list.Id, Clone(list));
        return Task.CompletedTask;
    }

    public Task<VerseList> UpdateAsync(string id, Action<VerseList> mutate)
    {
        if (!Lists.TryGetValue(id, out var stored))
            throw new KeyNotFoundException();
        var copy = Clone(stored);
        mutate(copy);
        Lists[id] = Clone(copy);
        return Task.FromResult(copy);
    }

    public Task DeleteAsync(string id)
    {
        Lists.Remove(id);
        return Task.CompletedTask;
    }

    private static VerseList Clone(VerseList l) => new()
    {
        Id = l.Id,
        OwnerId = l.OwnerId,
        OwnerName = l.OwnerName,
        Title = l.Title,
        Description = l.Description,
        Status = l.Status,
        CreatedAt = l.CreatedAt,
        UpdatedAt = l.UpdatedAt,
        PublishedAt = l.PublishedAt,
        Groups = l.Groups.Select(g => new VerseListGroup
        {
            Id = g.Id, Chapter = g.Chapter, FromVerse = g.FromVerse, ToVerse = g.ToVerse, Caption = g.Caption
        }).ToList(),
    };
}

internal sealed class InMemoryFavorites : IUserDataRepository
{
    public Dictionary<(string UserId, string Id), FavoriteDto> Favorites { get; } = [];

    public Task<IReadOnlyList<FavoriteDto>> GetFavoritesAsync(string userId)
        => Task.FromResult<IReadOnlyList<FavoriteDto>>(
            Favorites.Where(f => f.Key.UserId == userId).Select(f => f.Value).ToList());

    public Task<FavoriteDto> SaveFavoriteAsync(string userId, string id, string kind, string? listId, string title)
    {
        var dto = new FavoriteDto(id, kind, listId, title, DateTimeOffset.UtcNow);
        Favorites[(userId, id)] = dto;
        return Task.FromResult(dto);
    }

    public Task DeleteFavoriteAsync(string userId, string id)
    {
        Favorites.Remove((userId, id));
        return Task.CompletedTask;
    }

    // Not used by VerseListService
    public Task<UserSettingsDto?> GetSettingsAsync(string userId) => throw new NotSupportedException();
    public Task SaveSettingsAsync(string userId, UserSettingsDto settings) => throw new NotSupportedException();
    public Task<IReadOnlyList<UserBookmarkDto>> GetBookmarksAsync(string userId) => throw new NotSupportedException();
    public Task<UserBookmarkDto?> GetBookmarkAsync(string userId, string slug) => throw new NotSupportedException();
    public Task<UserBookmarkDto> CreateBookmarkAsync(string userId, string title, string icon) => throw new NotSupportedException();
    public Task UpdateBookmarkPositionAsync(string userId, string slug, int chapterNumber, int verseNumber) => throw new NotSupportedException();
    public Task DeleteBookmarkAsync(string userId, string slug) => throw new NotSupportedException();
    public Task<IReadOnlyList<UserHistoryDto>> GetHistoryAsync(string userId, int limit = 50) => throw new NotSupportedException();
    public Task AddHistoryEntryAsync(string userId, string title, string url) => throw new NotSupportedException();
}
