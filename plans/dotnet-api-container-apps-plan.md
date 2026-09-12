# Ishqnama backend to $0 — SQLite-embedded data, Minimal API on Container Apps

> **Status: PLAN — awaiting review. No implementation has started.**

## Context

The backend today is `backend/src/Ishqnama.Functions` (Azure Functions, Consumption) reading Quran
data from a PostgreSQL container on Azure Container Apps, plus Cosmos DB free tier for user data.

**The purpose of this work is to bring the Azure bill to $0.** The one recurring cost is the
PostgreSQL container app: it runs `min_replicas = 1` at 0.25 vCPU / 0.5 GiB around the clock —
roughly 650k vCPU-seconds and 1.3M GiB-seconds a month against ACA's free grant of 180k and 360k. It
also drags in a VNet-integrated (workload-profiles) environment, because TCP ingress on 5432 needs
one. Everything else is already free or fractions of a cent (see the cost model below).

The dataset does not justify a database server. It is 114 chapters, 6,350 verses, 556 rukus, 3
translations and 22,257 translation segments — 36 MB of text, 43 MB on disk. It is read-only and
effectively immutable, and the current code already treats Postgres as a bootstrap source that it
reads once into memory. So the data moves **inside the application** as a SQLite file, Postgres and
the VNet are destroyed, and the presentation layer moves from Functions to an ASP.NET Core Minimal API
container that **scales to zero** on ACA Consumption — the only way an always-available API fits in
the free grant.

The migration is sequenced so the cost drops **before** the new API goes live: Functions itself
switches to SQLite first, Postgres is torn down, and only then is the API added alongside Functions
for verification, with the frontend flipped last.

`Ishqnama.Application` and `Ishqnama.Domain` are not modified. `Ishqnama.Infrastructure` changes
provider; its `QuranDbContext` and all ten entity configurations carry over unchanged.

### Decisions made with the user

| Decision | Choice |
|---|---|
| Goal | **$0/month on Azure** using free tiers only. Drives every choice below. |
| Quran data | **SQLite file embedded in the application** — no database server. |
| Query model | **Query SQLite directly** via the existing `QuranReadOnlyRepository` (scoped). No in-memory preload — it would cost 2–4 s on every scale-from-zero and hundreds of MB of RSS for nothing, now that the data is on local disk. This reverses the earlier "keep preload" choice, which assumed Postgres over the network. |
| Where `quran.db` comes from | **Generated in CI** from the `noormahdi/ishqnama-db:dev` image (as a GitHub Actions service container) by a small exporter tool, uploaded as a workflow artifact and consumed by both the Functions deploy and the API image build. Nothing binary in git. |
| Functions in the interim | **Switches to SQLite too**, so Postgres and the VNet are destroyed before the API exists. |
| Target framework | `net9.0` everywhere (overrides the original ".NET 10" ask). `global.json` unchanged. |
| Auth | Idiomatic `AddAuthentication().AddJwtBearer()` + `RequireAuthorization()` on protected route groups. |
| Publish | Self-contained, trimmed (`TrimMode=partial`), `linux-x64`, chiseled base image. |
| Extras | OpenAPI + **Scalar** UI (Development only), response compression, health endpoints for ACA probes. |
| ACA topology | New Consumption-only environment via the **existing `aca` module unchanged**. The earlier "split the module and share one environment" decision is **superseded** — there is no longer a second app to share with, and no `moved` blocks or state migration are needed. |
| Network | **No VNet anywhere.** The VNet existed only because Postgres needed TCP ingress; the API needs HTTP ingress only, which ACA provides publicly on a Consumption environment with a free Azure-managed certificate. A `cloudflared` sidecar was considered and rejected — see Trade-offs. |
| Hosting | `api.dev.ishqnama.com` as a **Cloudflare-proxied CNAME in front of ACA's public ingress**: Cloudflare terminates TLS at the edge, ACA holds a self-signed origin certificate, SSL mode `Full` scoped to that hostname. Keeps scale-to-zero. API image built only when `backend/` changes; image stays public on the existing `noormahdi/ishqnama-api` Docker Hub repo. |
| Cutover | Frontend stays on Functions until the API is verified in dev (Phase 2 below). |

