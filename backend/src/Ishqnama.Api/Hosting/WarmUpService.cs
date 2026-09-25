using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;

namespace Ishqnama.Api.Hosting;

/// <summary>
/// Starts the lazy work that the first signed-in request would otherwise pay for after every cold
/// start: the Cosmos DB client's account, container and routing metadata plus its connection, and
/// JwtBearer's download of the Entra discovery document and signing keys. The keep-alive ping
/// (<c>/api/healthz</c>) touches neither, so without this a replica that answers the ping is still
/// cold for settings and bookmarks. Runs in the background so startup and the ping are not delayed;
/// a request that arrives mid-way simply joins the same in-flight initialisation. Best effort: a
/// failure is logged and the request path initialises as before.
/// </summary>
internal sealed class WarmUpService(
    IOptionsMonitor<JwtBearerOptions> jwtOptions,
    CosmosClient? cosmosClient,
    string cosmosDatabase,
    string cosmosContainer,
    ILogger<WarmUpService> logger) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.WhenAll(WarmUpAuthAsync(stoppingToken), WarmUpCosmosAsync(stoppingToken));

    private async Task WarmUpAuthAsync(CancellationToken cancellationToken)
    {
        // Post-configured options: JwtBearer creates the ConfigurationManager from Authority, and the
        // handler reuses this same cached instance, so fetching here fills the cache it reads from.
        var configurationManager = jwtOptions.Get(JwtBearerDefaults.AuthenticationScheme).ConfigurationManager;
        if (configurationManager is null)
            return;

        try
        {
            await configurationManager.GetConfigurationAsync(cancellationToken);
            logger.LogInformation("Warm-up: token signing keys loaded.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Warm-up: could not load token signing keys; the first signed-in request will.");
        }
    }

    private async Task WarmUpCosmosAsync(CancellationToken cancellationToken)
    {
        if (cosmosClient is null)
            return;

        try
        {
            // A point read of a document that never exists: resolves the account, container and
            // partition routing and opens the connection to the replica, for about 1 RU. The stream
            // API returns the 404 as a status instead of throwing.
            using var response = await cosmosClient
                .GetContainer(cosmosDatabase, cosmosContainer)
                .ReadItemStreamAsync("warm-up", new PartitionKey("warm-up"), cancellationToken: cancellationToken);
            logger.LogInformation("Warm-up: user data store reachable ({StatusCode}).", response.StatusCode);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Warm-up: could not reach the user data store; the first signed-in request will.");
        }
    }
}
