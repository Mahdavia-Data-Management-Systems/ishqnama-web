using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace Ishqnama.Functions.Middleware;

public sealed class CacheHeaderMiddleware : IFunctionsWorkerMiddleware
{
    private static readonly string EtagValue =
        "\"v2-" + typeof(CacheHeaderMiddleware).Assembly.GetName().Version + "\"";

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();

        // Short-circuit: return 304 if ETag matches (skip function execution)
        if (httpContext is not null &&
            httpContext.Request.Headers.IfNoneMatch.ToString() == EtagValue)
        {
            httpContext.Response.StatusCode = 304;
            return;
        }

        await next(context);

        if (httpContext is not null)
        {
            httpContext.Response.Headers.CacheControl = "public, max-age=2592000, immutable";
            httpContext.Response.Headers.ETag = EtagValue;
        }
    }
}
