# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ishqnama is a read-only .NET 10 Minimal API serving Quranic data (verses, translations, tafseer) in Arabic, English, Urdu, and Hindi. The API connects to an external PostgreSQL database (schema and data owned by the `database/` project). No mutations, no business logic — just a thin data translation layer.

## Build & Run Commands

```bash
# Build
dotnet build

# Run (requires PostgreSQL to be running — see Database section)
dotnet run --project src/Ishqnama.Api

# Docker (API only — needs database container)
docker build -t ishqnama-api:latest .
docker run -p 8000:8000 ishqnama-api:latest

# Database (from repo root)
docker build -t ishqnama-db:latest database/
docker run -d --name ishqnama-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres ishqnama-db:latest
```

SDK pinned to **10.0.300** via `global.json`. Swagger UI available in development at `/swagger`.

## Architecture

Single-project structure (`src/Ishqnama.Api/`) — no layered architecture because the API is read-only with no business logic.

**Key folders:**
- `Models/` — Sealed EF Core entity POCOs (10 entities)
- `Data/Configurations/` — One `IEntityTypeConfiguration<T>` per entity (Fluent API)
- `Endpoints/` — Minimal API groups using `MapGroup()` + `TypedResults`
- `Dtos/` — Sealed records for responses
- `Mappings/DtoMappings.cs` — Extension methods mapping entities to DTOs

**Data flow:** HTTP request → Endpoint → EF Core query (NoTracking) → DTO mapping → JSON response

## Database

PostgreSQL with composite/natural keys. Schema and seed data live in `database/` project (SQL files run by postgres `docker-entrypoint-initdb.d`). The API is a read-only client — no EF Core migrations, no seeding logic.

Key entities: `Chapter` (1-114), `Verse` (ChapterNumber, VerseNumber), `Juz` (1-30), `Manzil` (1-7), `Ruku` (surrogate), `Translation`, `TranslationSegment`.

Connection string configured via `ConnectionStrings:QuranDb` in `appsettings.json` or `ConnectionStrings__QuranDb` env var.

## Caching (4 layers)

1. **In-memory preload** — Chapters, Juz, Translations loaded as singletons at startup (zero DB queries)
2. **OutputCache** — Server-side with policies: `Immutable`, `ByVerse`, `SingleItem`, `SingleVerse` (24h expiry)
3. **HTTP headers** — `Cache-Control: public, max-age=2592000, immutable` + ETag (assembly version based)
4. **Azure APIM** — Gateway handles CORS, rate limiting, response caching (not configured in this codebase)

## Conventions

- All entities and DTOs are **sealed** (classes for entities, records for DTOs)
- All DB queries are **async** with **NoTracking**
- JSON uses **camelCase** via `JsonNamingPolicy.CamelCase` and outputs Unicode directly (no `\uXXXX` escaping)
- Nullable reference types enabled (`<Nullable>enable</Nullable>`)
- `CS8618` suppressed (EF Core navigation properties)
- Tafseer `Explanation` field contains **raw HTML** (`<span lang="ar">`, `<ins>`) — preserve as-is
- All text is **NFC-normalized** Unicode
- `tools/SqlToJsonConverter/` is a one-time utility excluded from Docker — do not modify unless re-converting source data

## API Endpoints

All under `/api/`. Key routes: `/chapters`, `/chapters/{num}/verses`, `/juz`, `/juz/{num}/verses`, `/rukus`, `/translations`, `/verses?from=&to=`, `/healthz`. Verse endpoints support `translationId`, `page`, `pageSize` query params. Default page size 50, max 200.

## Deployment

Multi-stage Docker build → Azure Container Apps. API container connects to PostgreSQL container via connection string. APIM is the public gateway; the API itself does not configure CORS.
