using Ishqnama.Application.Interfaces;
using Ishqnama.Infrastructure.Data;
using Ishqnama.Infrastructure.Repositories;
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
}
