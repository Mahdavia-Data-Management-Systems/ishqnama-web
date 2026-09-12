using System.Security.Claims;
using Ishqnama.Application.Dtos;

namespace Ishqnama.Api.Helpers;

internal static class AuthExtensions
{
    public static bool IsAuthenticated(this ClaimsPrincipal user)
        => user.Identity?.IsAuthenticated == true;

    /// <summary>
    /// User id from the <c>oid</c> claim, falling back to <c>sub</c>. Relies on
    /// <c>MapInboundClaims = false</c> on the bearer options so the short claim types survive.
    /// The bearer handler rejects tokens carrying neither claim, so behind
    /// <c>RequireAuthorization()</c> this never throws.
    /// </summary>
    public static string GetUserId(this ClaimsPrincipal user)
        => user.FindFirstValue("oid")
           ?? user.FindFirstValue("sub")
           ?? throw new InvalidOperationException("Authenticated principal has no 'oid' or 'sub' claim.");

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