### Cost model

| Resource | Today | After Phase 2 |
|---|---|---|
| ACA workload-profiles env + VNet + Postgres app (always-on) | **~$4/mo at ACA's idle rate, up to ~$15/mo if billed as active** — the cost | removed |
| ACA Consumption env + API app, `min_replicas = 0` | — | $0 inside the free grant (180k vCPU-s, 360k GiB-s, 2M requests / month) |
| Functions Y1 plan + storage account + App Insights + Log Analytics | ~$0.05–0.10 (storage) | removed |
| Cosmos DB free tier (400 RU/s of 1000 RU/s grant, 25 GB) | $0 | $0 |
| Static Web App Free | $0 | $0 |
| Key Vault standard (a few hundred ops/month) | ~$0.00 | ~$0.00 |
| Log Analytics (one workspace, < 5 GB/month) | $0 | $0 |
| Cloudflare DNS, Docker Hub, Terraform Cloud, GitHub Actions | $0 | $0 |

Figures are estimates from list pricing; the verification section includes checking Cost Management
after the teardown. The ACA free grant is per subscription per month, shared by all container apps.

### Trade-offs accepted

- **Cold starts.** A scale-from-zero on ACA typically takes a few seconds of platform time before the
  container even starts; the app itself will add ~1 s (self-contained, no preload, SQLite opens
  instantly). The first request after idle will be noticeably slow. This is the price of $0.
- **Search semantics.** SQLite `LIKE` is case-insensitive for ASCII only, where Postgres `ILIKE` and the
  current in-memory `OrdinalIgnoreCase` handle all of Unicode. Arabic, Urdu and Hindi have no case, and
  the English translation is ASCII, so results are identical for this dataset; only non-ASCII Latin
  (é/É) would differ. Acceptable.
- **Trimming risk.** EF Core and the Cosmos SDK are not fully trim-safe. Mitigations: source-generated
  JSON for every DTO, `TrimMode=partial`, concrete records instead of anonymous objects. Fallback if
  runtime failures appear: drop `PublishTrimmed`, stay self-contained on the chiseled image.
- **No `cloudflared` sidecar tunnel.** It would hide the origin and reuse the existing
  `infra/modules/cloudflare/tunnel*` modules, but ACA only scales a Consumption app from zero on
  requests through *its own* ingress. A tunnel is an outbound connection from a container that, at
  zero replicas, is not running — nothing would ever wake the app. The sidecar therefore forces
  `min_replicas = 1`, an always-on second container, and roughly $4/month at idle rates — the same
  arithmetic that made Postgres the project's cost. Rejected in favour of proxying Cloudflare to ACA's
  public ingress, which keeps both the Cloudflare edge and scale-to-zero.
- **Cloudflare must not cache `/api/*`.** Cloudflare ignores `Vary: Authorization`, and the Quran
  endpoints return different bodies to anonymous and authenticated callers (tafseer stripped) under
  the same `Cache-Control: public, immutable` header. Cloudflare does not cache JSON by default, and the
  plan adds an explicit bypass rule so nobody can flip "Cache Everything" on later and leak tafseer to
  anonymous users. Edge caching of Quran data is possible later but must key on the presence of the
  `Authorization` header.

---

## Delivery sequence

Three PRs, each independently deployable, each leaving dev working:

| PR | Contents | Effect on the bill |
|---|---|---|
| **PR 1 — SQLite data layer** | Infrastructure switches to SQLite; exporter tool; Functions ships `quran.db`; CI export job feeds the Functions deploy | none yet — Postgres still runs, but nothing reads it |
| **PR 2 — Tear down Postgres** | Delete the db container app, its environment, VNet, subnet, password; Functions connection string becomes a file path | **~$0** |
| **PR 3 — Minimal API on ACA** | `Ishqnama.Api` project, Dockerfile, ACA environment + app (scale-to-zero), image build workflow, custom domain | still $0 |
| **Phase 2 — Cutover** | Flip `NEXT_PUBLIC_API_URL`; remove Functions, its plan, storage, App Insights, workflow and project | still $0, fewer resources |

