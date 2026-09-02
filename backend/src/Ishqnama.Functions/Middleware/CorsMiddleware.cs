using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Configuration;

namespace Ishqnama.Functions.Middleware;

public sealed class CorsMiddleware : IFunctionsWorkerMiddleware
{
    private readonly HashSet<string> _allowedOrigins;

    public CorsMiddleware(IConfiguration configuration)
    {
        var raw = configuration["Cors:AllowedOrigins"] ?? "";
        var origins = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        _allowedOrigins = new HashSet<string>(origins, StringComparer.OrdinalIgnoreCase);
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();
        if (httpContext is null)
        {
            await next(context);
            return;
        }

        var origin = httpContext.Request.Headers.Origin.ToString();
        var isAllowed = !string.IsNullOrEmpty(origin) && _allowedOrigins.Contains(origin);

        if (isAllowed)
        {
            httpContext.Response.Headers["Access-Control-Allow-Origin"] = origin;
            httpContext.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
            httpContext.Response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Accept, Authorization";
        }

        // Handle preflight
        if (HttpMethods.IsOptions(httpContext.Request.Method))
        {
            httpContext.Response.StatusCode = 204;
            return;
        }

        await next(context);
    }
}
