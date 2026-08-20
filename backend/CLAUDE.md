# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ishqnama is a read-only .NET 10 API serving Quranic data (verses, translations, tafseer) in Arabic, English, Urdu, and Hindi. The API connects to an external PostgreSQL database (schema and data owned by the `database/` project). No mutations — just a data translation layer using Clean Architecture with Azure Functions as the presentation layer.

## Build & Run Commands

```bash
# Build
dotnet build

# Run locally (requires PostgreSQL + Azure Functions Core Tools)
cd src/Ishqnama.Functions && func start

# Database (pull pre-built image)
podman run -d --name ishqnama-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres docker.io/noormahdi/ishqnama-db:dev
```

SDK pinned to **10.0.300** via `global.json`.

## Architecture

Clean Architecture with 4 projects:

```
Functions  ──>  Application  ──>  Domain
           ──>  Infrastructure  ──>  Application
                                ──>  Domain
```

- **`Ishqnama.Domain`** — Sealed entity POCOs (10 entities). Zero dependencies.
- **`Ishqnama.Application`** — DTOs, `IQuranReadOnlyRepository` interface, `DtoMappings`, 5 service classes. Depends only on Domain.
- **`Ishqnama.Infrastructure`** — EF Core `QuranDbContext`, 10 entity configurations, `QuranReadOnlyRepository` implementation, `DependencyInjection.cs`. Depends on Domain + Application.
- **`Ishqnama.Functions`** — Azure Functions isolated worker (presentation layer). 6 HTTP trigger functions, 2 middleware (exception handling, cache headers). Composition root. Depends on Application + Infrastructure.

**Data flow:** HTTP request → Azure Function → Service → Repository (EF Core, NoTracking) → DTO mapping → JSON response

## Database

PostgreSQL with composite/natural keys. Schema and seed data live in `database/` project (SQL files run by postgres `docker-entrypoint-initdb.d`). The API is a read-only client — no EF Core migrations, no seeding logic.

Key entities: `Chapter` (1-114), `Verse` (ChapterNumber, VerseNumber), `Juz` (1-30), `Manzil` (1-7), `Ruku` (surrogate), `Translation`, `TranslationSegment`.

Connection string configured via `ConnectionStrings:QuranDb` in `local.settings.json` or `ConnectionStrings__QuranDb` env var.

## Caching

1. **HTTP headers** — `Cache-Control: public, max-age=2592000, immutable` + ETag (assembly version based) via `CacheHeaderMiddleware`
2. **ETag 304 short-circuit** — Middleware returns 304 without executing the function if `If-None-Match` matches
3. **IMemoryCache** — Registered but not actively used; available for future optimization

## Conventions

- All entities and DTOs are **sealed** (classes for entities, records for DTOs)
- All DB queries are **async** with **NoTracking**
- JSON outputs Unicode directly (no `\uXXXX` escaping) via `JavaScriptEncoder.Create(UnicodeRanges.All)`
- Nullable reference types enabled (`<Nullable>enable</Nullable>`)
- `CS8618` suppressed in Domain and Infrastructure (EF Core navigation properties)
- Tafseer `Explanation` field contains **raw HTML** (`<span lang="ar">`, `<ins>`) — preserve as-is
- All text is **NFC-normalized** Unicode
- `tools/SqlToJsonConverter/` is a one-time utility — do not modify unless re-converting source data

## API Endpoints

All under `/api/` (route prefix set in `host.json`). Key routes: `/chapters`, `/chapters/{num}/verses`, `/juz`, `/juz/{num}/verses`, `/rukus`, `/translations`, `/verses?from=&to=`, `/healthz`. Verse endpoints support `translationId`, `page`, `pageSize` query params. Default page size 50, max 200.

## Deployment

Azure Functions Consumption plan with zip deploy. CORS configured in `host.json`. Response compression handled by the Azure Functions platform automatically.
