using System.Reflection;
using Ishqnama.Api.Helpers;

namespace Ishqnama.Api.Middleware;

/// <summary>
/// Long-lived immutable caching for the read-only Quran routes: assembly-version ETag,
/// <c>Vary: Authorization</c> (tafseer is stripped for anonymous callers, so the two audiences
/// must never share a cache entry) and a 304 short-circuit on <c>If-None-Match</c>.
/// User-data routes and health probes are excluded.
/// </summary>
public sealed class CacheHeaderMiddleware(RequestDelegate next)
{
    private const string CacheControlValue = "public, max-age=2592000, immutable";

    private static readonly string BaseVersion =
        typeof(CacheHeaderMiddleware).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? "0";

    private static readonly string AuthenticatedEtag = $"\"v2-{BaseVersion}-a\"";
    private static readonly string UnauthenticatedEtag = $"\"v2-{BaseVersion}-u\"";

    public Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        var isQuranRoute = path.StartsWithSegments("/api")
            && !path.StartsWithSegments("/api/user")
            && !path.StartsWithSegments("/api/healthz");

        if (!isQuranRoute)
            return next(context);

        var etag = context.User.IsAuthenticated() ? AuthenticatedEtag : UnauthenticatedEtag;

        // Short-circuit: return 304 if the ETag matches (skip endpoint execution)
        if (context.Request.Headers.IfNoneMatch.ToString() == etag)
        {
            context.Response.StatusCode = StatusCodes.Status304NotModified;
            ApplyHeaders(context.Response, etag);
            return Task.CompletedTask;
        }

        // Headers must be set before the endpoint starts writing the body. Server errors are
        // skipped so a failure is never cached for 30 days.
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
        response.Headers.CacheControl = CacheControlValue;
        response.Headers.ETag = etag;
        response.Headers.Vary = "Authorization";
    }
}
