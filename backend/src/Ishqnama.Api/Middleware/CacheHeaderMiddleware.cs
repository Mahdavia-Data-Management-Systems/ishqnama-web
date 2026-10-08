using System.Reflection;
using Ishqnama.Api.Helpers;

namespace Ishqnama.Api.Middleware;

/// <summary>
/// Caching for the read-only routes: assembly-version ETag, <c>Vary: Authorization</c> (tafseer is
/// stripped for anonymous callers, so the two audiences must never share a cache entry) and a 304
/// short-circuit on <c>If-None-Match</c>. The Quran routes are long-lived and immutable. The
/// members-only essays are <c>private, no-cache</c>: only the reader's browser keeps them, and it
/// rechecks each visit, so a corrected essay arrives with the next deploy (the ETag changes with the
/// version, the only way their embedded text can change). This runs after UseAuthorization(), so a
/// request without a valid token gets 401 before the 304 short-circuit can answer it.
/// User-data routes, published verse lists (edited live by their owners) and health probes are
/// excluded.
/// </summary>
public sealed class CacheHeaderMiddleware(RequestDelegate next)
{
    private const string QuranCacheControl = "public, max-age=2592000, immutable";
    private const string MembersCacheControl = "private, no-cache";

    private static readonly string BaseVersion =
        typeof(CacheHeaderMiddleware).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? "0";

    private static readonly string AuthenticatedEtag = $"\"v2-{BaseVersion}-a\"";
    private static readonly string UnauthenticatedEtag = $"\"v2-{BaseVersion}-u\"";

    /// <summary>The Cache-Control for a request path, or null for routes this middleware leaves alone.</summary>
    internal static string? CacheControlFor(PathString path)
    {
        if (!path.StartsWithSegments("/api")
            || path.StartsWithSegments("/api/user")
            || path.StartsWithSegments("/api/lists")
            || path.StartsWithSegments("/api/healthz"))
            return null;

        return path.StartsWithSegments("/api/articles") ? MembersCacheControl : QuranCacheControl;
    }

    public Task InvokeAsync(HttpContext context)
    {
        var cacheControl = CacheControlFor(context.Request.Path);
        if (cacheControl is null)
            return next(context);

        var etag = context.User.IsAuthenticated() ? AuthenticatedEtag : UnauthenticatedEtag;

        // Short-circuit: return 304 if the ETag matches (skip endpoint execution)
        if (context.Request.Headers.IfNoneMatch.ToString() == etag)
        {
            context.Response.StatusCode = StatusCodes.Status304NotModified;
            ApplyHeaders(context.Response, etag, cacheControl);
            return Task.CompletedTask;
        }

        // Headers must be set before the endpoint starts writing the body. Server errors are
        // skipped so a failure is never cached.
        context.Response.OnStarting(static state =>
        {
            var (response, tag, control) = ((HttpResponse, string, string))state;
            if (response.StatusCode < StatusCodes.Status500InternalServerError)
                ApplyHeaders(response, tag, control);
            return Task.CompletedTask;
        }, (context.Response, etag, cacheControl));

        return next(context);
    }

    private static void ApplyHeaders(HttpResponse response, string etag, string cacheControl)
    {
        response.Headers.CacheControl = cacheControl;
        response.Headers.ETag = etag;
        response.Headers.Vary = "Authorization";
    }
}
