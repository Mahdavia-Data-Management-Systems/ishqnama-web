# Plan: create the `Ishqnama.Api` project (Minimal API port of `Ishqnama.Functions`)

> **Status: IMPLEMENTED (uncommitted).** Local verification complete except the token-dependent checks (bookmark lifecycle, authenticated tafseer/search, frontend smoke test), which need a signed-in dev-tenant user.
>
> Extracted from `plans/dotnet-api-container-apps-plan.md`, section "PR 3 — `Ishqnama.Api` on
> Container Apps → New project". This plan covers **only the .NET project itself** and its local
> verification. The Dockerfile, docker-compose `api` service, Terraform, CI image build and the
> `api.dev.ishqnama.com` domain stay in the parent plan and are listed under "Out of scope" below.

## Context

The parent plan moves the backend from Azure Functions to an ASP.NET Core Minimal API container that
scales to zero on Azure Container Apps, so the Azure bill reaches $0. That plan bundles the new
project with its image, infrastructure and CI into one PR. This plan carves out the first, purely
code-level slice: a new `backend/src/Ishqnama.Api` project that exposes the same 20 HTTP endpoints as
`backend/src/Ishqnama.Functions`, under the same `/api` prefix, with the same auth, caching and
tafseer-gating behaviour, so `frontend/src/lib/api-client.ts` needs no change.

`Ishqnama.Application` and `Ishqnama.Domain` are **not modified**. `Ishqnama.Infrastructure` is
**not modified** by this plan either: the API calls the existing `AddInfrastructure(connectionString)`
and `AddUserDataInfrastructure(...)` from `backend/src/Ishqnama.Infrastructure/DependencyInjection.cs`
and does not care whether the connection string is Postgres (today) or SQLite (after the parent plan's
PR 1). The project therefore builds and runs on `main` as it is now.

### Decisions carried over from the parent plan

| Decision | Choice |
|---|---|
| Framework | `net9.0`, SDK pinned by `backend/global.json` (9.0.300). |
| Auth | Idiomatic `AddAuthentication().AddJwtBearer()` + `RequireAuthorization()` on the protected route groups. |
| Route prefix | `app.MapGroup("/api")` reproduces `host.json`'s `"routePrefix": "api"`. |
| JSON | System.Text.Json with a source-generated `IshqnamaJsonContext` (trim safety) and `JavaScriptEncoder.Create(UnicodeRanges.All)`. |
| Extras | OpenAPI + Scalar UI in Development only; response compression; health endpoints for ACA probes. |
| Publish shape | Self-contained, `linux-x64`, `PublishTrimmed=true`, `TrimMode=partial`. Set in the csproj now; only exercised by `dotnet publish`, so `dotnet run` is unaffected. |
| Not added | Application Insights, `AddMemoryCache()` (registered in Functions but consumed by nothing). |

### Facts from the current code that shape the port

- **Auth is path-based today.** `Middleware/AuthMiddleware.cs:41` protects `/api/user` and `/api/search`;
  a valid token on any other route sets `HttpContext.Items["IsAuthenticated"]`, an invalid token on an
  anonymous route is ignored. JwtBearer gives exactly this when `RequireAuthorization()` is applied only
  to the protected groups: authentication runs on every request, but only authorization challenges.
- **User id** comes from `oid`, falling back to `sub` (`AuthMiddleware.cs:105-107`). JwtBearer remaps
  those claim types by default, so `MapInboundClaims = false` is required.
- **Tafseer gating** lives only in `Helpers/AuthExtensions.cs` (`StripExplanations` on `VerseDto`,
  `List<VerseDto>`, `PagedResponse<VerseDto>`), called from the chapter, juz, ruku and verse functions.
  `SearchResultDto.Explanation` is never stripped because search is auth-gated. Both must survive.
- **Cache headers** (`Middleware/CacheHeaderMiddleware.cs`): ETag `"v2-{InformationalVersion}-a|u"`,
  `Cache-Control: public, max-age=2592000, immutable`, `Vary: Authorization`, `If-None-Match` → 304
  short-circuit before the handler; applied to everything except `/api/user`.
- **Request records** `CreateBookmarkRequest`, `UpdatePositionRequest`, `HistoryRequest` are `private`
  nested records in `Functions/UserDataFunctions.cs:140-142`; they must become public top-level types
  for body binding and the JSON source generator.
