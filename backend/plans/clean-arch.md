# Clean Architecture Plan: Ishqnama Backend

## Context

The current backend is a single-project .NET 10 Minimal API (`Ishqnama.Api`) serving read-only Quran data from PostgreSQL. It uses OutputCache, ETag headers, and response compression, deployed as a container on Azure Container Apps.

**Problem**: The single-project structure couples presentation, business logic, and data access. APIM was planned for caching/CORS but adds cost and complexity for a read-only API.

**Target**: Re-architect into Clean Architecture with Azure Functions (free tier Consumption plan) as the presentation layer. No APIM. No container deployment.

---

## 1. Solution Structure

```
backend/
├── Ishqnama.slnx
├── global.json                            # SDK 10.0.300
├── CLAUDE.md
├── .gitignore
│
├── src/
│   ├── Ishqnama.Domain/                   # Layer 1: Entities (innermost, zero deps)
│   │   ├── Ishqnama.Domain.csproj
│   │   └── Entities/
│   │       ├── Chapter.cs
│   │       ├── ChapterTranslation.cs
│   │       ├── Juz.cs
│   │       ├── Language.cs
│   │       ├── Manzil.cs
│   │       ├── Ruku.cs
│   │       ├── Script.cs
│   │       ├── Translation.cs
│   │       ├── TranslationSegment.cs
│   │       └── Verse.cs
│   │
│   ├── Ishqnama.Application/              # Layer 2: DTOs, interfaces, services
│   │   ├── Ishqnama.Application.csproj
│   │   ├── Interfaces/
│   │   │   └── IQuranReadOnlyRepository.cs
│   │   ├── Dtos/
│   │   │   ├── ChapterDto.cs
│   │   │   ├── ChapterDetailDto.cs        # includes ChapterTranslationDto
│   │   │   ├── JuzDto.cs
│   │   │   ├── PagedResponse.cs
│   │   │   ├── RukuDto.cs
│   │   │   ├── TranslationDto.cs
│   │   │   └── VerseDto.cs                # includes TranslationSegmentDto
│   │   ├── Mappings/
│   │   │   └── DtoMappings.cs
│   │   └── Services/
│   │       ├── ChapterService.cs
│   │       ├── JuzService.cs
│   │       ├── RukuService.cs
│   │       ├── TranslationService.cs
│   │       └── VerseService.cs
│   │
│   ├── Ishqnama.Infrastructure/            # Layer 3: EF Core, repository impl
│   │   ├── Ishqnama.Infrastructure.csproj
│   │   ├── Data/
│   │   │   ├── QuranDbContext.cs
│   │   │   └── Configurations/             # 10 IEntityTypeConfiguration files
│   │   │       ├── ChapterConfiguration.cs
│   │   │       ├── ChapterTranslationConfiguration.cs
│   │   │       ├── JuzConfiguration.cs
│   │   │       ├── LanguageConfiguration.cs
│   │   │       ├── ManzilConfiguration.cs
│   │   │       ├── RukuConfiguration.cs
│   │   │       ├── ScriptConfiguration.cs
│   │   │       ├── TranslationConfiguration.cs
│   │   │       ├── TranslationSegmentConfiguration.cs
│   │   │       └── VerseConfiguration.cs
│   │   ├── Repositories/
│   │   │   └── QuranReadOnlyRepository.cs
│   │   └── DependencyInjection.cs
│   │
│   └── Ishqnama.Functions/                 # Layer 4: Azure Functions (presentation)
│       ├── Ishqnama.Functions.csproj
│       ├── Program.cs
│       ├── host.json
│       ├── local.settings.json
│       ├── Functions/
│       │   ├── ChapterFunctions.cs
│       │   ├── JuzFunctions.cs
│       │   ├── RukuFunctions.cs
│       │   ├── TranslationFunctions.cs
│       │   ├── VerseFunctions.cs
│       │   └── HealthFunction.cs
│       └── Middleware/
│           ├── ExceptionHandlingMiddleware.cs
│           └── CacheHeaderMiddleware.cs
```

### Dependency Direction

```
Functions  ──>  Application  ──>  Domain
           ──>  Infrastructure  ──>  Application
                                ──>  Domain
```

Domain has zero dependencies. Application depends only on Domain. Infrastructure depends on Domain + Application. Functions depends on Application + Infrastructure (composition root).

### Solution File (`Ishqnama.slnx`)

