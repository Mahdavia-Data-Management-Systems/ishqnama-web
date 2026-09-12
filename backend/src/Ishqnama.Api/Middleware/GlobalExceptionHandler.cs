using Ishqnama.Api.Contracts;
using Ishqnama.Api.Json;
using Microsoft.AspNetCore.Diagnostics;

namespace Ishqnama.Api.Middleware;

internal sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception: {Message}", exception.Message);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            new ErrorResponse("An unexpected error occurred."),
            IshqnamaJsonContext.Default.ErrorResponse,
            cancellationToken: cancellationToken);

        return true;
    }
}
