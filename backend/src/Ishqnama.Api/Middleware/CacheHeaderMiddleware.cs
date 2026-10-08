using System.Reflection;
using Ishqnama.Api.Helpers;

namespace Ishqnama.Api.Middleware;

/// <summary>
/// Caching for the read-only routes. The Quran routes are long-lived and immutable: assembly-version
/// ETag (it changes with each deploy), <c>Vary: Authorization</c> (tafseer is stripped for anonymous
/// callers, so the two audiences must never share a cache entry) and a 304 short-circuit on
/// <c>If-None-Match</c>. The members-only essays get only <c>private, no-cache</c> and
/// <c>Vary: Authorization</c> here: their ETag is a hash of each essay's text, set (with its own 304)
/// by the endpoint, because the assembly version is the same in every deployed image. This runs after
/// UseAuthorization(), so a request without a valid token gets 401 before any 304 can answer it.
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

    /// <summary>How this middleware treats a route: left alone, long-lived Quran data, or the members-only essays.</summary>
    internal enum RouteCaching { None, Quran, Members }

    /// <summary>The caching policy for a request path; the one place the path rules live.</summary>
    internal static RouteCaching CachingFor(PathString path)
    {
        if (!path.StartsWithSegments("/api")
            || path.StartsWithSegments("/api/user")
            || path.StartsWithSegments("/api/lists")
            || path.StartsWithSegments("/api/healthz"))
            return RouteCaching.None;

        return path.StartsWithSegments("/api/articles") ? RouteCaching.Members : RouteCaching.Quran;
    }

    public Task InvokeAsync(HttpContext context)
    {
        switch (CachingFor(context.Request.Path))
        {
            case RouteCaching.None:
                return next(context);
            case RouteCaching.Members:
                context.Response.OnStarting(static state =>
                {
                    var response = (HttpResponse)state;
                    if (response.StatusCode < StatusCodes.Status500InternalServerError)
                    {
                        response.Headers.CacheControl = MembersCacheControl;
                        response.Headers.Vary = "Authorization";
                    }
                    return Task.CompletedTask;
                }, context.Response);
                return next(context);
        }

        var etag = context.User.IsAuthenticated() ? AuthenticatedEtag : UnauthenticatedEtag;

        // Short-circuit: return 304 if the ETag matches (skip endpoint execution)
        if (context.Request.Headers.IfNoneMatch.ToString() == etag)
        {
            context.Response.StatusCode = StatusCodes.Status304NotModified;
            ApplyHeaders(context.Response, etag);
            return Task.CompletedTask;
        }

        // Headers must be set before the endpoint starts writing the body. Server errors are
        // skipped so a failure is never cached.
        context.Response.OnStarting(static state =>
        {
            var (response, tag) = ((HttpResponse, string))state;
            if (response.StatusCode < StatusCodes.Status500InternalServerError)
                ApplyHeaders(response, tag);
            return Task.CompletedTask;
        }, (context.Response, etag));

        return next(context);
    }

    private static void ApplyHeaders(HttpResponse response, string etag)
    {
        response.Headers.CacheControl = QuranCacheControl;
        response.Headers.ETag = etag;
        response.Headers.Vary = "Authorization";
    }
}