```xml
<Solution>
  <Folder Name="/src/">
    <Project Path="src/Ishqnama.Domain/Ishqnama.Domain.csproj" />
    <Project Path="src/Ishqnama.Application/Ishqnama.Application.csproj" />
    <Project Path="src/Ishqnama.Infrastructure/Ishqnama.Infrastructure.csproj" />
    <Project Path="src/Ishqnama.Functions/Ishqnama.Functions.csproj" />
  </Folder>
</Solution>
```

---

## 2. Layer-by-Layer Breakdown

### Layer 1: `Ishqnama.Domain` — Entities Only

Zero NuGet dependencies. Contains the 10 entity classes moved verbatim from `Ishqnama.Api/Models/` with only a namespace change (`Ishqnama.Api.Models` -> `Ishqnama.Domain.Entities`).

```xml
<!-- Ishqnama.Domain.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <NoWarn>CS8618</NoWarn>
  </PropertyGroup>
</Project>
```

All entity code is identical to current — sealed POCOs with navigation properties.

---

### Layer 2: `Ishqnama.Application` — DTOs, Interfaces, Mappings, Services

Depends only on `Ishqnama.Domain`. No NuGet packages.

```xml
<!-- Ishqnama.Application.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\Ishqnama.Domain\Ishqnama.Domain.csproj" />
  </ItemGroup>
</Project>
```

#### DTOs (`Application/Dtos/`)

All 7 existing sealed record DTOs move here. Namespace changes from `Ishqnama.Api.Dtos` to `Ishqnama.Application.Dtos`. Code is identical.

#### Repository Interface (`Application/Interfaces/IQuranReadOnlyRepository.cs`)

A single cohesive interface (not per-entity repositories). Returns DTOs directly because the queries require database-level projections (joins, pagination) — returning entities would force N+1 queries or wasteful eager loading.

```csharp
using Ishqnama.Application.Dtos;

namespace Ishqnama.Application.Interfaces;

public interface IQuranReadOnlyRepository
{
    // Chapters
    Task<List<ChapterDto>> GetChaptersAsync(string? lang = null);
    Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber);
    Task<bool> ChapterExistsAsync(int chapterNumber);
    Task<PagedResponse<VerseDto>> GetChapterVersesAsync(int chapterNumber, int? translationId, int page, int pageSize);
    Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber);

    // Juz
    Task<List<JuzDto>> GetAllJuzAsync();
    Task<bool> JuzExistsAsync(int juzNumber);
    Task<PagedResponse<VerseDto>> GetJuzVersesAsync(int juzNumber, int? translationId, int page, int pageSize);

    // Rukus
    Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null);
    Task<bool> RukuExistsAsync(int rukuId);
    Task<List<VerseDto>> GetRukuVersesAsync(int rukuId, int? translationId = null);

    // Translations
    Task<List<TranslationDto>> GetTranslationsAsync();

    // Verse Range
    Task<List<VerseDto>> GetVerseRangeAsync(int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null);
}
```

#### Mappings (`Application/Mappings/DtoMappings.cs`)

Moves from `Ishqnama.Api.Mappings`. Namespace change only. Extension methods on entity types still work since Application references Domain.

#### Services (`Application/Services/`)

Thin service classes that own parameter validation and delegate data access to the repository. Each is a sealed class with constructor injection of `IQuranReadOnlyRepository`.

**ChapterService.cs:**
```csharp
namespace Ishqnama.Application.Services;

public sealed class ChapterService(IQuranReadOnlyRepository repository)
{
    public Task<List<ChapterDto>> GetChaptersAsync(string? lang = null)
        => repository.GetChaptersAsync(lang);

    public Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber)
        => repository.GetChapterAsync(chapterNumber);

    public async Task<PagedResponse<VerseDto>?> GetChapterVersesAsync(
        int chapterNumber, int? translationId, int page, int pageSize)
    {
        if (!await repository.ChapterExistsAsync(chapterNumber))
            return null;

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        return await repository.GetChapterVersesAsync(chapterNumber, translationId, page, pageSize);
    }

    public Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber)
        => repository.GetVerseAsync(chapterNumber, verseNumber);
}
```

**JuzService.cs:**
```csharp
public sealed class JuzService(IQuranReadOnlyRepository repository)
{
    public Task<List<JuzDto>> GetAllJuzAsync()
        => repository.GetAllJuzAsync();

    public async Task<PagedResponse<VerseDto>?> GetJuzVersesAsync(
        int juzNumber, int? translationId, int page, int pageSize)
    {
        if (!await repository.JuzExistsAsync(juzNumber))
            return null;

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        return await repository.GetJuzVersesAsync(juzNumber, translationId, page, pageSize);
    }
}
```

