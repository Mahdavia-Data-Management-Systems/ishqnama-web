using Ishqnama.Application.Dtos;
using Ishqnama.Application.Services;
using Ishqnama.Domain.Entities;

namespace Ishqnama.Application.Tests;

public sealed class VerseListServiceTests
{
    private const string Owner = "owner-oid";
    private const string Other = "other-oid";

    private readonly InMemoryVerseListRepository _lists = new();
    private readonly InMemoryFavorites _favorites = new();
    private readonly VerseListService _service;

    public VerseListServiceTests() => _service = new VerseListService(_lists, _favorites);

    private Task<VerseListDto> CreateAsync(string title = "Verses to memorise")
        => _service.CreateAsync(Owner, "Noor Mahdi", title, null);

    private static VerseListGroupDto Group(int chapter, int from, int to, string? caption = null, string? id = null)
        => new(id, chapter, from, to, caption);

    // Creating

    [Fact]
    public async Task Create_starts_a_draft_with_a_12_character_id()
    {
        var list = await _service.CreateAsync(Owner, " Noor Mahdi ", "  Related to Mahdi ahs ", "  ");

        Assert.Equal(VerseListStatus.Draft, list.Status);
        Assert.True(VerseListService.IsListId(list.Id));
        Assert.Equal("Related to Mahdi ahs", list.Title);
        Assert.Null(list.Description);
        Assert.Equal("Noor Mahdi", list.OwnerName);
        Assert.True(list.IsMine);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Create_requires_a_title(string? title)
        => await Assert.ThrowsAsync<ArgumentException>(() => _service.CreateAsync(Owner, null, title, null));

    [Fact]
    public async Task Create_rejects_overlong_title_and_description()
    {
        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.CreateAsync(Owner, null, new string('a', 101), null));
        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.CreateAsync(Owner, null, "Title", new string('a', 1001)));
    }

    [Fact]
    public async Task Create_stops_at_the_list_limit()
    {
        for (var i = 0; i < VerseListService.MaxListsPerOwner; i++)
            await CreateAsync($"List {i}");

        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateAsync("One too many"));
    }

    // Groups

    [Fact]
    public async Task Groups_keep_their_order_and_get_ids()
    {
        var list = await CreateAsync();

        var updated = await _service.ReplaceGroupsAsync(Owner, null, list.Id,
        [
            Group(2, 255, 257, " Ayat al-Kursi "),
            Group(1, 1, 7),
        ]);

        Assert.Collection(updated.Groups,
            g => { Assert.Equal((2, 255, 257), (g.Chapter, g.FromVerse, g.ToVerse)); Assert.Equal("Ayat al-Kursi", g.Caption); },
            g => { Assert.Equal(1, g.Chapter); Assert.Null(g.Caption); });
        Assert.All(updated.Groups, g => Assert.Matches("^[A-Za-z0-9]{4}$", g.Id));
        Assert.NotEqual(updated.Groups[0].Id, updated.Groups[1].Id);
    }

    [Fact]
    public async Task Replacing_groups_keeps_existing_ids_and_replaces_duplicates()
    {
        var list = await CreateAsync();

        var updated = await _service.ReplaceGroupsAsync(Owner, null, list.Id,
            [Group(1, 1, 1, id: "abcd"), Group(1, 2, 2, id: "abcd")]);

        Assert.Equal("abcd", updated.Groups[0].Id);
        Assert.NotEqual("abcd", updated.Groups[1].Id);
    }

    [Theory]
    [InlineData(0, 1, 1)]     // no chapter 0
    [InlineData(115, 1, 1)]   // no chapter 115
    [InlineData(1, 0, 1)]     // verses start at 1
    [InlineData(1, 1, 8)]     // Al-Fatiha has 7 verses: a group cannot run into the next chapter
    [InlineData(2, 10, 5)]    // from after to
    public async Task Groups_must_be_a_range_within_one_chapter(int chapter, int from, int to)
    {
        var list = await CreateAsync();

        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.ReplaceGroupsAsync(Owner, null, list.Id, [Group(chapter, from, to)]));
    }

    [Fact]
    public async Task A_group_may_span_a_whole_chapter()
    {
        var list = await CreateAsync();

        var updated = await _service.AppendGroupAsync(Owner, null, list.Id, Group(2, 1, 286));

        Assert.Equal(286, updated.Groups.Single().ToVerse);
    }

    [Fact]
    public async Task Captions_are_limited()
    {
        var list = await CreateAsync();

        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.AppendGroupAsync(Owner, null, list.Id, Group(1, 1, 1, new string('a', 301))));
    }

    [Fact]
    public async Task A_list_holds_at_most_200_groups()
    {
        var list = await CreateAsync();
        var full = Enumerable.Range(1, VerseListService.MaxGroups).Select(_ => Group(1, 1, 1)).ToList();

        await _service.ReplaceGroupsAsync(Owner, null, list.Id, full);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _service.AppendGroupAsync(Owner, null, list.Id, Group(1, 1, 1)));
        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.ReplaceGroupsAsync(Owner, null, list.Id, [.. full, Group(1, 1, 1)]));
    }

    [Fact]
    public async Task Appending_adds_to_the_end()
    {
        var list = await CreateAsync();
        await _service.AppendGroupAsync(Owner, null, list.Id, Group(1, 1, 7));

        var updated = await _service.AppendGroupAsync(Owner, null, list.Id, Group(112, 1, 4));

        Assert.Equal([1, 112], updated.Groups.Select(g => g.Chapter));
    }

    // Ownership and visibility

    [Fact]
    public async Task Someone_else_cannot_see_or_change_my_list()
    {
        var list = await CreateAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetMineAsync(Other, list.Id));
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.UpdateDetailsAsync(Other, null, list.Id, "Mine now", null));
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.AppendGroupAsync(Other, null, list.Id, Group(1, 1, 1)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.DeleteAsync(Other, list.Id));
        Assert.True(_lists.Lists.ContainsKey(list.Id));
    }

    [Fact]
    public async Task A_draft_is_not_readable_by_its_link()
    {
        var list = await CreateAsync();

        Assert.Null(await _service.GetPublishedAsync(list.Id, null));
        Assert.Null(await _service.GetPublishedAsync(list.Id, Owner));
    }

    [Fact]
    public async Task A_published_list_is_readable_by_anyone_and_stays_editable()
    {
        var list = await CreateAsync();
        var published = await _service.SetPublishedAsync(Owner, null, list.Id, published: true);
        Assert.NotNull(published.PublishedAt);

        await _service.AppendGroupAsync(Owner, null, list.Id, Group(1, 1, 7));

        var anonymous = await _service.GetPublishedAsync(list.Id, null);
        Assert.NotNull(anonymous);
        Assert.False(anonymous.IsMine);
        Assert.Single(anonymous.Groups);
        Assert.True((await _service.GetPublishedAsync(list.Id, Owner))!.IsMine);
    }

    [Fact]
    public async Task Unpublishing_hides_the_link_and_republishing_keeps_the_first_publish_date()
    {
        var list = await CreateAsync();
        var first = await _service.SetPublishedAsync(Owner, null, list.Id, published: true);

        await _service.SetPublishedAsync(Owner, null, list.Id, published: false);
        Assert.Null(await _service.GetPublishedAsync(list.Id, null));

        var again = await _service.SetPublishedAsync(Owner, null, list.Id, published: true);
        Assert.Equal(first.PublishedAt, again.PublishedAt);
    }

    [Fact]
    public async Task Malformed_ids_are_not_found()
    {
        Assert.Null(await _service.GetPublishedAsync("../etc", null));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetMineAsync(Owner, "short"));
    }

    [Fact]
    public async Task Saving_refreshes_the_owner_name_but_a_missing_claim_keeps_it()
    {
        var list = await CreateAsync();

        var renamed = await _service.UpdateDetailsAsync(Owner, "Noor M.", list.Id, "Title", null);
        Assert.Equal("Noor M.", renamed.OwnerName);

        var noClaim = await _service.UpdateDetailsAsync(Owner, null, list.Id, "Title", null);
        Assert.Equal("Noor M.", noClaim.OwnerName);
    }

    [Fact]
    public async Task Summaries_skip_drafts_and_unknown_ids_and_keep_the_requested_order()
    {
        var a = await CreateAsync("A");
        var b = await CreateAsync("B");
        var draft = await CreateAsync("Draft");
        await _service.SetPublishedAsync(Owner, null, a.Id, true);
        await _service.SetPublishedAsync(Owner, null, b.Id, true);

        var summaries = await _service.GetPublishedSummariesAsync([b.Id, draft.Id, "Zzzzzzzzzzzz", a.Id, b.Id, "bad"]);

        Assert.Equal(["B", "A"], summaries.Select(s => s.Title));
    }

    [Fact]
    public async Task Summaries_are_limited_to_50_ids()
    {
        var ids = Enumerable.Range(0, 51).Select(i => $"abcdefgh{i:0000}");

        await Assert.ThrowsAsync<ArgumentException>(() => _service.GetPublishedSummariesAsync(ids));
    }

    // Copying

    [Fact]
    public async Task Copying_a_published_list_makes_a_draft_of_my_own()
    {
        var source = await _service.CreateAsync(Owner, "Noor Mahdi", "Verses to memorise", "For the month");
        await _service.ReplaceGroupsAsync(Owner, null, source.Id, [Group(1, 1, 7, "Al-Fatiha"), Group(2, 255, 255)]);
        await _service.SetPublishedAsync(Owner, null, source.Id, true);

        var copy = await _service.CopyPublishedAsync(Other, "A reader", source.Id);

        Assert.NotEqual(source.Id, copy.Id);
        Assert.Equal("draft", copy.Status);
        Assert.Null(copy.PublishedAt);
        Assert.True(copy.IsMine);
        Assert.Equal("A reader", copy.OwnerName);
        Assert.Equal("Copy of Verses to memorise", copy.Title);
        Assert.Equal("For the month", copy.Description);
        Assert.Equal(
            [(1, 1, 7, "Al-Fatiha"), (2, 255, 255, (string?)null)],
            copy.Groups.Select(g => (g.Chapter, g.FromVerse, g.ToVerse, g.Caption)));
        Assert.Single(await _service.GetMyListsAsync(Other));

        // Editing the copy leaves the original as it was
        await _service.ReplaceGroupsAsync(Other, null, copy.Id, [Group(3, 1, 5)]);
        Assert.Equal(2, (await _service.GetPublishedAsync(source.Id, null))!.Groups.Count);
    }

    [Fact]
    public async Task Only_published_lists_can_be_copied()
    {
        var draft = await CreateAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.CopyPublishedAsync(Other, null, draft.Id));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.CopyPublishedAsync(Other, null, "Zzzzzzzzzzzz"));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.CopyPublishedAsync(Other, null, "../etc"));
    }

    [Fact]
    public async Task Copying_a_list_with_a_full_length_title_keeps_the_copy_within_the_limit()
    {
        var title = new string('a', VerseListService.MaxTitleLength);
        var source = await _service.CreateAsync(Owner, null, title, null);
        await _service.SetPublishedAsync(Owner, null, source.Id, true);

        var copy = await _service.CopyPublishedAsync(Other, null, source.Id);

        Assert.Equal(VerseListService.MaxTitleLength, copy.Title.Length);
        Assert.StartsWith(VerseListService.CopyTitlePrefix, copy.Title);
    }

    [Fact]
    public async Task Copying_stops_at_the_list_limit()
    {
        var source = await CreateAsync();
        await _service.SetPublishedAsync(Owner, null, source.Id, true);
        for (var i = 0; i < VerseListService.MaxListsPerOwner; i++)
            await _service.CreateAsync(Other, null, $"List {i}", null);

        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.CopyPublishedAsync(Other, null, source.Id));
    }

    // Favourites

    [Fact]
    public async Task Favouriting_someone_elses_published_list_is_idempotent()
    {
        var list = await CreateAsync();
        await _service.SetPublishedAsync(Owner, null, list.Id, true);

        var first = await _service.SaveFavoriteAsync(Other, "list", list.Id);
        await _service.SaveFavoriteAsync(Other, "list", list.Id);

        Assert.Equal($"fav_list_{list.Id}", first.Id);
        Assert.Equal("Verses to memorise", first.Title);
        Assert.Single(await _service.GetFavoritesAsync(Other));
    }

    [Fact]
    public async Task Only_other_peoples_published_lists_can_be_favourited()
    {
        var list = await CreateAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.SaveFavoriteAsync(Other, "list", list.Id));

        await _service.SetPublishedAsync(Owner, null, list.Id, true);
        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.SaveFavoriteAsync(Owner, "list", list.Id));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.SaveFavoriteAsync(Other, "list", "Zzzzzzzzzzzz"));
    }

    [Fact]
    public async Task Unknown_favourite_kinds_are_rejected()
        => await Assert.ThrowsAsync<ArgumentException>(() => _service.SaveFavoriteAsync(Other, "chapter", "Zzzzzzzzzzzz"));

    [Fact]
    public async Task Removing_a_favourite_checks_its_id()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => _service.DeleteFavoriteAsync(Other, "settings"));
        await _service.DeleteFavoriteAsync(Other, "fav_list_Zzzzzzzzzzzz");
    }
}
