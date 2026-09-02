using System.Text.Encodings.Web;
using System.Text.Unicode;
using Ishqnama.Application.Services;
using Ishqnama.Functions.Middleware;
using Ishqnama.Infrastructure;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication(builder =>
    {
        builder.UseMiddleware<CorsMiddleware>();
        builder.UseMiddleware<AuthMiddleware>();
        builder.UseMiddleware<ExceptionHandlingMiddleware>();
        builder.UseMiddleware<CacheHeaderMiddleware>();
    })
    .ConfigureServices((context, services) =>
    {
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();

        // Unicode output (Arabic, Urdu, Hindi) without \uXXXX escaping
        services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
        {
            options.SerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
        });

        // Infrastructure (DbContext + Repository)
        var connectionString = context.Configuration["ConnectionStrings:QuranDb"]
            ?? throw new InvalidOperationException("Connection string 'QuranDb' not found.");
        services.AddInfrastructure(connectionString);

        // User data (Cosmos DB)
        var cosmosEndpoint = context.Configuration["CosmosDb:Endpoint"];
        var cosmosKey = context.Configuration["CosmosDb:Key"];
        var cosmosDatabase = context.Configuration["CosmosDb:DatabaseName"] ?? "ishqnama-userdata";
        var cosmosContainer = context.Configuration["CosmosDb:ContainerName"] ?? "user-data";

        if (!string.IsNullOrEmpty(cosmosEndpoint) && !string.IsNullOrEmpty(cosmosKey))
        {
            services.AddUserDataInfrastructure(cosmosEndpoint, cosmosKey, cosmosDatabase, cosmosContainer);
        }

        // Application services
        services.AddScoped<ChapterService>();
        services.AddScoped<JuzService>();
        services.AddScoped<RukuService>();
        services.AddScoped<TranslationService>();
        services.AddScoped<VerseService>();
        services.AddScoped<UserDataService>();

        services.AddMemoryCache();
    })
    .Build();

host.Run();