PR 1 and PR 2 can be merged as one if a few minutes of dev downtime is acceptable (`infra-dev` runs
before `deploy-backend-dev` in `ci.yml`, so Postgres would disappear before the SQLite-enabled
Functions build lands). Keeping them separate avoids that window.

---

## PR 1 — SQLite data layer

### `backend/src/Ishqnama.Infrastructure`

- `Ishqnama.Infrastructure.csproj`: replace `Npgsql.EntityFrameworkCore.PostgreSQL` with
  `Microsoft.EntityFrameworkCore.Sqlite` 9.0.x. Npgsql moves to the exporter tool.
- `DependencyInjection.cs:12` `AddInfrastructure(connectionString)`: `UseNpgsql` → `UseSqlite`, keep
  `NoTracking`. Register `IQuranReadOnlyRepository` as **scoped `QuranReadOnlyRepository`**
  (`Repositories/QuranReadOnlyRepository.cs`, currently unused). `AddDbContextPool` is a cheap win here.
- Delete `Repositories/CachedQuranReadOnlyRepository.cs`. Nothing else references it.
- `QuranReadOnlyRepository.cs:172-174`: `EF.Functions.ILike(x, pattern, "\\")` →
  `EF.Functions.Like(x, pattern, "\\")`. The existing `%`/`_`/`\` escaping at line 164 already matches
  `LIKE ... ESCAPE '\'`. Every other query in the file — `GroupJoin`+`FirstOrDefault`, `Include`,
  `Skip/Take`, `Distinct`, `List.Contains` → `IN`, the composite-key `join` — translates on SQLite.
- `Data/Configurations/*` and `QuranDbContext.cs`: **no changes.** The one check constraint
  (`TranslationSegmentConfiguration.cs:12`) uses double-quoted identifiers, which SQLite accepts.
- Connection string convention (same key everywhere, no secret any more):
  `Data Source=<path>/quran.db;Mode=ReadOnly`. Relative paths resolve against the working directory.
  If the Functions run-from-package mount refuses SQLite's read locks, the URI form
  `Data Source=file:<path>/quran.db?immutable=1` avoids locking entirely — verification item.

### New tool — `backend/tools/QuranDbExporter`

Console project (`net9.0`), added to `Ishqnama.slnx` under a `/tools/` folder. References
`Ishqnama.Infrastructure` and `Npgsql.EntityFrameworkCore.PostgreSQL`.

- Args: `--source <postgres connection string>` (default: the docker-compose localhost string),
  `--output <path>` (default `backend/data/quran.db`).
- Opens `QuranDbContext` twice: once with `UseNpgsql(source)`, once with `UseSqlite(output)`.
- Deletes any existing output, `Database.EnsureCreated()` on the SQLite context — this builds the
  full schema, indexes and check constraint from the existing configurations, so there is no
  hand-written DDL.
- Copies the ten tables in FK order: Languages, Scripts, Chapters, ChapterTranslations, Juz, Manzils,
  Rukus, Verses, Translations, TranslationSegments. `AsNoTracking` reads, `AddRange` + `SaveChanges`
  per table with `AutoDetectChangesEnabled = false`. The `ValueGeneratedOnAdd` keys on Rukus,
  Translations and TranslationSegments keep their explicit non-zero values, so ids are preserved.
- Finishes with `PRAGMA journal_mode = DELETE` and `VACUUM` so the file is a single, compact,
  rollback-journal database (no `-wal` sidecar — required for read-only mounts).
- Re-reads every table's `Count()` from both sides and exits non-zero on any mismatch.

`backend/.gitignore` already ignores `data/*.db` from the project's SQLite era.

### `backend/src/Ishqnama.Functions`

- No code changes beyond what Infrastructure already forces. `Program.cs` keeps reading
  `ConnectionStrings:QuranDb`, which now holds a SQLite connection string.
- `local.settings.json.example`: `ConnectionStrings.QuranDb` → `Data Source=../../data/quran.db;Mode=ReadOnly`.
- The file is **not** a csproj content item. CI copies it into the publish output (below); locally,
  developers run the exporter once.

### `backend/docker-compose.yml`

Postgres stays, annotated as "only needed to regenerate `quran.db`". Cosmos emulator unchanged.

### CI — `.github/workflows/ci.yml` and `deploy-backend.yml`

