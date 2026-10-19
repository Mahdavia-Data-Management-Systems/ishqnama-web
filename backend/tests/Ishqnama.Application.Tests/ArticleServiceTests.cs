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

    [Fact]
    public void Every_essay_has_a_reflections_array()
    {
        foreach (var slug in _service.NoorEImaanSlugs)
        {
            using var doc = JsonDocument.Parse(_service.GetNoorEImaanEssay(slug)!.Json);
            Assert.Equal(JsonValueKind.Array, doc.RootElement.GetProperty("reflections").ValueKind);
        }
    }

    // A reflection can only point at a recording that was released into the repo's audio/podcasts/,
    // the folder sync-audio.yml copies to the bucket under /podcasts/.
    [Fact]
    public void Every_reflection_names_a_released_timeline_and_its_recording()
    {
        var podcasts = Path.Combine(RepoRoot(), "audio", "podcasts");
        foreach (var slug in _service.NoorEImaanSlugs)
        {
            using var doc = JsonDocument.Parse(_service.GetNoorEImaanEssay(slug)!.Json);
            foreach (var reflection in doc.RootElement.GetProperty("reflections").EnumerateArray())
            {
                var timelinePath = Path.Combine(podcasts, reflection.GetProperty("url").GetString()!);
                Assert.True(File.Exists(timelinePath), $"{slug}: {timelinePath} is not released");
                using var timeline = JsonDocument.Parse(File.ReadAllText(timelinePath));
                var audio = Path.Combine(Path.GetDirectoryName(timelinePath)!, timeline.RootElement.GetProperty("audio").GetString()!);
                Assert.True(File.Exists(audio), $"{slug}: {audio} is not released beside its timeline");
                if (reflection.TryGetProperty("durationMs", out var duration))
                    Assert.Equal(timeline.RootElement.GetProperty("durationMs").GetDouble(), duration.GetDouble());
                if (reflection.TryGetProperty("thumbnail", out var thumbnail))
                {
                    var art = Path.Combine(podcasts, thumbnail.GetProperty("url").GetString()!);
                    Assert.True(File.Exists(art), $"{slug}: {art} is not released");
                    Assert.Equal(Path.GetDirectoryName(timelinePath), Path.GetDirectoryName(art));
                }
            }
        }
    }

    [Theory]
    [InlineData("""{"reflections": []}""")]
    [InlineData("""{"reflections": [{"title": "نسخ", "url": "articles/nooreimaan/naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "caption": "c", "description": "d", "url": "talks/sabr_brief.timeline.v12.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": {"url": "articles/nooreimaan/naskh/naskh.thumbnail.v1.png", "title": "Kya Quran mein *Naskh* hai?", "align": "right"}, "url": "articles/nooreimaan/naskh/naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "durationMs": 96896, "thumbnail": {"url": "naskh.thumbnail.v3.webp", "title": "Naskh", "align": "center"}, "url": "naskh.timeline.v1.json"}]}""")]
    public void Sound_reflections_pass(string json)
    {
        using var doc = JsonDocument.Parse(json);
        ArticleService.ValidateReflections("naskh", doc.RootElement);
    }

    [Theory]
    [InlineData("""{}""")]
    [InlineData("""{"reflections": {}}""")]
    [InlineData("""{"reflections": ["articles/nooreimaan/naskh.timeline.v1.json"]}""")]
    [InlineData("""{"reflections": [{"url": "articles/nooreimaan/naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": " ", "url": "articles/nooreimaan/naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "url": "https://audio.ishqnama.com/podcasts/naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "url": "articles/nooreimaan/naskh.v1.m4a"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "url": "../naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "url": "naskh.timeline.v0.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "caption": 3, "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "durationMs": "96896", "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "durationMs": -1, "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": "naskh.thumbnail.v1.png", "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": {"title": "Naskh", "align": "left"}, "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": {"url": "naskh.v1.m4a", "title": "Naskh", "align": "left"}, "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": {"url": "../naskh.thumbnail.v1.png", "title": "Naskh", "align": "left"}, "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": {"url": "naskh.thumbnail.v1.png", "title": " ", "align": "left"}, "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": {"url": "naskh.thumbnail.v1.png", "title": "Naskh"}, "url": "naskh.timeline.v1.json"}]}""")]
    [InlineData("""{"reflections": [{"title": "t", "thumbnail": {"url": "naskh.thumbnail.v1.png", "title": "Naskh", "align": "top"}, "url": "naskh.timeline.v1.json"}]}""")]
    public void Unsound_reflections_fail_naming_the_essay(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var error = Assert.Throws<InvalidOperationException>(() => ArticleService.ValidateReflections("naskh", doc.RootElement));
        Assert.Contains("'naskh'", error.Message);
    }

    private static string RepoRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (Directory.Exists(Path.Combine(dir.FullName, "audio", "podcasts")))
                return dir.FullName;
        throw new InvalidOperationException("No audio/podcasts folder above the test assembly.");
    }
}
