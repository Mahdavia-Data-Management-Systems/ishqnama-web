# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ishqnama is a .NET 9 API serving Quranic data (verses, translations, tafseer) in Arabic, English, Urdu, and Hindi, plus authenticated user data (settings, bookmarks, favorites, history). Uses Clean Architecture with two interchangeable presentation layers: Azure Functions (`Ishqnama.Functions`, deployed today) and an ASP.NET Core Minimal API (`Ishqnama.Api`, destined for Azure Container Apps). Both expose the same routes under `/api`. Two data stores: PostgreSQL (read-only Quran data) and Cosmos DB (read-write user data).

## Build & Run Commands

```bash
# Build
dotnet build

# Start databases (PostgreSQL + Cosmos DB Emulator) and the API container image
# --build is what picks up src/ changes; without it compose reuses the existing image
docker-compose up -d --build

# Run the Functions host locally (requires Azure Functions Core Tools) — http://localhost:7071/api
cd src/Ishqnama.Functions && func start

# Run the Minimal API locally — http://localhost:5080/api
# Development-only extras: Scalar UI at /scalar, OpenAPI document at /openapi/v1.json
dotnet run --project src/Ishqnama.Api

# The same API from the compose image is already on http://localhost:5081/api, so the two can
# run side by side

# Stop everything
docker-compose down
```

SDK pinned to **9.0.300** via `global.json`.

## Architecture

Clean Architecture with 5 projects:

```
Functions ─┐
           ├──>  Application  ──>  Domain
Api ───────┘──>  Infrastructure  ──>  Application
                                 ──>  Domain
```

- **`Ishqnama.Domain`** — Sealed entity POCOs. Quran entities (10: Chapter, Verse, Juz, etc.) + user data entities (4: UserSettings, UserBookmark, UserFavorite, UserHistoryEntry). Zero dependencies.
- **`Ishqnama.Application`** — DTOs, interfaces (`IQuranReadOnlyRepository`, `IUserDataRepository`), `DtoMappings`, service classes (5 Quran services + `UserDataService`). Depends only on Domain.
- **`Ishqnama.Infrastructure`** — EF Core `QuranDbContext` + 10 entity configurations, `CachedQuranReadOnlyRepository` (singleton, loads all Quran data into memory), `CosmosUserDataRepository` (Cosmos DB SDK), `DependencyInjection.cs`. Depends on Domain + Application.
- **`Ishqnama.Functions`** — Azure Functions isolated worker (presentation layer). 8 function classes: 12 Quran/health HTTP triggers + 8 user data triggers, 4 middleware (CORS, auth, exception handling, cache headers). Composition root. Depends on Application + Infrastructure.
- **`Ishqnama.Api`** — ASP.NET Core Minimal API (presentation layer, same 20 routes). `Endpoints/*Endpoints.cs` one static class per resource, `Middleware/CacheHeaderMiddleware` + `GlobalExceptionHandler`, `Json/IshqnamaJsonContext` (source-generated STJ), `Contracts/` (request records, `ErrorResponse`). Framework CORS, JwtBearer auth, response compression, health checks, OpenAPI + Scalar (Development only). Composition root. Depends on Application + Infrastructure. Reads the **same configuration keys** as Functions (`ConnectionStrings:QuranDb`, `CosmosDb:*`, `Auth:*`, `Cors:AllowedOrigins`) from `appsettings.Development.json` / environment variables.

**Quran data flow:** HTTP request → Azure Function / Minimal API endpoint → Service → CachedQuranReadOnlyRepository (in-memory) → DTO mapping → JSON response

**User data flow:** HTTP request → JWT validation (`AuthMiddleware` in Functions, JwtBearer in the API) → Azure Function / endpoint → UserDataService → CosmosUserDataRepository (Cosmos DB SDK) → JSON response

## Data Stores

### PostgreSQL (Quran Data — Read-Only)

Composite/natural keys. Schema and seed data live in `database/` project (SQL files run by postgres `docker-entrypoint-initdb.d`). The API is a read-only client — no EF Core migrations, no seeding logic.

Key entities: `Chapter` (1-114), `Verse` (ChapterNumber, VerseNumber), `Juz` (1-30), `Manzil` (1-7), `Ruku` (surrogate), `Translation`, `TranslationSegment`.

Connection string: `ConnectionStrings:QuranDb` in `local.settings.json` (Functions) / `appsettings.Development.json` (API), or the `ConnectionStrings__QuranDb` env var.

### Cosmos DB (User Data — Read-Write)

NoSQL API, single container `user-data` in database `ishqnama-userdata`, partitioned by `/userId`. Free tier (1000 RU/s + 25 GB).

Document types (discriminated by `type` field): `settings`, `bookmark`, `favorite`, `history`. All operations scoped to a single partition (userId).

Config: `CosmosDb__Endpoint`, `CosmosDb__Key`, `CosmosDb__DatabaseName`, `CosmosDb__ContainerName` (`local.settings.json` for Functions, `CosmosDb` section of `appsettings.Development.json` for the API). Cosmos DB registration is **conditional** in both hosts — they start without it if config values are empty (existing Quran endpoints still work).

