using Ishqnama.Application.Interfaces;
using Ishqnama.Infrastructure.Data;
using Ishqnama.Infrastructure.Repositories;
using Microsoft.Azure.Cosmos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ishqnama.Infrastructure;

public static class DependencyInjection
{
    /// <summary>The Cosmos DB emulator's published, non-secret master key.</summary>
    private const string EmulatorKey =
        "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<QuranDbContext>(options =>
            options.UseNpgsql(connectionString)
                .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

        services.AddSingleton<IQuranReadOnlyRepository, CachedQuranReadOnlyRepository>();
        return services;
    }

    public static IServiceCollection AddUserDataInfrastructure(
        this IServiceCollection services, string endpoint, string key,
        string databaseName, string containerName)
    {
        services.AddSingleton(_ =>
        {
            var options = new CosmosClientOptions
            {
                SerializerOptions = new CosmosSerializationOptions
                {
                    PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
                }
            };

            // The emulator serves a self-signed certificate. Match it by its well-known key as well
            // as by host, so it is still recognised when reached over a container network
            // (https://cosmos:8081 from docker-compose) rather than from the host.
            if (key == EmulatorKey || endpoint.Contains("localhost:8081", StringComparison.OrdinalIgnoreCase))
            {
                options.HttpClientFactory = () =>
                {
                    var handler = new HttpClientHandler
                    {
                        ServerCertificateCustomValidationCallback =
                            HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                    };
                    return new HttpClient(handler);
                };
                options.ConnectionMode = ConnectionMode.Gateway;
            }

            return new CosmosClient(endpoint, key, options);
        });

        services.AddSingleton<IUserDataRepository>(sp =>
            new CosmosUserDataRepository(
                sp.GetRequiredService<CosmosClient>(), databaseName, containerName));

        return services;
    }
}