New job **`export-quran-db`** (in `ci.yml`, before `deploy-backend-dev`):

- `services.postgres`: `image: noormahdi/ishqnama-db:dev`, **`credentials:` with
  `vars.DOCKERHUB_USERNAME` / `secrets.DOCKERHUB_TOKEN`** — the repo is private on Docker Hub
  (confirmed: the Hub API returns 404 for it), so an anonymous service-container pull fails.
  `env: POSTGRES_PASSWORD=postgres`, `ports: 5432:5432`, health check on `pg_isready`.
- Steps: setup-dotnet 9.0.x → `dotnet run --project backend/tools/QuranDbExporter -- --output backend/data/quran.db`
  → `actions/upload-artifact` named `quran-db`.
- `deploy-backend.yml`: after `dotnet publish`, `actions/download-artifact` `quran-db` into
  `backend/publish/data/`. Add `secrets: inherit` to the caller so the artifact and credentials
  resolve. `deploy-backend-dev` gains `needs: export-quran-db`.

### Docs

`backend/CLAUDE.md`: data store section rewritten (SQLite file, exporter, no Postgres for the API);
remove the caching/preload section; fix the stale endpoint list (`/user/favorites` and
`DELETE /user/bookmarks/{chapter}/{verse}` do not exist; bookmarks are slug-keyed with a
`/position` endpoint; `GET /chapters?lang=`, `GET /chapters/{num}`, `GET /chapters/{num}/verses/{verseNum}`
and `GET /rukus/{id}/verses` are missing).

---

## PR 2 — Tear down Postgres and the VNet

`infra/environments/dev/`:

- Delete `ishqnama-db.tf` entirely: `random_password.postgres`, `azurerm_key_vault_secret.postgres_password`,
  `azurerm_virtual_network.this`, `azurerm_subnet.aca`, `module.aca`.
- `ishqnama-api.tf` `module "functions"`: `connection_string = "Data Source=/home/site/wwwroot/data/quran.db;Mode=ReadOnly"`.
  The Functions module's `connection_string { name = "QuranDb" }` block keeps working unchanged —
  it surfaces as `ConnectionStrings:QuranDb` inside the host.
- `outputs.tf`: remove `db_fqdn`.
- `variables.tf`: remove `docker_hub_username` / `docker_hub_password` (nothing in Terraform pulls a
  private image any more). Keep the GitHub secrets — the CI export job uses them.
- `deploy-infra.yml`: drop the two `TF_VAR_docker_hub_*` lines.

Expected plan: destroys only the five resources above, changes one Function App connection string,
**zero** changes elsewhere. Postgres stays reachable locally via docker-compose for the exporter.

---

## PR 3 — `Ishqnama.Api` on Container Apps

### New project — `backend/src/Ishqnama.Api`

Added to `Ishqnama.slnx` under `/src/`.

> Detailed, self-contained spec for this project (files, endpoints, verification): `plans/ishqnama-api-project-plan.md`.

**`Ishqnama.Api.csproj`**

- `net9.0`, `Nullable`, `ImplicitUsings`, `AzureCosmosDisableNewtonsoftJsonCheck=true`
- References `Ishqnama.Application`, `Ishqnama.Infrastructure`
- Packages: `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.OpenApi`, `Scalar.AspNetCore`
- Footprint: `InvariantGlobalization=true` (every string comparison in the solution is ordinal),
  `ServerGarbageCollection=false`, `ConcurrentGarbageCollection=false`, `TieredPGO=true`
- Publish: `RuntimeIdentifier=linux-x64`, `SelfContained=true`, `PublishTrimmed=true`, `TrimMode=partial`.
  `Microsoft.EntityFrameworkCore.Sqlite` brings `SQLitePCLRaw.bundle_e_sqlite3`; the native
  `libe_sqlite3.so` lands in the self-contained output and only needs glibc, which chiseled provides.
- No Application Insights packages — ACA logs go to the environment's Log Analytics workspace.

**`Program.cs`** — configuration keys identical to Functions: `ConnectionStrings:QuranDb`,
`CosmosDb:{Endpoint,Key,DatabaseName,ContainerName}`, `Auth:{ClientId,Authority}`, `Cors:AllowedOrigins`.