- **Error bodies are inconsistent** today: user endpoints return `{ "error": "..." }` objects; search and
  verses return `Results.BadRequest(string)`, a bare JSON string. The frontend never reads error bodies
  (`api-client.ts` throws `ApiError(status, statusText)`), so the port preserves each as-is for parity.
- **Response compression** is done by the Functions platform today (`backend/CLAUDE.md` Deployment
  section); Kestrel does not compress by default, so the API must add it.
- **`GET /api/healthz`** returns `{ "status": "healthy" }`. `frontend/src/lib/api.ts:148` defines
  `getHealth` for it but nothing calls it; keep the endpoint for parity anyway.
- **Ports:** `backend/docker-compose.yml` already maps the Cosmos emulator to host port 8080, so the
  API's local launch profile must not use 8080.

---

## Files to create

All under `backend/src/Ishqnama.Api/`.

### `Ishqnama.Api.csproj`

- `Microsoft.NET.Sdk.Web`, `net9.0`, `Nullable`, `ImplicitUsings`, `AzureCosmosDisableNewtonsoftJsonCheck=true`
  (same reason as `Ishqnama.Functions.csproj`).
- Footprint: `InvariantGlobalization=true`, `ServerGarbageCollection=false`,
  `ConcurrentGarbageCollection=false`, `TieredPGO=true`.
- Publish: `RuntimeIdentifier=linux-x64`, `SelfContained=true`, `PublishTrimmed=true`, `TrimMode=partial`.
- ProjectReferences: `../Ishqnama.Application`, `../Ishqnama.Infrastructure`.
- Packages (9.0.x): `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.OpenApi`,
  `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` (for `AddDbContextCheck`),
  `Scalar.AspNetCore` (latest stable).

### `Program.cs`

Configuration keys **identical to Functions** so the same environment variables work for both hosts:
`ConnectionStrings:QuranDb` (required, throw like `Functions/Program.cs:30-31`), `CosmosDb:{Endpoint,Key,DatabaseName,ContainerName}`
(defaults `ishqnama-userdata` / `user-data`), `Auth:{ClientId,Authority}`, `Cors:AllowedOrigins`.

Services, in order:

1. `ConfigureHttpJsonOptions`: `Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)`;
   `TypeInfoResolverChain.Insert(0, IshqnamaJsonContext.Default)`.
2. `AddInfrastructure(connectionString)`.
3. `AddUserDataInfrastructure(...)` under the same null/empty guard as `Functions/Program.cs:40`.
4. The seven Application services as scoped, exactly `Functions/Program.cs:46-52`
   (`ChapterService`, `JuzService`, `RukuService`, `TranslationService`, `VerseService`,
   `SearchService`, `UserDataService`). No `AddMemoryCache()`.
5. `AddCors`: one default policy from the comma-separated `Cors:AllowedOrigins` (trim, drop empties),
   `WithMethods("GET","POST","PUT","DELETE","OPTIONS")`, `WithHeaders("Content-Type","Accept","Authorization")`.
   Mirrors `Middleware/CorsMiddleware.cs`; no credentials, no exposed headers, same as today.
6. `AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o => { o.Authority = authority;
   o.Audience = clientId; o.MapInboundClaims = false; o.TokenValidationParameters.ValidateIssuer/Audience/
   Lifetime/IssuerSigningKey = true; })`. The authority already ends in `/v2.0`, so metadata resolves to
   the same `.well-known/openid-configuration` URL the current middleware builds.
7. `AddAuthorization()`.
8. `AddResponseCompression`: Brotli + Gzip providers, `EnableForHttps = true`, MIME types = defaults + `application/json`.
9. `AddHealthChecks().AddDbContextCheck<QuranDbContext>()` (`Ishqnama.Infrastructure.Data`).
10. `AddExceptionHandler<GlobalExceptionHandler>()` + `AddProblemDetails()` is **not** used; the handler
    writes the legacy body itself (see Middleware below).
11. `if (builder.Environment.IsDevelopment()) AddOpenApi()`.

Pipeline: `UseResponseCompression` → `UseExceptionHandler()` → `UseCors` → `UseAuthentication` →
`UseAuthorization` → `UseMiddleware<CacheHeaderMiddleware>` → endpoints.

