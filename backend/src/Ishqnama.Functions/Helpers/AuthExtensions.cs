using Ishqnama.Application.Dtos;
using Microsoft.AspNetCore.Http;

namespace Ishqnama.Functions.Helpers;

internal static class AuthExtensions
{
    public static bool IsAuthenticated(this HttpRequest request)
    {
        try
        {
            return request.HttpContext.Items.ContainsKey("IsAuthenticated");
        }
        catch (ObjectDisposedException)
        {
            // Client disconnected (e.g. navigation during logout) — treat as unauthenticated
            return false;
        }
    }

    public static VerseDto StripExplanations(this VerseDto verse)
        => verse.Translations is null
            ? verse
            : verse with
            {
                Translations = verse.Translations
                    .Select(t => t with { Explanation = null })
                    .ToList()
            };

    public static List<VerseDto> StripExplanations(this List<VerseDto> verses)
        => verses.Select(v => v.StripExplanations()).ToList();

    public static PagedResponse<VerseDto> StripExplanations(this PagedResponse<VerseDto> response)
        => response with
        {
            Items = response.Items.Select(v => v.StripExplanations()).ToList()
        };
}
