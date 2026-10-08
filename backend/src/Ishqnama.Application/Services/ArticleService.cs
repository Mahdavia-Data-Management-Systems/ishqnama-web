using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Ishqnama.Application.Services;

/// <summary>
/// The Noor e Imaan essays, embedded in this assembly as JSON by
/// <c>frontend/scripts/build_nooreimaan_articles.py</c>. Each is served verbatim, so the block
/// shape belongs to the converter and the frontend's <c>src/types/articles.ts</c>, not to C# types.
/// </summary>
/// <summary>An essay's JSON with its content ETag (a quoted strong ETag, <c>"a-&lt;16 hex&gt;"</c>).</summary>
public sealed record EssayResource(string Json, string ETag);

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

            _essays[slug] = new EssayResource(json, ComputeETag(json));
        }
    }

    public IReadOnlyCollection<string> NoorEImaanSlugs => _essays.Keys;

    /// <summary>The essay's JSON and content ETag, or null when no essay has that slug.</summary>
    public EssayResource? GetNoorEImaanEssay(string slug) => _essays.GetValueOrDefault(slug);

    private static string ComputeETag(string json)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return $"\"a-{Convert.ToHexStringLower(hash)[..16]}\"";
    }
}