**RukuService.cs:**
```csharp
public sealed class RukuService(IQuranReadOnlyRepository repository)
{
    public Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null)
        => repository.GetRukusAsync(chapterNum, juzNum);

    public async Task<List<VerseDto>?> GetRukuVersesAsync(int rukuId, int? translationId = null)
    {
        if (!await repository.RukuExistsAsync(rukuId))
            return null;
        return await repository.GetRukuVersesAsync(rukuId, translationId);
    }
}
```

**TranslationService.cs:**
```csharp
public sealed class TranslationService(IQuranReadOnlyRepository repository)
{
    public Task<List<TranslationDto>> GetTranslationsAsync()
        => repository.GetTranslationsAsync();
}
```

**VerseService.cs:**
```csharp
public sealed class VerseService(IQuranReadOnlyRepository repository)
{
    public Task<List<VerseDto>> GetVerseRangeAsync(
        int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null)
        => repository.GetVerseRangeAsync(fromChapter, fromVerse, toChapter, toVerse, translationId);

    public static bool TryParseVerseRef(string input, out int chapter, out int verse)
    {
        chapter = 0; verse = 0;
        var parts = input.Split(':');
        return parts.Length == 2 &&
               int.TryParse(parts[0], out chapter) &&
               int.TryParse(parts[1], out verse);
    }
}
```

---

### Layer 3: `Ishqnama.Infrastructure` — EF Core, Repository

```xml
<!-- Ishqnama.Infrastructure.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <NoWarn>CS8618</NoWarn>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\Ishqnama.Domain\Ishqnama.Domain.csproj" />
    <ProjectReference Include="..\Ishqnama.Application\Ishqnama.Application.csproj" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.2" />
    <PackageReference Include="Microsoft.Extensions.DependencyInjection.Abstractions" Version="10.0.0" />
  </ItemGroup>
</Project>
```

#### `Data/QuranDbContext.cs`

Identical to current except namespace changes to `Ishqnama.Infrastructure.Data` and entity imports to `Ishqnama.Domain.Entities`. `ApplyConfigurationsFromAssembly(typeof(QuranDbContext).Assembly)` still works since configurations are in the same assembly.

#### `Data/Configurations/`

All 10 configuration files move here. Namespace change from `Ishqnama.Api.Data.Configurations` to `Ishqnama.Infrastructure.Data.Configurations`. Entity `using` directives change to `Ishqnama.Domain.Entities`.

#### `Repositories/QuranReadOnlyRepository.cs`

Implements `IQuranReadOnlyRepository`. Consolidates query logic from the 5 endpoint files and `EndpointHelpers.cs`. The shared `MapVersesWithTranslations` helper becomes a private method.

