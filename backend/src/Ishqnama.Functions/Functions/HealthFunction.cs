using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class HealthFunction
{
    [Function("HealthCheck")]
    public IResult HealthCheck(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "healthz")] HttpRequest req)
    {
        return Results.Ok(new { status = "healthy" });
    }
}