Endpoints: `var api = app.MapGroup("/api");` then `api.MapChapterEndpoints()`, `MapJuzEndpoints()`,
`MapRukuEndpoints()`, `MapTranslationEndpoints()`, `MapVerseEndpoints()`, `MapSearchEndpoints()`,
`MapUserDataEndpoints()`, `MapHealthEndpoints()`; plus `app.MapHealthChecks("/health/ready")` and
`app.MapGet("/health/live", () => Results.Ok())` outside the `/api` group. In Development:
`app.MapOpenApi()` and `app.MapScalarApiReference()` (`/scalar`).

### `Endpoints/*.cs`

One `internal static class XEndpoints` with `public static RouteGroupBuilder MapXEndpoints(this RouteGroupBuilder group)`
per resource. Handler bodies port line-for-line from `backend/src/Ishqnama.Functions/Functions/*.cs`;
those already return `IResult` and take `HttpRequest`, so the change is the binding surface. Use
`TypedResults` so the generic result type is known to the JSON source generator.

| File | Routes (relative to `/api`) | Notes |
|---|---|---|
| `ChapterEndpoints.cs` | `GET chapters?lang=`, `GET chapters/{num:int}`, `GET chapters/{num:int}/verses?translationId=&page=1&pageSize=50`, `GET chapters/{num:int}/verses/{verseNum:int}` | `.AllowAnonymous()`; strip explanations when `!httpContext.User.IsAuthenticated()`. |
| `JuzEndpoints.cs` | `GET juz`, `GET juz/{num:int}/verses?...` | anonymous; strip. |
| `RukuEndpoints.cs` | `GET rukus?chapterNum=&juzNum=`, `GET rukus/{id:int}/verses?translationId=` | anonymous; strip. |
| `TranslationEndpoints.cs` | `GET translations` | anonymous. |
| `VerseEndpoints.cs` | `GET verses?from=&to=&translationId=` | anonymous; strip; `VerseService.TryParseVerseRef` → 400 with the existing bare-string message. |
| `SearchEndpoints.cs` | `GET search?q=&scope=&translationId=&page=&pageSize=` | `.RequireAuthorization()`; keep `ValidScopes`, defaults (`both`, 2, 1, 20) and the bare-string 400 from `SearchFunction.cs:11-25`. |
| `UserDataEndpoints.cs` | `GET/PUT user/settings`, `GET/POST user/bookmarks`, `PUT user/bookmarks/{slug}/position`, `DELETE user/bookmarks/{slug}`, `GET/POST user/history?limit=` | `.RequireAuthorization()`; user id from `ClaimsPrincipal` helper; status codes, `Location` (`/user/bookmarks/{slug}`, unchanged), 409/404/400 mappings and `{ error }` bodies exactly as `UserDataFunctions.cs`. Body parameters declared **nullable** (`UserSettingsDto? body`) so a null body yields the existing `{ "error": "Invalid request body." }` instead of the framework's empty 400. `limit` bound as `string?` and `int.TryParse`d with fallback 50, matching `UserDataFunctions.cs:118`. |
| `HealthEndpoints.cs` | `GET healthz` | anonymous; returns `HealthResponse("healthy")` → `{ "status": "healthy" }`. |

### `Contracts/`

- `Requests.cs`: `public sealed record CreateBookmarkRequest(string Title, string Icon)`,
  `UpdatePositionRequest(int ChapterNumber, int VerseNumber)`, `HistoryRequest(string Title, string Url)`
  — lifted verbatim from `UserDataFunctions.cs:140-142`, made public.
- `ErrorResponse.cs`: `public sealed record ErrorResponse(string Error)` replacing the anonymous
  `new { error = "..." }` objects (source-gen cannot see anonymous types).
- `HealthResponse.cs`: `public sealed record HealthResponse(string Status)`.

### `Helpers/AuthExtensions.cs`

Port of `Functions/Helpers/AuthExtensions.cs`:
- `IsAuthenticated(this ClaimsPrincipal user) => user.Identity?.IsAuthenticated == true`.
- `GetUserId(this ClaimsPrincipal user)`: `FindFirstValue("oid")`, else `FindFirstValue("sub")`; throw
  `InvalidOperationException` if both missing (cannot happen behind `RequireAuthorization`, but keeps
  the null-forgiving cast in `UserDataFunctions.cs:11` honest).