```csharp
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;
using Ishqnama.Application.Mappings;
using Ishqnama.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Infrastructure.Repositories;

public sealed class QuranReadOnlyRepository(QuranDbContext db) : IQuranReadOnlyRepository
{
    // --- Chapters ---

    public async Task<List<ChapterDto>> GetChaptersAsync(string? lang = null)
    {
        if (lang is not null)
        {
            return await db.Chapters
                .GroupJoin(
                    db.ChapterTranslations.Where(ct => ct.LanguageCode == lang),
                    c => c.ChapterNumber, ct => ct.ChapterNumber,
                    (c, translations) => new { Chapter = c, Translation = translations.FirstOrDefault() })
                .OrderBy(x => x.Chapter.ChapterNumber)
                .Select(x => x.Chapter.ToDto(x.Translation != null ? x.Translation.TranslatedName : null))
                .ToListAsync();
        }

        return await db.Chapters
            .OrderBy(c => c.ChapterNumber)
            .Select(c => c.ToDto())
            .ToListAsync();
    }

    public async Task<ChapterDetailDto?> GetChapterAsync(int chapterNumber)
    {
        var chapter = await db.Chapters
            .Include(c => c.ChapterTranslations)
            .FirstOrDefaultAsync(c => c.ChapterNumber == chapterNumber);
        return chapter?.ToDetailDto();
    }

    public Task<bool> ChapterExistsAsync(int chapterNumber)
        => db.Chapters.AnyAsync(c => c.ChapterNumber == chapterNumber);

    public async Task<PagedResponse<VerseDto>> GetChapterVersesAsync(
        int chapterNumber, int? translationId, int page, int pageSize)
    {
        var query = db.Verses
            .Where(v => v.ChapterNumber == chapterNumber)
            .OrderBy(v => v.VerseNumber);

        var totalCount = await query.CountAsync();
        var verses = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var verseDtos = await MapVersesWithTranslationsAsync(verses, translationId);
        return new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount);
    }

    public async Task<VerseDto?> GetVerseAsync(int chapterNumber, int verseNumber)
    {
        var verse = await db.Verses
            .FirstOrDefaultAsync(v => v.ChapterNumber == chapterNumber && v.VerseNumber == verseNumber);
        if (verse is null) return null;

        var segments = await db.TranslationSegments
            .Where(ts => ts.ChapterNumber == chapterNumber && ts.VerseNumber == verseNumber)
            .OrderBy(ts => ts.TranslationId).ThenBy(ts => ts.SegmentIndex)
            .Select(ts => ts.ToDto())
            .ToListAsync();
        return verse.ToDto(segments);
    }

    // --- Juz ---

    public async Task<List<JuzDto>> GetAllJuzAsync()
    {
        var juzList = await db.Juz.OrderBy(j => j.JuzNumber).ToListAsync();
        var juzDtos = new List<JuzDto>();

        foreach (var j in juzList)
        {
            var firstVerse = await db.Verses
                .Where(v => v.JuzNumber == j.JuzNumber)
                .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
                .Select(v => new { v.ChapterNumber, v.VerseNumber })
                .FirstOrDefaultAsync();

            var lastVerse = await db.Verses
                .Where(v => v.JuzNumber == j.JuzNumber)
                .OrderByDescending(v => v.ChapterNumber).ThenByDescending(v => v.VerseNumber)
                .Select(v => new { v.ChapterNumber, v.VerseNumber })
                .FirstOrDefaultAsync();

            juzDtos.Add(j.ToDto(
                firstVerse?.ChapterNumber, firstVerse?.VerseNumber,
                lastVerse?.ChapterNumber, lastVerse?.VerseNumber));
        }
        return juzDtos;
    }

    public Task<bool> JuzExistsAsync(int juzNumber)
        => db.Juz.AnyAsync(j => j.JuzNumber == juzNumber);

    public async Task<PagedResponse<VerseDto>> GetJuzVersesAsync(
        int juzNumber, int? translationId, int page, int pageSize)
    {
        var query = db.Verses
            .Where(v => v.JuzNumber == juzNumber)
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber);

        var totalCount = await query.CountAsync();
        var verses = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var verseDtos = await MapVersesWithTranslationsAsync(verses, translationId);
        return new PagedResponse<VerseDto>(verseDtos, page, pageSize, totalCount);
    }

    // --- Rukus ---

    public async Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null)
    {
        var query = db.Rukus.AsQueryable();
        if (chapterNum.HasValue) query = query.Where(r => r.ChapterNumber == chapterNum.Value);
        if (juzNum.HasValue) query = query.Where(r => r.JuzNumber == juzNum.Value);

        return await query.OrderBy(r => r.RukuId).Select(r => r.ToDto()).ToListAsync();
    }

    public Task<bool> RukuExistsAsync(int rukuId)
        => db.Rukus.AnyAsync(r => r.RukuId == rukuId);

    public async Task<List<VerseDto>> GetRukuVersesAsync(int rukuId, int? translationId = null)
    {
        var verses = await db.Verses
            .Where(v => v.RukuId == rukuId)
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
            .ToListAsync();
        return await MapVersesWithTranslationsAsync(verses, translationId);
    }

    // --- Translations ---

    public async Task<List<TranslationDto>> GetTranslationsAsync()
        => await db.Translations.OrderBy(t => t.TranslationId).Select(t => t.ToDto()).ToListAsync();

    // --- Verse Range ---

    public async Task<List<VerseDto>> GetVerseRangeAsync(
        int fromChapter, int fromVerse, int toChapter, int toVerse, int? translationId = null)
    {
        var verses = await db.Verses
            .Where(v =>
                (v.ChapterNumber > fromChapter || (v.ChapterNumber == fromChapter && v.VerseNumber >= fromVerse)) &&
                (v.ChapterNumber < toChapter || (v.ChapterNumber == toChapter && v.VerseNumber <= toVerse)))
            .OrderBy(v => v.ChapterNumber).ThenBy(v => v.VerseNumber)
            .ToListAsync();

        return await MapVersesWithTranslationsAsync(verses, translationId);
    }

    // --- Private Helper ---

    private async Task<List<VerseDto>> MapVersesWithTranslationsAsync(
        List<Verse> verses, int? translationId)
    {
        if (!translationId.HasValue || verses.Count == 0)
            return verses.Select(v => v.ToDto()).ToList();

        var verseKeySet = verses.Select(v => (v.ChapterNumber, v.VerseNumber)).ToHashSet();
        var chapterNumbers = verses.Select(v => v.ChapterNumber).Distinct().ToList();

        var segments = await db.TranslationSegments
            .Where(ts => ts.TranslationId == translationId.Value
                && chapterNumbers.Contains(ts.ChapterNumber))
            .OrderBy(ts => ts.SegmentIndex)
            .ToListAsync();

        var segmentLookup = segments
            .Where(ts => verseKeySet.Contains((ts.ChapterNumber, ts.VerseNumber)))
            .GroupBy(ts => (ts.ChapterNumber, ts.VerseNumber))
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<TranslationSegmentDto>)g.Select(ts => ts.ToDto()).ToList());

        return verses.Select(v =>
            v.ToDto(segmentLookup.GetValueOrDefault((v.ChapterNumber, v.VerseNumber)))).ToList();
    }
}
```

