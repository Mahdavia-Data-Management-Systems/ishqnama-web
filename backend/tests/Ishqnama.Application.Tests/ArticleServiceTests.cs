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
        var json = _service.GetNoorEImaanEssay("naskh");

        Assert.NotNull(json);
        using var doc = JsonDocument.Parse(json!);
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
}