## Authentication

JWT bearer auth protects `/api/user/*` and `/api/search`. Other Quran endpoints remain anonymous, but a valid token on them unlocks the tafseer (`Explanation` is stripped for anonymous callers by `AuthExtensions.StripExplanations`); an invalid token on an anonymous route is ignored, not rejected. Search requires auth to prevent abuse — and that is the only reason `SearchResultDto.Explanation` is never stripped.

- Uses OIDC discovery from the Entra ID External (CIAM) authority (`Auth__Authority`, ends in `/v2.0`)
- Validates `aud` claim against the **API** app registration (`Auth__ClientId`)
- User ID from the `oid` claim (falls back to `sub`)
- **Functions:** hand-rolled `AuthMiddleware` (`Microsoft.Identity.Web`), path-based; stores the id in `httpContext.Items["UserId"]`
- **API:** `AddJwtBearer` with `MapInboundClaims = false` so `oid`/`sub` keep their short names; `RequireAuthorization()` only on the `/user` group and `/search`; tokens with neither claim are failed in `OnTokenValidated`; `ClaimsPrincipal.GetUserId()` in `Helpers/AuthExtensions.cs`
- Config: `Auth__ClientId`, `Auth__Authority`

**Separate API app registration** (CIAM requirement): Entra ID External tenants don't support custom API scopes on the SPA app registration. A separate `Ishqnama API` app registration exposes the `access_as_user` scope.

## Middleware Pipeline

**Functions** — order: **CORS** → **Auth** → **ExceptionHandling** → **CacheHeaders**

1. `CorsMiddleware` — Handles `Access-Control-Allow-Origin/Methods/Headers` (supports GET, POST, PUT, DELETE, OPTIONS + Authorization header)
2. `AuthMiddleware` — JWT validation; rejects `/api/user/*` and `/api/search` without a valid token, passes through all other routes
3. `ExceptionHandlingMiddleware` — Catches unhandled exceptions, returns 500 JSON
4. `CacheHeaderMiddleware` — Sets `Cache-Control: public, max-age=2592000, immutable` + ETag; 304 short-circuit on `If-None-Match` match

