using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Ishqnama.Application.Services;

/// <summary>An essay's JSON with its content ETag (a quoted strong ETag, <c>"a-&lt;16 hex&gt;"</c>).</summary>
public sealed record EssayResource(string Json, string ETag);

/// <summary>
/// The Noor e Imaan essays, embedded in this assembly as JSON by
/// <c>frontend/scripts/build_nooreimaan_articles.py</c>. Each is served verbatim, so the block
/// shape belongs to the converter and the frontend's <c>src/types/articles.ts</c>, not to C# types.
/// </summary>
public sealed class ArticleService
{
    private const string Prefix = "Articles/NoorEImaan/";
    private const string Suffix = ".json";

    private readonly Dictionary<string, EssayResource> _essays = new(StringComparer.Ordinal);

    public ArticleService()
    {
        var assembly = typeof(ArticleService).Assembly;
        foreach (var name in assembly.GetManifestResourceNames())
        {
            if (!name.StartsWith(Prefix, StringComparison.Ordinal) || !name.EndsWith(Suffix, StringComparison.Ordinal))
                continue;

            var slug = name[Prefix.Length..^Suffix.Length];
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var reader = new StreamReader(stream);
            var json = reader.ReadToEnd();

            using var doc = JsonDocument.Parse(json);
            var declared = doc.RootElement.GetProperty("slug").GetString();
            if (declared != slug)
                throw new InvalidOperationException($"Essay resource '{name}' declares slug '{declared}'.");
            ValidateReflections(slug, doc.RootElement);

            _essays[slug] = new EssayResource(json, ComputeETag(json));
        }
    }

    public IReadOnlyCollection<string> NoorEImaanSlugs => _essays.Keys;

    /// <summary>The essay's JSON and content ETag, or null when no essay has that slug.</summary>
    public EssayResource? GetNoorEImaanEssay(string slug) => _essays.GetValueOrDefault(slug);

    /// <summary>
    /// A reflection's <c>url</c>: a released podcast timeline's path under the audio origin's
    /// <c>/podcasts/</c>, as <c>frontend/scripts/diarize_podcast.py</c> writes it.
    /// </summary>
    public static readonly Regex ReflectionUrl = new(
        @"^(?:[a-z0-9_-]+/)*[a-z0-9_-]+\.timeline\.v[1-9][0-9]*\.json$", RegexOptions.CultureInvariant);

    /// <summary>
    /// A reflection's <c>thumbnail.url</c>: shared art in <c>/podcasts/images/</c>, versioned because
    /// the bucket serves it as immutable, so recordings drawn alike reuse one cached file.
    /// </summary>
    public static readonly Regex ThumbnailUrl = new(
        @"^images/[a-z0-9_-]+\.v[1-9][0-9]*\.(?:png|webp|jpg)$", RegexOptions.CultureInvariant);

    private static readonly string[] ThumbnailAligns = ["left", "right", "center"];

    /// <summary>
    /// Checks an essay's <c>reflections</c>: present, an array (empty for an essay without
    /// recordings), each an object with a non-empty <c>title</c>, a <c>url</c> matching
    /// <see cref="ReflectionUrl"/>, <c>caption</c>/<c>description</c> strings when given, a
    /// non-negative <c>durationMs</c> number when given (the timeline's, copied at attach), and
    /// when given a <c>thumbnail</c> object with a <c>url</c> matching <see cref="ThumbnailUrl"/>,
    /// a non-empty <c>title</c> and an <c>align</c> of left, right or center.
    /// Throws naming the essay and the reflection, so a bad file fails the tests in CI (and, in the
    /// API, the first essay request, when this singleton is built).
    /// </summary>
    public static void ValidateReflections(string slug, JsonElement essay)
    {
        if (!essay.TryGetProperty("reflections", out var reflections) || reflections.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException($"Essay '{slug}' has no reflections array.");

        var index = 0;
        foreach (var reflection in reflections.EnumerateArray())
        {
            string? Problem()
            {
                if (reflection.ValueKind != JsonValueKind.Object)
                    return "is not an object";
                if (!reflection.TryGetProperty("title", out var title) || title.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(title.GetString()))
                    return "has no title";
                if (!reflection.TryGetProperty("url", out var url) || url.ValueKind != JsonValueKind.String || !ReflectionUrl.IsMatch(url.GetString()!))
                    return "has no url to a released timeline under /podcasts/";
                foreach (var optional in new[] { "caption", "description" })
                    if (reflection.TryGetProperty(optional, out var value) && value.ValueKind != JsonValueKind.String)
                        return $"has a {optional} that is not a string";
                if (reflection.TryGetProperty("durationMs", out var duration) && (duration.ValueKind != JsonValueKind.Number || duration.GetDouble() < 0))
                    return "has a durationMs that is not a non-negative number";
                if (reflection.TryGetProperty("thumbnail", out var thumbnail))
                {
                    if (thumbnail.ValueKind != JsonValueKind.Object)
                        return "has a thumbnail that is not an object";
                    if (!thumbnail.TryGetProperty("url", out var art) || art.ValueKind != JsonValueKind.String || !ThumbnailUrl.IsMatch(art.GetString()!))
                        return "has a thumbnail with no url to released art under /podcasts/images/";
                    if (!thumbnail.TryGetProperty("title", out var heading) || heading.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(heading.GetString()))
                        return "has a thumbnail with no title";
                    if (!thumbnail.TryGetProperty("align", out var align) || align.ValueKind != JsonValueKind.String || Array.IndexOf(ThumbnailAligns, align.GetString()) < 0)
                        return "has a thumbnail whose align is not left, right or center";
                }
                return null;
            }

            if (Problem() is { } problem)
                throw new InvalidOperationException($"Essay '{slug}' reflection {index} {problem}.");
            index++;
        }
    }

    private static string ComputeETag(string json)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return $"\"a-{Convert.ToHexStringLower(hash)[..16]}\"";
    }
}