Services: `ConfigureHttpJsonOptions` (Unicode encoder `JavaScriptEncoder.Create(UnicodeRanges.All)`
so Arabic/Urdu/Hindi are emitted directly, plus `IshqnamaJsonContext` inserted at the head of the
resolver chain); `AddInfrastructure(connectionString)`; conditional `AddUserDataInfrastructure` under
the same null-guard as `Ishqnama.Functions/Program.cs:40`; the seven Application services as scoped
(`Program.cs:46-52`) — **omit the dead `AddMemoryCache()`**; CORS policy from the comma-separated
`Cors:AllowedOrigins` with `GET, POST, PUT, DELETE, OPTIONS` and `Content-Type, Accept, Authorization`;
`AddJwtBearer` with `Authority`/`Audience` and issuer/audience/lifetime/signing-key validation, user
id from `oid` falling back to `sub`; `AddAuthorization`; `AddResponseCompression` (Brotli + Gzip,
`EnableForHttps`, `application/json`); `AddHealthChecks().AddDbContextCheck<QuranDbContext>()`;
`AddOpenApi()` in Development only.

Pipeline: `UseResponseCompression` → `UseExceptionHandler` (`IExceptionHandler` returning
`500 { "error": "An unexpected error occurred." }`) → `UseCors` → `UseAuthentication` →
`UseAuthorization` → `UseMiddleware<CacheHeaderMiddleware>` → endpoints. `var api = app.MapGroup("/api")`
reproduces `host.json`'s `routePrefix`, so `frontend/src/lib/api-client.ts` needs no change.

**`Endpoints/`** — one static `MapXEndpoints(this RouteGroupBuilder)` per resource; handler bodies
port from `backend/src/Ishqnama.Functions/Functions/*.cs`, which already use `HttpRequest`/`IResult`.

Anonymous (`.AllowAnonymous()`): `GET /api/healthz`, `/api/chapters?lang=`, `/api/chapters/{num:int}`,
`/api/chapters/{num:int}/verses?translationId=&page=&pageSize=`, `/api/chapters/{num:int}/verses/{verseNum:int}`,
`/api/juz`, `/api/juz/{num:int}/verses?...`, `/api/rukus?chapterNum=&juzNum=`, `/api/rukus/{id:int}/verses?translationId=`,
`/api/translations`, `/api/verses?from=&to=&translationId=`.

Authenticated (`.RequireAuthorization()`): `GET /api/search?q=&scope=&translationId=&page=&pageSize=`,
`GET/PUT /api/user/settings`, `GET/POST /api/user/bookmarks`, `PUT /api/user/bookmarks/{slug}/position`,
`DELETE /api/user/bookmarks/{slug}`, `GET/POST /api/user/history?limit=`.

Behaviours that must survive: tafseer `Explanation` stripped for anonymous callers (port
`Helpers/AuthExtensions.cs` verbatim, with `IsAuthenticated()` reading
`User.Identity?.IsAuthenticated`); optional auth on anonymous routes (a valid token on `/api/chapters`
yields explanations, an invalid one does not 401 — `RequireAuthorization()` only on the protected
groups gives exactly this); the three request records lifted out of `UserDataFunctions` so the JSON
source generator sees them; status codes, `Location` header and `409` on duplicate title unchanged;
concrete `ErrorResponse(string Error)` instead of anonymous objects.

**`Middleware/CacheHeaderMiddleware.cs`** — port of the Functions version (assembly-version ETag,
`Cache-Control: public, max-age=2592000, immutable`, `Vary: Authorization`, `If-None-Match` → 304).
Exclude `/api/healthz` as well as `/api/user` — a probe target must not carry a 30-day cache.

**`Json/IshqnamaJsonContext.cs`** — `[JsonSerializable]` for every DTO in `Ishqnama.Application/Dtos/`,
the `PagedResponse<T>` and list closures, the request records and `ErrorResponse`.

**Health** — `/api/healthz` (parity; `frontend/src/lib/api.ts:149` calls it), `/health/live`
(process up), `/health/ready` (the `DbContext` check — a `SELECT 1` against the local file, instant).
No warm-up hosted service is needed now that there is no preload.