**API** — order: `UseResponseCompression` → `UseExceptionHandler` (`GlobalExceptionHandler`, same 500 body) → `UseCors` (default policy from `Cors:AllowedOrigins`) → `UseAuthentication` → `UseAuthorization` → `CacheHeaderMiddleware` → endpoints. The cache middleware applies to `/api/*` except `/api/user/*` and `/api/healthz`; `/health/live` and `/health/ready` sit outside `/api` and are never cached. The CORS policy sets `Access-Control-Max-Age: 7200` (Chrome's cap), because the `Authorization` header preflights every signed-in call and without it browsers re-send the `OPTIONS` almost every time.

**API warm-up** — `Hosting/WarmUpService` (a `BackgroundService`, so it never delays startup or `/api/healthz`) fetches the Entra discovery document and signing keys through JwtBearer's own `ConfigurationManager`, and reads a nonexistent Cosmos document (`ReadItemStreamAsync`, ~1 RU) to load the client's metadata and open its connection. Both are otherwise lazy and would land on the first settings/bookmarks request after every cold start, which the keep-alive ping does not trigger. Best effort: failures are logged as warnings.

## Caching

1. **In-memory data preloading** — `CachedQuranReadOnlyRepository` (singleton) loads all Quran data from PostgreSQL on first request using `SemaphoreSlim` for thread safety. All subsequent queries run against in-memory lists — zero DB queries after initial load. Shared by both hosts.
2. **HTTP headers** — `Cache-Control: public, max-age=2592000, immutable` + ETag (assembly version based, suffixed `-a`/`-u` for authenticated/anonymous) + `Vary: Authorization` via `CacheHeaderMiddleware` in each host
3. **ETag 304 short-circuit** — Middleware returns 304 without executing the handler if `If-None-Match` matches

## Conventions

- All entities and DTOs are **sealed** (classes for entities, records for DTOs)
- All DB queries are **async** with **NoTracking**
- JSON outputs Unicode directly (no `\uXXXX` escaping) via `JavaScriptEncoder.Create(UnicodeRanges.All)`
- Cosmos DB uses `CosmosSerializationOptions` with `CamelCase` property naming
- Nullable reference types enabled (`<Nullable>enable</Nullable>`)
- `CS8618` suppressed in Domain and Infrastructure (EF Core navigation properties)
- Tafseer `Explanation` field contains **raw HTML** (`<span lang="ar">`, `<ins>`) — preserve as-is
- All text is **NFC-normalized** Unicode
- `tools/SqlToJsonConverter/` is a one-time utility — do not modify unless re-converting source data

## API Endpoints

All under `/api/` (route prefix set in `host.json` for Functions, `app.MapGroup("/api")` in the API). Both hosts serve the same routes with the same status codes and bodies.

### Quran Endpoints (Anonymous)

`/chapters?lang=`, `/chapters/{num}`, `/chapters/{num}/verses`, `/chapters/{num}/verses/{verseNum}`, `/juz`, `/juz/{num}/verses`, `/rukus?chapterNum=&juzNum=`, `/rukus/{id}/verses`, `/translations`, `/verses?from=&to=`, `/healthz`. Verse endpoints support `translationId`, `page`, `pageSize` query params. Default page size 50, max 200. The API additionally exposes `/health/live` and `/health/ready` (EF Core `CanConnect` check) for container probes.

### Search Endpoint (Authenticated — Bearer token required)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/search?q=&scope=&translationId=&page=&pageSize=` | Search translations/tafseer |

Query params: `q` (required, min 2 chars), `scope` (both/tarjuma/tafseer, default both), `translationId` (default 2), `page` (default 1), `pageSize` (default 20, max 50). Requires auth to prevent abuse.

### User Data Endpoints (Authenticated — Bearer token required)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/user/settings` | Get user settings (200 with empty body when none saved) |
| PUT | `/user/settings` | Save user settings (`UserSettingsDto` body) |
| GET | `/user/bookmarks` | List bookmarks |
| POST | `/user/bookmarks` | Create bookmark (`{ title, icon }`) → 201 + `Location`, 409 on duplicate title |
| PUT | `/user/bookmarks/{slug}/position` | Move bookmark (`{ chapterNumber, verseNumber }`) → 404 if slug unknown |
| DELETE | `/user/bookmarks/{slug}` | Remove bookmark (400 if it is the default one) |
| GET | `/user/history?limit=` | List reading history (default/fallback limit 50) |
| POST | `/user/history` | Record reading history (`{ title, url }`) |

Bookmarks are slug-keyed. There are no favorites endpoints. Error bodies are `{ "error": "..." }` on user routes; `/search` and `/verses` return a bare JSON string on 400.

## NuGet Packages

| Project | Key Packages |
|---------|-------------|
| **Domain** | None |
| **Application** | None |
| **Infrastructure** | `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.Azure.Cosmos` |
| **Functions** | `Microsoft.Azure.Functions.Worker`, `Microsoft.Azure.Functions.Worker.Extensions.Http.AspNetCore`, `Microsoft.Identity.Web` |
| **Api** | `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.OpenApi`, `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`, `Newtonsoft.Json`, `Scalar.AspNetCore` |

Note: `<AzureCosmosDisableNewtonsoftJsonCheck>true</AzureCosmosDisableNewtonsoftJsonCheck>` set in Infrastructure, Functions and Api `.csproj` files (uses built-in serialization, not Newtonsoft). Despite that, **every host that constructs a `CosmosClient` must reference `Newtonsoft.Json` explicitly** — the Cosmos SDK loads it at runtime without declaring it as a NuGet dependency, and the first user-data request otherwise fails with `FileNotFoundException: Newtonsoft.Json, Version=10.0.0.0`.

`Ishqnama.Api.csproj` enables the Minimal API request-delegate generator and, only when publishing (`_IsPublishing`), `linux-x64` self-contained + `PublishTrimmed` (`TrimMode=partial`). `dotnet build`/`dotnet run` remain framework-dependent.

## Deployment

**Functions:** Azure Functions Consumption plan with zip deploy. CORS handled by `CorsMiddleware`. Response compression handled by the Azure Functions platform automatically.

**API:** container image built from `src/Ishqnama.Api/Dockerfile` (build context `backend/`, `.dockerignore` alongside): SDK 9.0 build stage runs `dotnet publish` (self-contained, trimmed, linux-x64), runtime stage is `runtime-deps:9.0-noble-chiseled`, non-root, port 8080. `build-backend.yml` pushes it to Docker Hub: for non-prod environments as `noormahdi/ishqnama-api:<version>` and `:<environment>`, where `<version>` is a patch-bumped semantic version derived from `api-v*.*.*` git tags (same scheme as the ishqnama-db repo; the job also pushes the new git tag); for `prod` only as `:latest`, with no version or git tag. Terraform deploys it to Container Apps (`module.api` in `infra/environments/dev/ishqnama-api.tf`, scale-to-zero), pinned to that version via the `api_image_tag` variable that `ci.yml` feeds from the build output — Container Apps never re-pulls a re-pushed tag, so the reference must change for a new revision; the frontend calls this API; the Functions host is still deployed but unreferenced — see `plans/dotnet-api-container-apps-plan.md`. Brotli/Gzip compression and CORS are handled in-app because Container Apps provides neither.

Local image check — the `api` service in `docker-compose.yml` builds this Dockerfile and runs it
against the compose databases (`Host=postgres`, `https://cosmos:8081`) on host port 5081, leaving
8080 to the emulator and 5080 to `dotnet run`:

```bash
docker-compose up -d --build
curl http://localhost:5081/api/healthz
```

Compose does not notice source changes, so pass `--build` after editing anything under `src/` or the
container keeps serving the previously built image.

Reaching the Cosmos emulator over the compose network is why `AddUserDataInfrastructure` recognises
it by its published key as well as by a `localhost:8081` endpoint — that is the trigger for
accepting its self-signed certificate and forcing Gateway mode.
