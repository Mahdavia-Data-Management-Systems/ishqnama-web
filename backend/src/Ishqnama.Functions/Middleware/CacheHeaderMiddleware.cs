using System.Reflection;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace Ishqnama.Functions.Middleware;

public sealed class CacheHeaderMiddleware : IFunctionsWorkerMiddleware
{
    private static readonly string BaseVersion =
        typeof(CacheHeaderMiddleware).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? "0";

    private static readonly string AuthenticatedEtag = $"\"v2-{BaseVersion}-a\"";
    private static readonly string UnauthenticatedEtag = $"\"v2-{BaseVersion}-u\"";

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();
        var path = httpContext?.Request.Path;
        var isQuranRoute = path is not null
            && !path.Value.StartsWithSegments("/api/user");

        if (httpContext is not null && isQuranRoute)
        {
            var etag = httpContext.Items.ContainsKey("IsAuthenticated")
                ? AuthenticatedEtag
                : UnauthenticatedEtag;

            // Short-circuit: return 304 if ETag matches (skip function execution)
            if (httpContext.Request.Headers.IfNoneMatch.ToString() == etag)
            {
                httpContext.Response.StatusCode = 304;
                httpContext.Response.Headers.CacheControl = "public, max-age=2592000, immutable";
                httpContext.Response.Headers.ETag = etag;
                httpContext.Response.Headers.Vary = "Authorization";
                return;
            }

            await next(context);

            httpContext.Response.Headers.CacheControl = "public, max-age=2592000, immutable";
            httpContext.Response.Headers.ETag = etag;
            httpContext.Response.Headers.Vary = "Authorization";
        }
        else
        {
            await next(context);
        }
    }
}
