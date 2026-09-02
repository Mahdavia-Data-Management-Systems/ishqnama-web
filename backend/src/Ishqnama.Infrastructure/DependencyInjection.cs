using Ishqnama.Application.Interfaces;
using Ishqnama.Infrastructure.Data;
using Ishqnama.Infrastructure.Repositories;
using Microsoft.Azure.Cosmos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Ishqnama.Infrastructure;

public static class DependencyInjection
{
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

            if (endpoint.Contains("localhost:8081", StringComparison.OrdinalIgnoreCase))
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
