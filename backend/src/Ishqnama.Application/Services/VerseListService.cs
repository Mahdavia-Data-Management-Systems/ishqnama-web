using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Domain.Entities;

namespace Ishqnama.Application.Services;

/// <summary>
/// Verse lists and favourites. Validation lives here: endpoints map
/// <see cref="ArgumentException"/> to 400, <see cref="InvalidOperationException"/> to 409 and
/// <see cref="KeyNotFoundException"/> to 404. A list the caller may not see is reported as not
/// found, so the API never reveals that someone else's draft exists.
/// </summary>
public sealed partial class VerseListService(IVerseListRepository lists, IUserDataRepository userData)
{
    public const int MaxTitleLength = 100;
    public const int MaxDescriptionLength = 1000;
    public const int MaxCaptionLength = 300;
    public const int MaxGroups = 200;
    public const int MaxListsPerOwner = 100;
    public const int MaxOwnerNameLength = 100;
    public const int MaxBatchIds = 50;
    public const string ListKind = "list";

    private const string Base62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private const int ListIdLength = 12;
    private const int GroupIdLength = 4;

    [GeneratedRegex("^[A-Za-z0-9]{12}$")]
    private static partial Regex ListIdPattern();

    [GeneratedRegex("^[A-Za-z0-9]{4}$")]
    private static partial Regex GroupIdPattern();

    [GeneratedRegex("^fav_[a-z]+_[A-Za-z0-9_]{1,40}$")]
    private static partial Regex FavoriteIdPattern();

    public static bool IsListId(string? id) => id is not null && ListIdPattern().IsMatch(id);

    public static string ListFavoriteId(string listId) => $"fav_{ListKind}_{listId}";

    // Owner

    public async Task<IReadOnlyList<VerseListSummaryDto>> GetMyListsAsync(string ownerId)
        => (await lists.GetByOwnerAsync(ownerId)).Select(ToSummary).ToList();

    public async Task<VerseListDto> CreateAsync(string ownerId, string? ownerName, string? title, string? description)
    {
        var now = DateTimeOffset.UtcNow;
        var list = new VerseList
        {
            Id = NewId(ListIdLength),
            OwnerId = ownerId,
            OwnerName = CleanOwnerName(ownerName),
            Title = CleanTitle(title),
            Description = CleanOptional(description, MaxDescriptionLength, "Description"),
            Status = VerseListStatus.Draft,
            CreatedAt = now,
            UpdatedAt = now,
        };

        if (await lists.CountByOwnerAsync(ownerId) >= MaxListsPerOwner)
            throw new InvalidOperationException($"You can keep up to {MaxListsPerOwner} lists.");

        await lists.CreateAsync(list);
        return ToDto(list, ownerId);
    }