- The three `StripExplanations` overloads copied unchanged.

### `Middleware/CacheHeaderMiddleware.cs`

Port of the Functions version as an ASP.NET Core middleware (`RequestDelegate next`):
- Skip when the path starts with `/api/user`, `/api/healthz`, or `/health` — a probe target must not
  carry a 30-day immutable cache (new exclusion relative to Functions; everything else unchanged).
- ETag from `typeof(CacheHeaderMiddleware).Assembly` `AssemblyInformationalVersionAttribute`,
  `"v2-{version}-a"` / `"v2-{version}-u"` chosen by `context.User.IsAuthenticated()`.
- `If-None-Match` match → `304` with the three headers, no `next`. Otherwise `next`, then set
  `Cache-Control: public, max-age=2592000, immutable`, `ETag`, `Vary: Authorization` (use
  `context.Response.OnStarting` so headers are set even when the handler has begun writing).

### `Middleware/GlobalExceptionHandler.cs`

`IExceptionHandler`: `LogError(ex, "Unhandled exception: {Message}", ex.Message)`, `500`,
`WriteAsJsonAsync(new ErrorResponse("An unexpected error occurred."))`, return `true`. Same wording as
`Middleware/ExceptionHandlingMiddleware.cs`.

### `Json/IshqnamaJsonContext.cs`

`[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]` and one
`[JsonSerializable]` per type that crosses the wire. From `Ishqnama.Application/Dtos/`: `ChapterDto`,
`ChapterDetailDto`, `ChapterTranslationDto`, `JuzDto`, `RukuDto`, `TranslationDto`, `VerseDto`,
`TranslationSegmentDto`, `SearchResultDto`, `UserSettingsDto`, `UserBookmarkDto`, `UserHistoryDto`;
closures `List<ChapterDto>`, `List<JuzDto>`, `List<RukuDto>`, `List<TranslationDto>`, `List<VerseDto>`,
`PagedResponse<VerseDto>`, `PagedResponse<SearchResultDto>`, and both `List<T>` **and**
`IReadOnlyList<T>` for `UserBookmarkDto` / `UserHistoryDto` (services declare `IReadOnlyList<T>`; the
runtime type is `List<T>`); plus `CreateBookmarkRequest`, `UpdatePositionRequest`, `HistoryRequest`,
`ErrorResponse`, `HealthResponse`, `string` (the bare-string 400s).

### Configuration files

- `appsettings.json`: logging defaults only (`Default: Information`, `Microsoft.AspNetCore: Warning`),
  `AllowedHosts: *`.
