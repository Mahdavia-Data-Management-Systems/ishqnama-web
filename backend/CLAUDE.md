# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ishqnama is a .NET 9 API serving Quranic data (verses, translations, tafseer) in Arabic, English, Urdu, and Hindi, plus authenticated user data (settings, bookmarks, favorites, history). Uses Clean Architecture with Azure Functions as the presentation layer. Two data stores: PostgreSQL (read-only Quran data) and Cosmos DB (read-write user data).

## Build & Run Commands

```bash
# Build
dotnet build

# Run locally (requires PostgreSQL + Azure Functions Core Tools)
cd src/Ishqnama.Functions && func start

# Database (pull pre-built image)
podman run -d --name ishqnama-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres docker.io/noormahdi/ishqnama-db:dev

# Full local dev (PostgreSQL + Cosmos DB emulator + func start)
bash start-local-db.sh
```

SDK pinned to **9.0.300** via `global.json`.

## Architecture

Clean Architecture with 4 projects:

```
Functions  ──>  Application  ──>  Domain
           ──>  Infrastructure  ──>  Application
                                ──>  Domain
```

- **`Ishqnama.Domain`** — Sealed entity POCOs. Quran entities (10: Chapter, Verse, Juz, etc.) + user data entities (4: UserSettings, UserBookmark, UserFavorite, UserHistoryEntry). Zero dependencies.
- **`Ishqnama.Application`** — DTOs, interfaces (`IQuranReadOnlyRepository`, `IUserDataRepository`), `DtoMappings`, service classes (5 Quran services + `UserDataService`). Depends only on Domain.
- **`Ishqnama.Infrastructure`** — EF Core `QuranDbContext` + 10 entity configurations, `CachedQuranReadOnlyRepository` (singleton, loads all Quran data into memory), `CosmosUserDataRepository` (Cosmos DB SDK), `DependencyInjection.cs`. Depends on Domain + Application.
- **`Ishqnama.Functions`** — Azure Functions isolated worker (presentation layer). 6 Quran HTTP trigger functions + 10 user data functions, 4 middleware (CORS, auth, exception handling, cache headers). Composition root. Depends on Application + Infrastructure.

**Quran data flow:** HTTP request → Azure Function → Service → CachedQuranReadOnlyRepository (in-memory) → DTO mapping → JSON response

**User data flow:** HTTP request → AuthMiddleware (JWT validation) → Azure Function → UserDataService → CosmosUserDataRepository (Cosmos DB SDK) → JSON response

## Data Stores

### PostgreSQL (Quran Data — Read-Only)

Composite/natural keys. Schema and seed data live in `database/` project (SQL files run by postgres `docker-entrypoint-initdb.d`). The API is a read-only client — no EF Core migrations, no seeding logic.

Key entities: `Chapter` (1-114), `Verse` (ChapterNumber, VerseNumber), `Juz` (1-30), `Manzil` (1-7), `Ruku` (surrogate), `Translation`, `TranslationSegment`.

Connection string: `ConnectionStrings:QuranDb` in `local.settings.json` or `ConnectionStrings__QuranDb` env var.

### Cosmos DB (User Data — Read-Write)

NoSQL API, single container `user-data` in database `ishqnama-userdata`, partitioned by `/userId`. Free tier (1000 RU/s + 25 GB).

Document types (discriminated by `type` field): `settings`, `bookmark`, `favorite`, `history`. All operations scoped to a single partition (userId).

Config: `CosmosDb__Endpoint`, `CosmosDb__Key`, `CosmosDb__DatabaseName`, `CosmosDb__ContainerName` in `local.settings.json`. Cosmos DB registration is **conditional** — backend starts without it if config values are empty (existing Quran endpoints still work).

## Authentication

JWT auth via `AuthMiddleware` — protects `/api/user/*` and `/api/search` routes. Other Quran endpoints remain anonymous. Search requires auth to prevent abuse.

