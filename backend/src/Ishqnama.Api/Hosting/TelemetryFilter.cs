namespace Ishqnama.Api.Hosting;

/// <summary>
/// Decides which incoming requests become Application Insights request telemetry. The container
/// probes (about 480 requests an hour while a replica is up), the frontend's keep-alive ping and
/// CORS preflights would otherwise make up most of the data and eat the daily ingestion cap.
/// </summary>
internal static class TelemetryFilter
{
    public static bool ShouldTrace(HttpContext context)
    {
        if (HttpMethods.IsOptions(context.Request.Method))
            return false;

        var path = context.Request.Path;
        return !path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase)
            && !path.StartsWithSegments("/api/healthz", StringComparison.OrdinalIgnoreCase);
    }
}