- `appsettings.Development.json`: mirrors `Functions/local.settings.json.example` — `ConnectionStrings:QuranDb`
  = the docker-compose Postgres string today (switch to `Data Source=../../data/quran.db;Mode=ReadOnly`
  once the parent plan's PR 1 lands), the public emulator `CosmosDb` endpoint/key/names,
  `Cors:AllowedOrigins = http://localhost:3000`, the dev CIAM `Auth:Authority` and `Auth:ClientId`.
  None of these are secrets (the emulator key is Microsoft's published constant), so no `.gitignore`
  change is needed; note this in the file header comment.
- `Properties/launchSettings.json`: one `http` profile, `applicationUrl = http://localhost:5080`,
  `ASPNETCORE_ENVIRONMENT=Development`, `launchBrowser=false`. 8080 is taken by the Cosmos emulator and
  7071 by `func start`, so both hosts can run side by side for diffing.

## Files to modify

- `backend/Ishqnama.slnx`: add `<Project Path="src/Ishqnama.Api/Ishqnama.Api.csproj" />` inside the
  existing `/src/` folder, after the Functions entry.
- `backend/CLAUDE.md`: Build & Run gains `dotnet run --project src/Ishqnama.Api` (Scalar at `/scalar`,
  OpenAPI at `/openapi/v1.json`); Architecture lists `Ishqnama.Api` as a second presentation layer next
  to Functions and notes both are composition roots; Authentication section mentions JwtBearer for the
  API; fix the stale user-data endpoint table (no favorites endpoints exist; bookmarks are slug-keyed
  with `PUT /user/bookmarks/{slug}/position`; drop the unused `Auth__TenantId`).
- Root `CLAUDE.md`: backend line and run commands mention the API project alongside Functions.
- `plans/dotnet-api-container-apps-plan.md`: under "PR 3 → New project", add one line pointing to this
  plan as the detailed spec so the two do not drift.

## Out of scope (stays in the parent plan)

Dockerfile and `backend/.dockerignore`; `api` service in `backend/docker-compose.yml`; `quran.db`
export and the SQLite switch (PR 1); Terraform `module "api"`, custom domain and Cloudflare rules;
`build-api-image.yml` and `ci.yml` wiring; frontend `NEXT_PUBLIC_API_URL` cutover; removal of Functions.

---

## Verification

All local, against the docker-compose Postgres and Cosmos emulator. Run `func start` in
`src/Ishqnama.Functions` (port 7071) and `dotnet run --project src/Ishqnama.Api` (port 5080) at the
same time and diff.

1. `dotnet build` in `backend/` succeeds with zero warnings from the new project.
2. `/scalar` and `/openapi/v1.json` respond in Development; neither route exists when
   `ASPNETCORE_ENVIRONMENT=Production`.
3. Curl every endpoint on both hosts and diff the JSON bodies (anonymous): `/api/chapters`,
   `/api/chapters?lang=ur`, `/api/chapters/2`, `/api/chapters/2/verses?translationId=2&page=2&pageSize=10`,
   `/api/chapters/2/verses/255`, `/api/juz`, `/api/juz/1/verses`, `/api/rukus?chapterNum=2`,
   `/api/rukus/1/verses`, `/api/translations`, `/api/verses?from=2:1&to=2:5`, `/api/healthz`.
   Arabic/Urdu text must appear unescaped in both.
4. Tafseer gating: anonymous `/api/chapters/2/verses?translationId=2` has `explanation: null` on every
   segment; with a valid dev-tenant bearer token it is populated; with a garbage bearer token the
   response is 200 and stripped, not 401.
5. Error parity: `/api/verses?from=abc&to=2:5` → 400 bare string; `/api/search?q=a` with a token → 400
   bare string; `/api/search?q=mercy` without a token → 401; `PUT /api/user/settings` with empty body →
   400 `{ "error": "Invalid request body." }`.
6. Bookmark lifecycle with a token: `POST /api/user/bookmarks` → 201 with `Location: /user/bookmarks/{slug}`;
   repeat → 409; `PUT .../{slug}/position` → 200; bad position → 400; unknown slug → 404 with the
   `Bookmark '…' not found.` body; `DELETE` → 200. `GET/POST /api/user/history?limit=abc` → 200 (falls back to 50).
7. Caching: second request with `If-None-Match` set to the returned ETag → 304 with `Cache-Control`,
   `ETag`, `Vary: Authorization`; the ETag differs between anonymous and authenticated calls;
   `/api/healthz`, `/health/live`, `/health/ready` and `/api/user/*` carry **no** `Cache-Control` header.
8. CORS: `OPTIONS /api/chapters` with `Origin: http://localhost:3000` → 204 with the three
   `Access-Control-Allow-*` headers; an unlisted origin gets none.
9. Compression: `curl -H "Accept-Encoding: br" -I /api/chapters/2/verses` returns `Content-Encoding: br`.
10. Health: `/health/live` → 200 immediately; `/health/ready` → 200 `Healthy` while Postgres is up, 503
    after `docker stop ishqnama-db`; `/api/healthz` still 200 in both cases (it has no dependency).
11. Frontend smoke test: set `NEXT_PUBLIC_API_URL=http://localhost:5080/api` in `frontend/.env.local`,
    `npm run dev`, sign in, open a sura, toggle tafseer, add and delete a bookmark, run a search.
    Revert the env var afterwards.
12. Trim/publish check (no container needed): `dotnet publish src/Ishqnama.Api -c Release` from
    `backend/` completes with no `IL2xxx` trim warnings escalated to errors; note any warnings from
    EF Core or the Cosmos SDK for the parent plan's Dockerfile step. Confirm the output contains
    `Ishqnama.Api` (native host) and `libe_sqlite3.so` only if PR 1 has already switched to SQLite.

## Delivery

One PR: "feat(api): add Ishqnama.Api minimal API project". Dev deployment is unaffected — nothing in
`ci.yml` builds or ships the new project yet; `dotnet build` on the solution in the `build` job now
compiles it, which is the only CI-visible effect.
