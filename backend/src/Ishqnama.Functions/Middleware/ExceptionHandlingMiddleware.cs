using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Logging;

namespace Ishqnama.Functions.Middleware;

public sealed class ExceptionHandlingMiddleware(ILogger<ExceptionHandlingMiddleware> logger) : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            var httpContext = context.GetHttpContext();
            if (httpContext is not null)
            {
                httpContext.Response.StatusCode = 500;
                await httpContext.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
            }
        }
    }
}
