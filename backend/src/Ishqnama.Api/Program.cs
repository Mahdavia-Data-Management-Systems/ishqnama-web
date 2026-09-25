using System.IO.Compression;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using Ishqnama.Api.Contracts;
using Ishqnama.Api.Endpoints;
using Ishqnama.Api.Hosting;
using Ishqnama.Api.Json;
using Ishqnama.Api.Middleware;
using Ishqnama.Application.Services;
using Ishqnama.Infrastructure;
using Ishqnama.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

// JSON: emit Arabic/Urdu/Hindi directly (no \uXXXX escaping) and prefer source-generated metadata.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
    options.SerializerOptions.TypeInfoResolverChain.Insert(0, IshqnamaJsonContext.Default);
});

// Quran data (provider decided by the connection string — Postgres today, SQLite after PR 1)
var connectionString = configuration["ConnectionStrings:QuranDb"]
    ?? throw new InvalidOperationException("Connection string 'QuranDb' not found.");
builder.Services.AddInfrastructure(connectionString);

// User data (Cosmos DB) — optional: the Quran endpoints work without it
var cosmosEndpoint = configuration["CosmosDb:Endpoint"];
var cosmosKey = configuration["CosmosDb:Key"];
var cosmosDatabase = configuration["CosmosDb:DatabaseName"] ?? "ishqnama-userdata";
var cosmosContainer = configuration["CosmosDb:ContainerName"] ?? "user-data";

if (!string.IsNullOrEmpty(cosmosEndpoint) && !string.IsNullOrEmpty(cosmosKey))
{
    builder.Services.AddUserDataInfrastructure(cosmosEndpoint, cosmosKey, cosmosDatabase, cosmosContainer);
}

// Application services
builder.Services.AddScoped<ChapterService>();
builder.Services.AddScoped<JuzService>();
builder.Services.AddScoped<RukuService>();
builder.Services.AddScoped<TranslationService>();
builder.Services.AddScoped<VerseService>();
builder.Services.AddScoped<SearchService>();
builder.Services.AddScoped<UserDataService>();

// CORS — Container Apps has no platform CORS, so the app owns it (mirrors the Functions CorsMiddleware)
var allowedOrigins = (configuration["Cors:AllowedOrigins"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(allowedOrigins)
    .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
    .WithHeaders("Content-Type", "Accept", "Authorization")
    // The Authorization header makes every signed-in call preflighted; without a max-age browsers
    // re-send the OPTIONS request almost every time (Chrome caches it for 5 s), doubling the round
    // trips. Two hours is Chrome's cap; Firefox allows up to 24 h.
    .SetPreflightMaxAge(TimeSpan.FromHours(2))));

// Auth — Entra ID External (CIAM) bearer tokens issued for the API app registration.
// Authentication runs on every request; only routes marked RequireAuthorization() challenge, so a
// valid token on an anonymous route unlocks tafseer and an invalid one is simply ignored there.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = configuration["Auth:Authority"];
        options.Audience = configuration["Auth:ClientId"];
        options.MapInboundClaims = false; // keep "oid" / "sub" as-is
        options.TokenValidationParameters.ValidateIssuer = true;
        options.TokenValidationParameters.ValidateAudience = true;
        options.TokenValidationParameters.ValidateLifetime = true;
        options.TokenValidationParameters.ValidateIssuerSigningKey = true;
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var principal = context.Principal;
                var userId = principal?.FindFirst("oid")?.Value ?? principal?.FindFirst("sub")?.Value;
                if (string.IsNullOrWhiteSpace(userId))
                    context.Fail("Token carries no user identifier ('oid' or 'sub').");
                return Task.CompletedTask;
            },
            // Same 401 bodies as the Functions AuthMiddleware (the default challenge has none)
            OnChallenge = async context =>
            {
                context.HandleResponse();
                var message = context.AuthenticateFailure is null
                    ? "Missing or invalid Authorization header."
                    : "Invalid token.";
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    new ErrorResponse(message), IshqnamaJsonContext.Default.ErrorResponse);
            }
        };
    });
builder.Services.AddAuthorization();

// Load token signing keys and connect to Cosmos DB at startup rather than on the first signed-in request
builder.Services.AddHostedService(sp => new WarmUpService(
    sp.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>(),
    sp.GetService<CosmosClient>(),
    cosmosDatabase,
    cosmosContainer,
    sp.GetRequiredService<ILogger<WarmUpService>>()));

// Response compression — the Functions platform did this for free; Kestrel does not
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json"]);
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

// Health checks for Container Apps probes
builder.Services.AddHealthChecks().AddDbContextCheck<QuranDbContext>();

// UseExceptionHandler() requires IProblemDetailsService to be registered; GlobalExceptionHandler
// runs first and always handles the exception, so the ProblemDetails body is never emitted.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddOpenApi();
}

var app = builder.Build();

app.UseResponseCompression();
app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<CacheHeaderMiddleware>();

// Same prefix as host.json's "routePrefix": "api" so the frontend's NEXT_PUBLIC_API_URL keeps working
var api = app.MapGroup("/api");
api.MapChapterEndpoints();
api.MapJuzEndpoints();
api.MapRukuEndpoints();
api.MapTranslationEndpoints();
api.MapVerseEndpoints();
api.MapSearchEndpoints();
api.MapUserDataEndpoints();
api.MapHealthEndpoints();

// Probe targets (outside /api so they never pick up cache headers)
app.MapGet("/health/live", () => Results.Ok()).AllowAnonymous().ExcludeFromDescription();
app.MapHealthChecks("/health/ready").AllowAnonymous();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options => options.WithTitle("Ishqnama API"));
}

app.Run();