    /// <summary>
    /// A new draft owned by the caller with a published list's title, description and groups, so
    /// a reader can build on someone else's collection. The source is left untouched.
    /// </summary>
    public async Task<VerseListDto> CopyPublishedAsync(string ownerId, string? ownerName, string sourceId)
    {
        if (!IsListId(sourceId))
            throw new KeyNotFoundException("List not found.");
        var source = await lists.GetAsync(sourceId);
        if (source is not { Status: VerseListStatus.Published })
            throw new KeyNotFoundException("List not found.");

        if (await lists.CountByOwnerAsync(ownerId) >= MaxListsPerOwner)
            throw new InvalidOperationException($"You can keep up to {MaxListsPerOwner} lists.");

        var now = DateTimeOffset.UtcNow;
        var copy = new VerseList
        {
            Id = NewId(ListIdLength),
            OwnerId = ownerId,
            OwnerName = CleanOwnerName(ownerName),
            Title = source.Title,
            Description = source.Description,
            Status = VerseListStatus.Draft,
            Groups = source.Groups.Select(g => new VerseListGroup
            {
                Id = g.Id,
                Chapter = g.Chapter,
                FromVerse = g.FromVerse,
                ToVerse = g.ToVerse,
                Caption = g.Caption,
            }).ToList(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        await lists.CreateAsync(copy);
        return ToDto(copy, ownerId);
    }

    public async Task<VerseListDto> GetMineAsync(string ownerId, string id)
        => ToDto(await GetOwnedAsync(ownerId, id), ownerId);

    public Task<VerseListDto> UpdateDetailsAsync(
        string ownerId, string? ownerName, string id, string? title, string? description)
    {
        var cleanTitle = CleanTitle(title);
        var cleanDescription = CleanOptional(description, MaxDescriptionLength, "Description");
        return MutateOwnedAsync(ownerId, ownerName, id, list =>
        {
            list.Title = cleanTitle;
            list.Description = cleanDescription;
        });
    }

    /// <summary>Replaces every group: the editor's adds, removals, reordering and captions in one write.</summary>
    public Task<VerseListDto> ReplaceGroupsAsync(
        string ownerId, string? ownerName, string id, IReadOnlyList<VerseListGroupDto>? groups)
    {
        if (groups is null)
            throw new ArgumentException("Groups are required.", nameof(groups));
        if (groups.Count > MaxGroups)
            throw new ArgumentException($"A list can hold up to {MaxGroups} groups.", nameof(groups));

        var usedIds = new HashSet<string>(StringComparer.Ordinal);
        var cleaned = groups.Select(g => CleanGroup(g, usedIds)).ToList();
        return MutateOwnedAsync(ownerId, ownerName, id, list => list.Groups = cleaned);
    }

    /// <summary>Adds one group at the end, without the caller having to load the list first.</summary>
    public Task<VerseListDto> AppendGroupAsync(
        string ownerId, string? ownerName, string id, VerseListGroupDto? group)
    {
        if (group is null)
            throw new ArgumentException("A group is required.", nameof(group));
        var cleaned = CleanGroup(group with { Id = null }, new HashSet<string>(StringComparer.Ordinal));
        return MutateOwnedAsync(ownerId, ownerName, id, list =>
        {
            if (list.Groups.Count >= MaxGroups)
                throw new InvalidOperationException($"A list can hold up to {MaxGroups} groups.");
            var usedIds = list.Groups.Select(g => g.Id).ToHashSet(StringComparer.Ordinal);
            while (usedIds.Contains(cleaned.Id))
                cleaned.Id = NewId(GroupIdLength);
            list.Groups.Add(cleaned);
        });
    }

    public Task<VerseListDto> SetPublishedAsync(string ownerId, string? ownerName, string id, bool published)
        => MutateOwnedAsync(ownerId, ownerName, id, list =>
        {
            list.Status = published ? VerseListStatus.Published : VerseListStatus.Draft;
            if (published)
                list.PublishedAt ??= DateTimeOffset.UtcNow;
        });

    public async Task DeleteAsync(string ownerId, string id)
    {
        await GetOwnedAsync(ownerId, id);
        await lists.DeleteAsync(id);
    }

    // Public

    /// <summary>A published list, or null for a draft, a missing list or a malformed id.</summary>
    public async Task<VerseListDto?> GetPublishedAsync(string id, string? viewerId)
    {
        if (!IsListId(id))
            return null;
        var list = await lists.GetAsync(id);
        return list is { Status: VerseListStatus.Published } ? ToDto(list, viewerId) : null;
    }

    /// <summary>Summaries of the published lists among <paramref name="ids"/>, in the order asked for.</summary>
    public async Task<IReadOnlyList<VerseListSummaryDto>> GetPublishedSummariesAsync(IEnumerable<string> ids)
    {
        var wanted = ids.Where(IsListId).Distinct(StringComparer.Ordinal).ToList();
        if (wanted.Count > MaxBatchIds)
            throw new ArgumentException($"Ask for up to {MaxBatchIds} lists at a time.", nameof(ids));
        if (wanted.Count == 0)
            return [];

        var found = (await lists.GetManyAsync(wanted))
            .Where(l => l.Status == VerseListStatus.Published)
            .ToDictionary(l => l.Id, StringComparer.Ordinal);
        return wanted.Where(found.ContainsKey).Select(id => ToSummary(found[id])).ToList();
    }

    // Favourites

    public Task<IReadOnlyList<FavoriteDto>> GetFavoritesAsync(string userId)
        => userData.GetFavoritesAsync(userId);

    public async Task<FavoriteDto> SaveFavoriteAsync(string userId, string? kind, string? listId)
    {
        if (kind != ListKind)
            throw new ArgumentException($"Favourites of kind '{kind}' are not supported.", nameof(kind));
        if (!IsListId(listId))
            throw new KeyNotFoundException("List not found.");

        var list = await lists.GetAsync(listId!);
        if (list is not { Status: VerseListStatus.Published })
            throw new KeyNotFoundException("List not found.");
        if (list.OwnerId == userId)
            throw new InvalidOperationException("Your own lists are already in your collection.");

        return await userData.SaveFavoriteAsync(userId, ListFavoriteId(list.Id), ListKind, list.Id, list.Title);
    }

    public Task DeleteFavoriteAsync(string userId, string id)
    {
        if (!FavoriteIdPattern().IsMatch(id))
            throw new ArgumentException("Invalid favourite id.", nameof(id));
        return userData.DeleteFavoriteAsync(userId, id);
    }

    // Helpers

    private async Task<VerseList> GetOwnedAsync(string ownerId, string id)
    {
        if (!IsListId(id))
            throw new KeyNotFoundException("List not found.");
        var list = await lists.GetAsync(id);
        if (list is null || list.OwnerId != ownerId)
            throw new KeyNotFoundException("List not found.");
        return list;
    }

    private async Task<VerseListDto> MutateOwnedAsync(
        string ownerId, string? ownerName, string id, Action<VerseList> mutate)
    {
        if (!IsListId(id))
            throw new KeyNotFoundException("List not found.");
        var cleanName = CleanOwnerName(ownerName);
        var updated = await lists.UpdateAsync(id, list =>
        {
            if (list.OwnerId != ownerId)
                throw new KeyNotFoundException("List not found.");
            mutate(list);
            // The account name is refreshed on every save, so a change of name carries through
            if (cleanName.Length > 0)
                list.OwnerName = cleanName;
            list.UpdatedAt = DateTimeOffset.UtcNow;
        });
        return ToDto(updated, ownerId);
    }

    private static VerseListGroup CleanGroup(VerseListGroupDto group, HashSet<string> usedIds)
    {
        if (!QuranShape.IsChapter(group.Chapter))
            throw new ArgumentException($"Chapter {group.Chapter} does not exist.", nameof(group));
        var verseCount = QuranShape.VerseCount(group.Chapter);
        if (group.FromVerse < 1 || group.ToVerse > verseCount || group.FromVerse > group.ToVerse)
            throw new ArgumentException(
                $"Verses {group.FromVerse} to {group.ToVerse} are not a range within chapter {group.Chapter} (1 to {verseCount}).",
                nameof(group));

        var id = group.Id is { } given && GroupIdPattern().IsMatch(given) ? given : NewId(GroupIdLength);
        while (!usedIds.Add(id))
            id = NewId(GroupIdLength);

        return new VerseListGroup
        {
            Id = id,
            Chapter = group.Chapter,
            FromVerse = group.FromVerse,
            ToVerse = group.ToVerse,
            Caption = CleanOptional(group.Caption, MaxCaptionLength, "Caption"),
        };
    }

    private static string CleanTitle(string? title)
    {
        var trimmed = title?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new ArgumentException("A title is required.", nameof(title));
        if (trimmed.Length > MaxTitleLength)
            throw new ArgumentException($"Title must be {MaxTitleLength} characters or less.", nameof(title));
        return trimmed;
    }

    private static string? CleanOptional(string? value, int maxLength, string name)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return null;
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{name} must be {maxLength} characters or less.", name.ToLowerInvariant());
        return trimmed;
    }

    private static string CleanOwnerName(string? name)
    {
        var trimmed = name?.Trim() ?? "";
        return trimmed.Length > MaxOwnerNameLength ? trimmed[..MaxOwnerNameLength] : trimmed;
    }

    private static string NewId(int length) => RandomNumberGenerator.GetString(Base62, length);

    private static VerseListDto ToDto(VerseList list, string? viewerId) => new(
        list.Id,
        list.Title,
        list.Description,
        list.OwnerName,
        list.Status,
        viewerId is not null && list.OwnerId == viewerId,
        list.Groups.Select(g => new VerseListGroupDto(g.Id, g.Chapter, g.FromVerse, g.ToVerse, g.Caption)).ToList(),
        list.CreatedAt,
        list.UpdatedAt,
        list.PublishedAt);

    private static VerseListSummaryDto ToSummary(VerseList list) => new(
        list.Id, list.Title, list.Description, list.OwnerName, list.Status, list.Groups.Count, list.UpdatedAt);
}