#### `DependencyInjection.cs`

```csharp
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

        services.AddScoped<IQuranReadOnlyRepository, QuranReadOnlyRepository>();
        return services;
    }
}
```

---

### Layer 4: `Ishqnama.Functions` — Azure Functions (Isolated Worker)

```xml
<!-- Ishqnama.Functions.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <AzureFunctionsVersion>v4</AzureFunctionsVersion>
    <OutputType>Exe</OutputType>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker" Version="2.0.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Extensions.Http.AspNetCore" Version="2.0.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.Sdk" Version="2.0.0" />
    <PackageReference Include="Microsoft.ApplicationInsights.WorkerService" Version="2.22.0" />
    <PackageReference Include="Microsoft.Azure.Functions.Worker.ApplicationInsights" Version="2.0.0" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\Ishqnama.Application\Ishqnama.Application.csproj" />
    <ProjectReference Include="..\Ishqnama.Infrastructure\Ishqnama.Infrastructure.csproj" />
  </ItemGroup>
</Project>
```

Uses `Microsoft.Azure.Functions.Worker.Extensions.Http.AspNetCore` for ASP.NET Core integration (`HttpRequest`, `IResult`, `TypedResults`).

#### `Program.cs`

```csharp
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

        // Application services
        services.AddScoped<ChapterService>();
        services.AddScoped<JuzService>();
        services.AddScoped<RukuService>();
        services.AddScoped<TranslationService>();
        services.AddScoped<VerseService>();

        services.AddMemoryCache();
    })
    .Build();

host.Run();
```

#### Function Classes (`Functions/`)

Azure Functions HTTP triggers with `Route` matching the current `/api/` prefix (automatic in Azure Functions).

**ChapterFunctions.cs:**
```csharp
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Functions.Worker;

namespace Ishqnama.Functions.Functions;

public sealed class ChapterFunctions(ChapterService chapterService)
{
    [Function("GetChapters")]
    public async Task<IResult> GetChapters(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters")] HttpRequest req,
        string? lang = null)
    {
        var chapters = await chapterService.GetChaptersAsync(lang);
        return Results.Ok(chapters);
    }

    [Function("GetChapter")]
    public async Task<IResult> GetChapter(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters/{num:int}")] HttpRequest req,
        int num)
    {
        var chapter = await chapterService.GetChapterAsync(num);
        return chapter is null ? Results.NotFound() : Results.Ok(chapter);
    }

    [Function("GetChapterVerses")]
    public async Task<IResult> GetChapterVerses(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters/{num:int}/verses")] HttpRequest req,
        int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        var result = await chapterService.GetChapterVersesAsync(num, translationId, page, pageSize);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    [Function("GetVerse")]
    public async Task<IResult> GetVerse(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chapters/{num:int}/verses/{verseNum:int}")] HttpRequest req,
        int num, int verseNum)
    {
        var verse = await chapterService.GetVerseAsync(num, verseNum);
        return verse is null ? Results.NotFound() : Results.Ok(verse);
    }
}
```

**JuzFunctions.cs:**
```csharp
public sealed class JuzFunctions(JuzService juzService)
{
    [Function("GetAllJuz")]
    public async Task<IResult> GetAllJuz(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "juz")] HttpRequest req)
    {
        var juz = await juzService.GetAllJuzAsync();
        return Results.Ok(juz);
    }

    [Function("GetJuzVerses")]
    public async Task<IResult> GetJuzVerses(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "juz/{num:int}/verses")] HttpRequest req,
        int num, int? translationId = null, int page = 1, int pageSize = 50)
    {
        var result = await juzService.GetJuzVersesAsync(num, translationId, page, pageSize);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }
}
```