**`appsettings.Development.json`** — mirrors `local.settings.json.example`: `Data Source=../../data/quran.db;Mode=ReadOnly`,
the public Cosmos emulator endpoint/key, `Cors:AllowedOrigins = http://localhost:3000`, the dev CIAM
authority and client id. `appsettings.json` holds logging defaults only.

### Container image

`backend/src/Ishqnama.Api/Dockerfile` + `backend/.dockerignore`.

- Build stage `mcr.microsoft.com/dotnet/sdk:9.0`: restore, then
  `dotnet publish src/Ishqnama.Api -c Release -r linux-x64 --self-contained true -p:PublishTrimmed=true -p:TrimMode=partial -o /app`
- Runtime stage `mcr.microsoft.com/dotnet/runtime-deps:9.0-noble-chiseled`; `COPY data/quran.db /app/data/quran.db`
  (the file is placed in the build context by CI, or by the developer locally); `USER $APP_UID`;
  `ENV ASPNETCORE_URLS=http://+:8080`; `EXPOSE 8080`; entrypoint `["./Ishqnama.Api"]`.
- Add an `api` service to `backend/docker-compose.yml` (build context `backend/`, depends on `cosmos`)
  for local end-to-end runs of the real image.

### Terraform — `infra/environments/dev/`

- `ishqnama-api.tf`: keep `module "functions"` as-is; add `module "api"` using the **existing
  `infra/modules/azure/aca` module with no changes** — no `infrastructure_subnet_id`, so it creates a
  Consumption-only environment `ishqnama-dev` with its Log Analytics workspace, and the app
  `ca-ishqnama-api-dev`. `container_registry` stays `null` — the image is public.
  - Image `docker.io/noormahdi/ishqnama-api:${var.api_image_tag}` (the Hub repo already exists).
  - `cpu = 0.25`, `memory = "0.5Gi"`, **`min_replicas = 0`**, `max_replicas = 1`.
  - `ingress = { external = true, target_port = 8080, transport = "auto" }`.
  - Env: `ASPNETCORE_ENVIRONMENT=Production`; `ConnectionStrings__QuranDb=Data Source=/app/data/quran.db;Mode=ReadOnly`
    (plain value — no longer a secret); `CosmosDb__Endpoint`, `CosmosDb__Key` (secret),
    `CosmosDb__DatabaseName`, `CosmosDb__ContainerName`; `Auth__ClientId`, `Auth__Authority`;
    **`Cors__AllowedOrigins`** — genuinely new. Functions never sets it (its CORS is the platform
    `site_config.cors`); ACA has no platform CORS, so this must carry the same three origins:
    `https://dev.ishqnama.com`, `https://${module.swa.default_host_name}`, `http://localhost:3000`.
  - Probes: startup + readiness on `/health/ready`, liveness on `/health/live`.
- `variables.tf`: `api_image_tag` (default `"dev"`). `outputs.tf`: `api_fqdn`, `api_url`.
- `ishqnama-web.tf` untouched — `NEXT_PUBLIC_API_URL` stays on Functions until Phase 2.

**Custom domain `api.dev.ishqnama.com` — Cloudflare proxy to ACA ingress** (new `ishqnama-api-domain.tf`).
Resource shapes below were checked against the current `azurerm`, `cloudflare ~> 4.0` and `tls`
provider docs. No `azapi`, no Azure managed certificate.

1. `infra/modules/azure/aca/outputs.tf`: add `custom_domain_verification_id` (attribute of
   `azurerm_container_app.this`). Existing `environment_id` and `container_app_id` outputs are reused.
2. **Domain validation** — `cloudflare_record` TXT `asuid.api.dev` with `content = module.api.custom_domain_verification_id`.
   Required because the CNAME below resolves to Cloudflare, so ACA's CNAME-based validation cannot work.
3. **DNS** — `cloudflare_record` CNAME `api.dev` → `module.api.container_app_fqdn`, **`proxied = true`**.
   Uses the existing `data.cloudflare_zone.ishqnama` from `data.tf`.
