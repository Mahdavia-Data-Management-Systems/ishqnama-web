using System.Text.Json;
using Ishqnama.Application.Services;

namespace Ishqnama.Application.Tests;

public sealed class ArticleServiceTests
{
    private readonly ArticleService _service = new();

    [Fact]
    public void Embeds_all_twenty_two_essays()
        => Assert.Equal(22, _service.NoorEImaanSlugs.Count);

    [Fact]
    public void Returns_an_essay_by_its_slug()
    {
        var essay = _service.GetNoorEImaanEssay("naskh");

        Assert.NotNull(essay);
        using var doc = JsonDocument.Parse(essay!.Json);
        Assert.Equal("naskh", doc.RootElement.GetProperty("slug").GetString());
        Assert.Equal("نسخ", doc.RootElement.GetProperty("urduTitle").GetString());
        Assert.True(doc.RootElement.GetProperty("blocks").GetArrayLength() > 0);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("NASKH")]
    [InlineData("../naskh")]
    [InlineData("")]
    public void Unknown_slugs_are_not_found(string slug)
        => Assert.Null(_service.GetNoorEImaanEssay(slug));

    [Fact]
    public void Every_essay_has_a_quoted_strong_content_etag()
    {
        foreach (var slug in _service.NoorEImaanSlugs)
            Assert.Matches("^\"a-[0-9a-f]{16}\"$", _service.GetNoorEImaanEssay(slug)!.ETag);
    }

    [Fact]
    public void Different_essays_have_different_etags()
        => Assert.NotEqual(
            _service.GetNoorEImaanEssay("naskh")!.ETag,
            _service.GetNoorEImaanEssay(_service.NoorEImaanSlugs.First(s => s != "naskh"))!.ETag);

    [Fact]
    public void An_essays_etag_is_stable_across_instances()
        => Assert.Equal(
            _service.GetNoorEImaanEssay("naskh")!.ETag,
            new ArticleService().GetNoorEImaanEssay("naskh")!.ETag);
}