**RukuFunctions.cs:**
```csharp
public sealed class RukuFunctions(RukuService rukuService)
{
    [Function("GetRukus")]
    public async Task<IResult> GetRukus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "rukus")] HttpRequest req,
        int? chapterNum = null, int? juzNum = null)
    {
        var rukus = await rukuService.GetRukusAsync(chapterNum, juzNum);
        return Results.Ok(rukus);
    }

    [Function("GetRukuVerses")]
    public async Task<IResult> GetRukuVerses(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "rukus/{id:int}/verses")] HttpRequest req,
        int id, int? translationId = null)
    {
        var verses = await rukuService.GetRukuVersesAsync(id, translationId);
        return verses is null ? Results.NotFound() : Results.Ok(verses);
    }
}
```

**TranslationFunctions.cs:**
```csharp
public sealed class TranslationFunctions(TranslationService translationService)
{
    [Function("GetTranslations")]
    public async Task<IResult> GetTranslations(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "translations")] HttpRequest req)
    {
        var translations = await translationService.GetTranslationsAsync();
        return Results.Ok(translations);
    }
}
```

**VerseFunctions.cs:**
```csharp
public sealed class VerseFunctions(VerseService verseService)
{
    [Function("GetVerseRange")]
    public async Task<IResult> GetVerseRange(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "verses")] HttpRequest req,
        string from, string to, int? translationId = null)
    {
        if (!VerseService.TryParseVerseRef(from, out var fromChapter, out var fromVerse) ||
            !VerseService.TryParseVerseRef(to, out var toChapter, out var toVerse))
        {
            return Results.BadRequest("Invalid verse reference format. Use 'chapter:verse' (e.g., '2:1').");
        }

        var verses = await verseService.GetVerseRangeAsync(fromChapter, fromVerse, toChapter, toVerse, translationId);
        return Results.Ok(verses);
    }
}
```

**HealthFunction.cs:**
```csharp
public sealed class HealthFunction
{
    [Function("HealthCheck")]
    public IResult HealthCheck(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "healthz")] HttpRequest req)
    {
        return Results.Ok(new { status = "healthy" });
    }
}
```

#### Middleware

**`Middleware/CacheHeaderMiddleware.cs`:**
```csharp
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace Ishqnama.Functions.Middleware;

public sealed class CacheHeaderMiddleware : IFunctionsWorkerMiddleware
{
    private static readonly string EtagValue =
        "\"v2-" + typeof(CacheHeaderMiddleware).Assembly.GetName().Version + "\"";

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var httpContext = context.GetHttpContext();

        // Short-circuit: return 304 if ETag matches (skip function execution)
        if (httpContext is not null &&
            httpContext.Request.Headers.IfNoneMatch.ToString() == EtagValue)
        {
            httpContext.Response.StatusCode = 304;
            return;
        }

        await next(context);

        if (httpContext is not null)
        {
            httpContext.Response.Headers.CacheControl = "public, max-age=2592000, immutable";
            httpContext.Response.Headers.ETag = EtagValue;
        }
    }
}
```

**`Middleware/ExceptionHandlingMiddleware.cs`:**
```csharp
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Logging;

namespace Ishqnama.Functions.Middleware;

public sealed class ExceptionHandlingMiddleware(ILogger<ExceptionHandlingMiddleware> logger) : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            var httpContext = context.GetHttpContext();
            if (httpContext is not null)
            {
                httpContext.Response.StatusCode = 500;
                await httpContext.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
            }
        }
    }
}
```

---

## 3. Caching Strategy (without APIM or OutputCache)

| Current Layer | Replacement | Notes |
|---|---|---|
| OutputCache (server-side) | Removed (optional IMemoryCache) | IMemoryCache survives within warm instance; cleared on cold start |
| HTTP headers (Cache-Control + ETag) | **Same** via middleware | 30-day max-age + immutable + ETag (unchanged) |
| APIM gateway cache | **None** | HTTP headers drive browser caching directly |

### ETag Strategy

Assembly version-based static ETag (unchanged). `CacheHeaderMiddleware` checks `If-None-Match` before executing the function — returns 304 without database access.

### IMemoryCache (Optional)

Can be added to `QuranReadOnlyRepository` for small, frequently-accessed datasets (chapters, juz, translations). Not essential since:
- HTTP cache headers mean browsers rarely hit the server
- PostgreSQL queries are fast for small tables (< 10ms)