4. **Origin certificate** — add the `hashicorp/tls` provider: `tls_private_key` (RSA 2048) +
   `tls_self_signed_cert` for `dns_names = ["api.dev.ishqnama.com"]`, `allowed_uses = ["key_encipherment",
   "digital_signature", "server_auth"]`, `validity_period_hours = 87600` (10 years),
   `early_renewal_hours = 720`. Then `azurerm_container_app_environment_certificate` with
   `certificate_blob_base64 = base64encode("${cert_pem}${private_key_pem}")` — the argument is
   documented as accepting PFX **or** PEM — and `certificate_password = ""` (required argument, empty for PEM).
   If PEM is rejected in practice, add the `chilicat/pkcs12` provider's `pkcs12_from_pem` and pass a PFX.
5. **Binding** — `azurerm_container_app_custom_domain` with `name = "api.dev.ishqnama.com"`,
   `container_app_id`, `container_app_environment_certificate_id`, `certificate_binding_type = "SniEnabled"`,
   `depends_on` the TXT record.
6. **Cloudflare SSL mode, scoped to the hostname** — `cloudflare_ruleset` in phase `http_config_settings`,
   one rule with expression `(http.host eq "api.dev.ishqnama.com")`, action `set_config`,
   `action_parameters { ssl = "full" }`. `Full` (not `strict`) is what accepts the self-signed origin
   certificate while still encrypting Cloudflare→Azure. Being a Configuration Rule, it leaves the
   zone's setting for `dev.ishqnama.com` untouched. Upgrade path to `strict`: a Cloudflare Origin CA
   certificate via `cloudflare_origin_ca_certificate`, which needs the separate Origin CA key credential.
7. **Cache bypass** — `cloudflare_ruleset` in phase `http_request_cache_settings`, expression
   `(http.host eq "api.dev.ishqnama.com")`, action `set_cache_settings`, `action_parameters { cache = false }`.
   See Trade-offs for why this is not optional.

Cold starts pass through Cloudflare's 100 s origin timeout with room to spare. The origin FQDN remains
reachable directly (`*.azurecontainerapps.io`); if hiding it ever matters, that is the point at which a
tunnel — and its always-on cost — becomes the trade.

### CI

- New reusable **`.github/workflows/build-api-image.yml`**: `actions/download-artifact` `quran-db` into
  `backend/data/` → `docker/login-action` → `docker/build-push-action` (context `backend/`, file
  `backend/src/Ishqnama.Api/Dockerfile`, tags `noormahdi/ishqnama-api:dev` and `:${{ github.sha }}`,
  GHA layer cache).
- `ci.yml`: `build-api-image` job, `needs: export-quran-db`, **`if:` gated on a `backend/**` path
  change** (`dorny/paths-filter` or `tj-actions/changed-files`). `infra-dev` gains
  `needs: build-api-image` and passes `api_image_tag: ${{ github.sha }}`; when the image job is
  skipped, pass the previous tag (fall back to `dev`).
- `deploy-infra.yml`: optional `api_image_tag` input → `TF_VAR_api_image_tag`. Terraform owns the
  revision — no `az containerapp update`, no `ignore_changes` on the image, no drift.
- `deploy-backend-dev` (Functions) unchanged from PR 1; both presentation layers deploy in parallel.

Pre-existing gap, out of scope: `destroy-infra.yml` does not pass `TF_VAR_cloudflare_*`, so a dev
destroy already fails at provider init. Worth fixing separately.

### Docs

Root `CLAUDE.md` and `backend/CLAUDE.md`: add `Ishqnama.Api`, the two presentation layers, run
commands (`dotnet run --project src/Ishqnama.Api`, Scalar at `/scalar` in Development), the SQLite
connection string convention.

---

## Phase 2 — Cutover and decommission Functions

Not built now; documented so the end state is agreed.

1. Verify the API in dev against the real tenant and data (checklist below) for as long as you like.
2. `ishqnama-web.tf`: `NEXT_PUBLIC_API_URL = "https://api.dev.ishqnama.com/api"`. Frontend redeploys
   automatically (`deploy-frontend.yml` reads SWA app settings at build time).
