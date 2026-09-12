using Ishqnama.Api.Contracts;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class HealthEndpoints
{
    /// <summary>
    /// Legacy <c>/api/healthz</c> kept for parity with the Functions host. Container probes use
    /// <c>/health/live</c> and <c>/health/ready</c>, mapped in <c>Program.cs</c>.
    /// </summary>
    public static RouteGroupBuilder MapHealthEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/healthz", HealthCheck).AllowAnonymous().WithTags("Health");
        return api;
    }

    private static Ok<HealthResponse> HealthCheck() => TypedResults.Ok(new HealthResponse("healthy"));
}