If needed later:
```csharp
return await cache.GetOrCreateAsync("chapters-all", async entry =>
{
    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24);
    return await db.Chapters.OrderBy(c => c.ChapterNumber).Select(c => c.ToDto()).ToListAsync();
}) ?? [];
```

---

## 4. CORS, Compression, Error Handling

### CORS

Since APIM is removed, CORS is handled at the Function App level via `host.json`:

```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": "api",
      "cors": {
        "allowedOrigins": [
          "https://your-swa-domain.azurestaticapps.net",
          "http://localhost:3000"
        ],
        "supportCredentials": false
      }
    }
  },
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      },
      "enableLiveMetricsFilters": true
    }
  }
}
```

Production CORS can also be set via Azure portal or Terraform.

### Response Compression

**No code needed.** Azure Functions Consumption plan handles compression at the platform/reverse proxy level automatically (Brotli/Gzip when client sends `Accept-Encoding`). Remove `AddResponseCompression`/`UseResponseCompression`.

### Error Handling

`ExceptionHandlingMiddleware` (shown above) replaces the current `GlobalExceptionHandler` (`IExceptionHandler`).

---

## 5. NuGet Packages Per Project

| Project | Packages |
|---|---|
| **Ishqnama.Domain** | None (zero dependencies) |
| **Ishqnama.Application** | None (project reference to Domain only) |
| **Ishqnama.Infrastructure** | `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.Extensions.DependencyInjection.Abstractions` |
| **Ishqnama.Functions** | `Microsoft.Azure.Functions.Worker`, `Microsoft.Azure.Functions.Worker.Extensions.Http.AspNetCore`, `Microsoft.Azure.Functions.Worker.Sdk`, `Microsoft.ApplicationInsights.WorkerService`, `Microsoft.Azure.Functions.Worker.ApplicationInsights` |

Use latest stable versions compatible with .NET 10 at implementation time.

---

## 6. Configuration