3. Watch for regressions — auth (`/api/user/*`), search, tafseer gating, CORS from the SWA hostname.
4. Remove Functions: delete `module "functions"` (plan, storage account, App Insights, its Log
   Analytics workspace), `deploy-backend.yml`, the `build`/`deploy-backend-dev` wiring for it,
   `backend/src/Ishqnama.Functions` and its slnx entry. `export-quran-db` then feeds only the image build.
5. Update both `CLAUDE.md` files; mark this plan `SUPERSEDED`/done like `backend/PLAN.md`.
6. Confirm in Cost Management that the subscription shows $0 for the resource group over a full
   billing period.

---

## Verification

**PR 1**

1. `docker-compose up -d`, `dotnet run --project backend/tools/QuranDbExporter` → `backend/data/quran.db`
   exists, ~40 MB, exporter reports matching counts (114 / 114 / 6350 / 556 / 3 / 22257 …).
2. `sqlite3 backend/data/quran.db "PRAGMA journal_mode; PRAGMA integrity_check;"` → `delete`, `ok`.
3. `func start` with the SQLite connection string; curl every Quran endpoint and diff against the
   same calls on the Postgres build (checked-out `main`). Search: `q=mercy`, `q=رحمت`, `q=MERCY`
   (case), `q=100%` (escaping) — identical results.
4. Stop the Postgres container; Functions must keep serving. That proves nothing reads it.
5. CI: `export-quran-db` pulls the private image via `credentials`, the artifact appears, the deployed
   Function App serves `/api/chapters` and `/api/search` from the file on the run-from-package mount.
   If SQLite complains about locking there, switch to the `file:…?immutable=1` form.

**PR 2**

6. `terraform fmt -check -recursive`; `terraform plan` shows exactly: destroy container app,
   environment, Log Analytics (db), VNet, subnet, random password, Key Vault secret; update one
   Function App connection string; nothing else.
7. After apply, dev Functions still serves all endpoints. Three days later, Cost Management for
   `rg-ishqnama-dev` shows the ACA line gone.

**PR 3 — local**

8. `dotnet build` in `backend/` on SDK 9. `dotnet run --project src/Ishqnama.Api`; `/scalar` and
   `/openapi/v1.json` respond in Development.
9. Curl all 20 endpoints against the API and against `func start`, diff JSON. Specifically: anonymous
   `GET /api/chapters/2/verses?translationId=2` has `explanation: null`; with a bearer token it is
   populated; `/api/verses?from=2:1&to=2:5`; malformed `from` → 400; `/api/search?q=a` → 400, no
   token → 401; bookmark lifecycle POST 201 + `Location` → POST 409 → PUT `/position` → DELETE;
   `If-None-Match` → 304 and `/api/healthz` **not** cached; `OPTIONS` from `http://localhost:3000` →
   204 with the CORS headers.
10. `docker build`; image size recorded; no trim errors. `docker run` against the compose Cosmos
    emulator, repeat the sweep — user endpoints and the first Quran request are where trimming would
    break. `docker stats` RSS after a few hundred requests (expect tens of MB). Runs as non-root.
    Measure process start → `/health/ready` 200 (expect ~1 s).

**PR 3 — Azure**

11. `terraform plan`: creates only the new environment, workspace, app, two DNS records, the TLS key
    and certificate, the environment certificate, the custom domain and two Cloudflare rulesets;
    **no changes** to Functions, SWA, Cosmos or Key Vault.
12. `curl https://<api_fqdn>/health/ready`, `/api/chapters` directly on the ACA hostname; then the same
    on `https://api.dev.ishqnama.com`. `openssl s_client` shows a Cloudflare-issued edge certificate.
    Every response carries `cf-cache-status: DYNAMIC` (never `HIT`). Fetch
    `/api/chapters/2/verses?translationId=2` anonymously and then with a token, and confirm the
    anonymous body still has `explanation: null` afterwards — proof nothing is cached at the edge.
    Authenticated `/api/user/settings` with a real dev-tenant token. `Origin: https://<swa-hostname>`
    returns `Access-Control-Allow-Origin`.
13. Leave the app idle 30 minutes, confirm replicas = 0 in the portal, then time the first request —
    record the cold-start latency for the cutover decision.
14. The SWA still points at `func-ishqnama-dev.azurewebsites.net/api`; dev traffic still flows
    through Functions.
