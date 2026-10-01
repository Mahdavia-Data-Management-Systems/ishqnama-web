using System.Security.Cryptography;
using System.Text;

namespace Ishqnama.Api.Helpers;

/// <summary>
/// The pseudonymous user ID sent to Application Insights as <c>enduser.id</c>: the first 16 hex
/// characters of the SHA-256 of the account's <c>oid</c>. The frontend computes the same value
/// (<c>src/lib/telemetry.ts</c>), so browser and API telemetry for one reader line up without the
/// raw account ID leaving the app.
/// </summary>
internal static class UserHash
{
    public static string From(string oid)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(oid));
        return Convert.ToHexStringLower(digest)[..16];
    }
}