### `local.settings.json`

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated"
  },
  "ConnectionStrings": {
    "QuranDb": "Host=localhost;Port=5432;Database=ishqnama;Username=postgres;Password=postgres"
  }
}
```

- `AzureWebJobsStorage`: `UseDevelopmentStorage=true` for local dev with Azurite. In production, points to Azure Storage account (required for Consumption plan).
- `local.settings.json` is `.gitignore`d. Provide `local.settings.json.example` without credentials.

### Production App Settings (Azure portal / Terraform)

```
ConnectionStrings__QuranDb = "Host=<server>.postgres.database.azure.com;Port=5432;Database=ishqnama;..."
```

---

## 7. Migration Steps

### Step 1: Create project skeleton
1. Create 4 `.csproj` files with PropertyGroup and ItemGroup sections
2. Update `Ishqnama.slnx` to reference all 4 projects
3. Add `host.json` and `local.settings.json` to Functions project
4. Verify `dotnet build` succeeds

### Step 2: Move Domain entities
1. Create `src/Ishqnama.Domain/Entities/`
2. Copy 10 entity files from `src/Ishqnama.Api/Models/`
3. Change namespace: `Ishqnama.Api.Models` -> `Ishqnama.Domain.Entities`

### Step 3: Move Application layer
1. Copy DTOs from `Ishqnama.Api/Dtos/` to `Ishqnama.Application/Dtos/`
2. Copy `DtoMappings.cs` to `Ishqnama.Application/Mappings/`
3. Update namespaces and `using` directives
4. Create `IQuranReadOnlyRepository.cs` (new)
5. Create 5 service classes (new — logic extracted from endpoints)

### Step 4: Move Infrastructure layer
1. Copy `QuranDbContext.cs` to `Ishqnama.Infrastructure/Data/`
2. Copy 10 configuration files to `Ishqnama.Infrastructure/Data/Configurations/`
3. Update namespaces and `using` directives
4. Create `QuranReadOnlyRepository.cs` (new — logic from endpoint files + `EndpointHelpers.cs`)
5. Create `DependencyInjection.cs` (new)

### Step 5: Create Functions layer
1. Create `Program.cs` with DI wiring
2. Create 6 function classes
3. Create 2 middleware classes

### Step 6: Verify and clean up
1. `dotnet build` the solution
2. Run locally with `func start` + PostgreSQL
3. Test all endpoints match current API (same URLs, same response shapes)
4. Delete `src/Ishqnama.Api/` project folder
5. Remove old `Dockerfile`

---

## 8. What Changes vs. What Stays the Same

| Aspect | Changes | Stays the Same |
|---|---|---|
| Hosting | Minimal API -> Azure Functions isolated worker | .NET 10, C# |
| Response types | `TypedResults.Ok()` -> `Results.Ok()` | Same JSON shapes, same status codes |
| DI container | `WebApplication.CreateBuilder` -> `HostBuilder` | Same scoped lifetimes |
| Caching | OutputCache removed, HTTP headers only | Cache-Control and ETag headers unchanged |
| Compression | Removed from code (platform handles it) | Brotli/Gzip still applied |
| CORS | Added to host.json (was to be APIM) | N/A |
| Routes | `MapGroup("/api/chapters")` -> `Route = "chapters"` | Same URL paths (`/api/` prefix) |
| Query params | Minimal API binding -> Function params | Same param names/types |
| EF Core | Same DbContext, configs, NoTracking | Same queries |
| Entities/DTOs | Namespace change only | Identical sealed classes/records |
| Deployment | Container (ACA) -> Zip deploy (Functions) | N/A |

---

## 9. Trade-offs and Considerations

### Cold Starts (Consumption Plan)

Azure Functions Consumption plan has cold starts of ~5-15s for .NET isolated worker. Mitigations:
- HTTP cache headers (`max-age=2592000, immutable`) mean browsers cache for 30 days
- Frontend can use a service worker for prefetching
- Upgrade to Flex Consumption (pre-warmed instances) if cold starts become unacceptable

### No OutputCache — Is IMemoryCache Sufficient?

Yes. The dataset is small (~6,236 verses, 114 chapters), HTTP headers prevent most repeat requests, and PostgreSQL queries with indexes are < 10ms. No Redis or distributed cache needed.

### Why Not CQRS/MediatR?

Read-only API with 11 endpoints and no write operations. MediatR would add ~22 files replacing 5 service classes. No cross-cutting concerns that benefit from a pipeline. Simple Service + Repository is the right abstraction level.

### Query Parameter Binding

Azure Functions with ASP.NET Core integration supports query parameter binding via function params. If nullable optional params (`int? translationId = null`) don't bind correctly, fall back to reading from `HttpRequest.Query`.

### Deployment Model

Zip deploy (recommended for Consumption plan): `func azure functionapp publish <app-name>`. The existing `Dockerfile` is removed — container deploy requires Premium/Dedicated plan. For CI/CD, use `Azure/functions-action` GitHub Action.

### Route Prefix

Azure Functions auto-prefixes HTTP routes with `/api/` (configurable in `host.json` `extensions.http.routePrefix`). Current API also uses `/api/`, so routes match exactly.

---

## 10. Critical Files Reference

| Current File | Action | Destination |
|---|---|---|
| `src/Ishqnama.Api/Models/*.cs` (10) | Move + namespace change | `src/Ishqnama.Domain/Entities/` |
| `src/Ishqnama.Api/Dtos/*.cs` (7) | Move + namespace change | `src/Ishqnama.Application/Dtos/` |
| `src/Ishqnama.Api/Mappings/DtoMappings.cs` | Move + namespace change | `src/Ishqnama.Application/Mappings/` |
| `src/Ishqnama.Api/Data/QuranDbContext.cs` | Move + namespace change | `src/Ishqnama.Infrastructure/Data/` |
| `src/Ishqnama.Api/Data/Configurations/*.cs` (10) | Move + namespace change | `src/Ishqnama.Infrastructure/Data/Configurations/` |
| `src/Ishqnama.Api/Endpoints/*.cs` (5) | Logic consolidated into | `src/Ishqnama.Infrastructure/Repositories/QuranReadOnlyRepository.cs` |
| `src/Ishqnama.Api/Endpoints/EndpointHelpers.cs` | Logic absorbed into | `QuranReadOnlyRepository` (private helper) |
| `src/Ishqnama.Api/Program.cs` | Replaced by | `src/Ishqnama.Functions/Program.cs` |
| `src/Ishqnama.Api/Middleware/GlobalExceptionHandler.cs` | Replaced by | `src/Ishqnama.Functions/Middleware/ExceptionHandlingMiddleware.cs` |
| N/A (new) | Created | `src/Ishqnama.Application/Interfaces/IQuranReadOnlyRepository.cs` |
| N/A (new) | Created | `src/Ishqnama.Application/Services/*.cs` (5) |
| N/A (new) | Created | `src/Ishqnama.Infrastructure/DependencyInjection.cs` |
| N/A (new) | Created | `src/Ishqnama.Functions/Functions/*.cs` (6) |
| N/A (new) | Created | `src/Ishqnama.Functions/Middleware/*.cs` (2) |
| `Dockerfile` | Removed | N/A (zip deploy replaces container deploy) |
