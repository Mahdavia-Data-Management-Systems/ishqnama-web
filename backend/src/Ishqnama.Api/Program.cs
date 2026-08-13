using System.Text.Encodings.Web;
using System.Text.Unicode;
using Ishqnama.Api.Data;
using Ishqnama.Api.Endpoints;
using Ishqnama.Api.Middleware;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// JSON serialization — output Unicode directly
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
});

// DbContext — PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("QuranDb")
    ?? throw new InvalidOperationException("Connection string 'QuranDb' not found.");
builder.Services.AddDbContext<QuranDbContext>(options =>
    options.UseNpgsql(connectionString)
        .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

// OutputCache policies
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy("Immutable", b => b.Expire(TimeSpan.FromHours(24)));
    options.AddPolicy("ByVerse", b => b
        .SetVaryByQuery("translationId", "page", "pageSize")
        .Expire(TimeSpan.FromHours(24)));
    options.AddPolicy("SingleItem", b => b
        .SetVaryByRouteValue("num")
        .Expire(TimeSpan.FromHours(24)));
    options.AddPolicy("SingleVerse", b => b
        .SetVaryByRouteValue("num", "verseNum")
        .Expire(TimeSpan.FromHours(24)));
});

// Response compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

// OpenAPI + Swagger
builder.Services.AddOpenApi();

// Exception handler
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

// Static ETag based on app version
var etagValue = "\"v2-" + typeof(QuranDbContext).Assembly.GetName().Version + "\"";

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Ishqnama API");
    });
}

app.UseResponseCompression();
app.UseOutputCache();

// ETag middleware — add to all responses
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "public, max-age=2592000, immutable";
    context.Response.Headers.ETag = etagValue;

    if (context.Request.Headers.IfNoneMatch == etagValue)
    {
        context.Response.StatusCode = StatusCodes.Status304NotModified;
        return;
    }

    await next();
});

// Map endpoints
app.MapChapterEndpoints();
app.MapJuzEndpoints();
app.MapRukuEndpoints();
app.MapTranslationEndpoints();
app.MapVerseEndpoints();

app.MapGet("/healthz", () => Results.Ok(new { status = "healthy" }))
    .ExcludeFromDescription();

app.Run();