- Uses OIDC discovery from Entra ID External (CIAM) authority
- Validates `aud` claim against the **API** app registration (`Auth__ClientId`)
- Extracts user ID from `oid` claim (falls back to `sub`), stores in `httpContext.Items["UserId"]`
- Config: `Auth__ClientId`, `Auth__TenantId`, `Auth__Authority` in `local.settings.json`
- NuGet: `Microsoft.Identity.Web` (provides OIDC discovery, JWT validation)

**Separate API app registration** (CIAM requirement): Entra ID External tenants don't support custom API scopes on the SPA app registration. A separate `Ishqnama API` app registration exposes the `access_as_user` scope.

## Middleware Pipeline

Order: **CORS** → **Auth** → **ExceptionHandling** → **CacheHeaders**

1. `CorsMiddleware` — Handles `Access-Control-Allow-Origin/Methods/Headers` (supports GET, POST, PUT, DELETE, OPTIONS + Authorization header)
2. `AuthMiddleware` — JWT validation for `/api/user/*` routes only; passes through all other routes
3. `ExceptionHandlingMiddleware` — Catches unhandled exceptions, returns 500 JSON
4. `CacheHeaderMiddleware` — Sets `Cache-Control: public, max-age=2592000, immutable` + ETag; 304 short-circuit on `If-None-Match` match

## Caching

1. **In-memory data preloading** — `CachedQuranReadOnlyRepository` (singleton) loads all Quran data from PostgreSQL on first request using `SemaphoreSlim` for thread safety. All subsequent queries run against in-memory lists — zero DB queries after initial load.
2. **HTTP headers** — `Cache-Control: public, max-age=2592000, immutable` + ETag (assembly version based) via `CacheHeaderMiddleware`
3. **ETag 304 short-circuit** — Middleware returns 304 without executing the function if `If-None-Match` matches

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

All under `/api/` (route prefix set in `host.json`).

### Quran Endpoints (Anonymous)

`/chapters`, `/chapters/{num}/verses`, `/juz`, `/juz/{num}/verses`, `/rukus`, `/translations`, `/verses?from=&to=`, `/healthz`. Verse endpoints support `translationId`, `page`, `pageSize` query params. Default page size 50, max 200.

### Search Endpoint (Authenticated — Bearer token required)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/search?q=&scope=&translationId=&page=&pageSize=` | Search translations/tafseer |

Query params: `q` (required, min 2 chars), `scope` (both/tarjuma/tafseer, default both), `translationId` (default 2), `page` (default 1), `pageSize` (default 20, max 50). Requires auth to prevent abuse.

### User Data Endpoints (Authenticated — Bearer token required)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/user/settings` | Get user settings |
| PUT | `/user/settings` | Save user settings |
| GET | `/user/bookmarks` | List bookmarks |
| POST | `/user/bookmarks` | Add bookmark |
| DELETE | `/user/bookmarks/{chapter}/{verse}` | Remove bookmark |
| GET | `/user/favorites` | List favorites |
| POST | `/user/favorites` | Add favorite |
| DELETE | `/user/favorites/{chapter}/{verse}` | Remove favorite |
| GET | `/user/history` | List reading history (query: `limit`) |
| POST | `/user/history` | Record reading history |

## NuGet Packages

| Project | Key Packages |
|---------|-------------|
| **Domain** | None |
| **Application** | None |
| **Infrastructure** | `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.Azure.Cosmos` |
| **Functions** | `Microsoft.Azure.Functions.Worker`, `Microsoft.Azure.Functions.Worker.Extensions.Http.AspNetCore`, `Microsoft.Identity.Web` |

Note: `<AzureCosmosDisableNewtonsoftJsonCheck>true</AzureCosmosDisableNewtonsoftJsonCheck>` set in Infrastructure and Functions `.csproj` files (uses built-in serialization, not Newtonsoft).

## Deployment

Azure Functions Consumption plan with zip deploy. CORS handled by `CorsMiddleware`. Response compression handled by the Azure Functions platform automatically.
