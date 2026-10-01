# Application Insights: real-user monitoring and frontend-to-API tracing

Design spec, 2026-10-01. The implementation plan that follows this spec goes in
`plans/app-insights-observability-plan.md`.

## Context

Nothing tells us how Ishqnama behaves for real readers. The only telemetry today is container
stdout: the Container Apps environment sends console logs to the Log Analytics workspace
`<environment_name>-logs` (`infra/modules/azure/aca-environment/main.tf`). The Minimal API
(`backend/src/Ishqnama.Api`) has no tracing, and the frontend sends nothing. Only the retired
Functions host references Application Insights.

Questions we cannot answer today:

- How long do readers really wait on a cold start, and how often do they see the warm-up ribbon?
- What are LCP, INP and CLS on `/quran/*` for real devices? The Nastaleeq fonts (5.8 MB and
  3.9 MB) and the book model are the suspects.
- When a bookmark save or settings sync fails, did the browser, the API or Cosmos DB fail?
- Which features are used: share, bookmarks, ruku rails, language switch, search?

The Azure footprint must stay at $0/month, and the frontend is a static export with
client-side MSAL auth.

## Goals

- Page views, route changes, JS errors, API call timings and Core Web Vitals from real browsers.
- One end-to-end transaction per signed-in API call: browser fetch → API request → Cosmos DB
  dependency, under one operation ID in Application Insights.
- A small, named catalogue of reader-activity events.
- Cold-start duration measured from the reader's side.
- Stay inside the free Log Analytics allowance, with hard caps so cost cannot exceed $0 even
  under abuse.
- No effect on first paint: the SDK loads after the page has loaded.

## Non-goals

- Session replay or heatmaps (Microsoft Clarity could be added later as a separate decision).
- Alerts, workbooks or dashboards beyond the saved KQL queries listed under Verification.
- Instrumenting the legacy Functions host.
- Tracing anonymous API calls end to end (see Decision 3).
- Telemetry on the `/redirect/` MSAL bridge.
- A consent banner. Cookies are first-party and analytics-only; the privacy page is updated
  instead (see Privacy).

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Backend | Workspace-based Application Insights per environment, on the existing ACA Log Analytics workspace |
| 2 | SDKs | Frontend `@microsoft/applicationinsights-web` (no React plugin). API `Azure.Monitor.OpenTelemetry.Exporter` with the OpenTelemetry hosting, ASP.NET Core and HttpClient instrumentation packages, plus `Npgsql.OpenTelemetry` (the distro was dropped: it adds trim warnings) |
| 3 | Correlation | W3C `traceparent` only, sent **only on requests that already carry `Authorization`**. Anonymous GETs stay CORS "simple" requests |
| 4 | User identity | `user_AuthenticatedId` = first 16 hex chars of SHA-256 of `oid`, computed the same way on both sides. Never the email, name or raw `oid` |
| 5 | Noise | `/api/healthz`, `/health/*`, `OPTIONS` and Entra token calls are excluded on both sides |
| 6 | Cost guard | Workspace `daily_quota_gb` and App Insights `daily_data_cap_in_gb` set in each environment |
| 7 | Loading | SDK dynamically imported after `window` `load`, during idle time; calls before that are buffered |
| 8 | Cookies | Keep the SDK's first-party `ai_user` / `ai_session` cookies, so user and session counts are meaningful |

### Why Decision 3

Today an anonymous verse GET sends only `Accept`, so it is a CORS simple request with no
preflight. A `traceparent` header is not on the CORS safelist, so letting the SDK add it to every
call would preflight every anonymous read. Browsers cache preflights per URL, and the reader
fetches a new URL for each chapter, juz and ruku, so most anonymous reads would gain an extra
round trip to the API. That trades reader latency for telemetry, which is the wrong way round.

Signed-in requests already carry `Authorization` and are preflighted already (with the 2 h
max-age in `Program.cs`), so adding `traceparent` to them costs nothing. That covers the paths
that hit Cosmos DB and are most likely to fail: settings, bookmarks, favourites, history, search
and tafseer.

Anonymous calls are still recorded on both sides: the browser records the fetch as a dependency
with its duration and status, and the API records the request. They are not linked by
operation ID.

To make this work, the SDK's own header injection is turned off
(`enableCorsCorrelation: false`), and `src/lib/api-client.ts` adds the header itself when it adds
`Authorization`. If the trade-off changes later, turning on `enableCorsCorrelation` with
`correlationHeaderDomains: [<api host>]` correlates everything. That is a config change plus
removing the manual header.

## Infrastructure

### New module `infra/modules/azure/app-insights`

- `azurerm_application_insights`: `application_type = "web"`, `workspace_id` from the new
  `aca-environment` output, `daily_data_cap_in_gb` (variable), `retention_in_days` matching the
  workspace, `internet_ingestion_enabled = true`, `local_authentication_disabled = false` (the
  browser ingests with the connection string; Entra-authenticated ingestion is not possible from
  an anonymous browser).
- Outputs: `connection_string` (sensitive), `id`, `app_id`.

### `aca-environment` module

- New variable `daily_quota_gb` (default `-1`, unlimited, to keep existing behaviour), passed to
  `azurerm_log_analytics_workspace.daily_quota_gb`.

### Environments (`dev` and `prod`)

- `module "app_insights"` next to `module "api_environment"` in `ishqnama-api.tf`.
- Caps. The free 5 GB/month of Analytics Logs is per **billing account**, and dev and prod
  probably share one. Their combined cap must stay under 5 GB/month, including the container
  console logs that already go to each workspace:

  | Environment | Workspace `daily_quota_gb` | App Insights `daily_data_cap_in_gb` |
  |---|---|---|
  | dev | 0.05 (~1.5 GB/month) | 0.04 |
  | prod | 0.1 (~3 GB/month) | 0.08 |

  Confirm in Cost Management whether the subscriptions share a billing account, and adjust if
  they don't. When a cap is hit, ingestion stops until the next UTC day, which is acceptable.
- The connection string is in the public JS bundle, so anyone can send telemetry with it. The
  caps are what keeps this at $0. Telemetry flooded with fake data means a lost day of data, not
  a bill.
- API container: `{ name = "APPLICATIONINSIGHTS_CONNECTION_STRING", secret_name = "appinsights-connection" }`
  with the matching entry in `secrets`.
- SWA: `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING = nonsensitive(module.app_insights.connection_string)`
  in `ishqnama-web.tf`. Wrapping it in `nonsensitive()` is honest because the value ships in the
  bundle anyway.
- `.github/workflows/deploy-frontend.yml`: read `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` from
  `az staticwebapp appsettings list` like the other `NEXT_PUBLIC_*` values.
- Document the caps and the shared-billing-account reasoning in `infra/README.md`.

## API (`backend/src/Ishqnama.Api`)

### Packages

- `Azure.Monitor.OpenTelemetry.Exporter`, `OpenTelemetry.Extensions.Hosting`,
  `OpenTelemetry.Instrumentation.AspNetCore` and `OpenTelemetry.Instrumentation.Http`.
  The `Azure.Monitor.OpenTelemetry.AspNetCore` distro was tried first, but it was the only new
  source of a trim warning (IL2104) in the trimmed image, so the same pieces are composed by
  hand (see Trimming and footprint).
- `Npgsql.OpenTelemetry` (`AddNpgsql()`). The Quran data is cached in memory after the first
  request, so this mostly shows the cold-start load, which is what we want to see.

### Registration in `Program.cs`

Only when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set, so local `dotnet run` and
docker-compose keep working without it:

```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("ishqnama-api"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation(options => options.Filter = TelemetryFilter.ShouldTrace)
        .AddHttpClientInstrumentation()
        .AddSource("Azure.Cosmos.Operation")
        .AddNpgsql()
        .AddAzureMonitorTraceExporter(ConfigureExporter))
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddAzureMonitorMetricExporter(ConfigureExporter))
    .WithLogging(logging => logging.AddAzureMonitorLogExporter(ConfigureExporter));
```

- `TelemetryFilter.ShouldTrace(HttpContext)` (new, `Hosting/TelemetryFilter.cs`) returns false
  for `OPTIONS`, `/health/live`, `/health/ready` and `/api/healthz`. The probes alone are about 480
  requests an hour while a replica is up, and the keep-alive ping adds 30 an hour per open tab.
- Cosmos tracing: set `CosmosClientOptions.CosmosClientTelemetryOptions = new() { DisableDistributedTracing = false }`
  in `Ishqnama.Infrastructure/DependencyInjection.cs` (tracing is off by default in the GA SDK)
  and listen to the `Azure.Cosmos.Operation` source. No AppContext switch is needed.
- Logs: the distro also exports `ILogger` output, which would duplicate the container console
  logs. Add an OpenTelemetry logging filter at `Warning` so only warnings and errors (including
  `GlobalExceptionHandler`) reach the `AppTraces` and `AppExceptions` tables.
- Sampling: start with the distro default (no sampling at this traffic). Revisit if the caps
  are hit on normal days.

### User identity

A small middleware after `UseAuthentication()` (or in `OnTokenValidated`) tags the current
activity: `Activity.Current?.SetTag("enduser.id", UserHash.From(oid))`. The Azure Monitor exporter
maps `enduser.id` to `user_AuthenticatedId`. `UserHash.From` = lowercase hex of SHA-256(`oid`),
first 16 characters. The frontend uses the same function.

### CORS

Add `traceparent` and `tracestate` to `.WithHeaders(...)`. Nothing needs exposing, because W3C
mode does not read `Request-Context`.

### Trimming and footprint

The image is published trimmed (`PublishTrimmed`, `TrimMode=partial`) and self-contained, with
0.5 GiB for the API container.

- Any new IL2xxx/IL3xxx trim warning from `dotnet publish` is a blocker. Checked: the distro
  added `IL2104: Assembly 'Azure.Monitor.OpenTelemetry.AspNetCore' produced trim warnings`, and
  the hand-composed packages add none over the existing baseline (EF Core, MVC, Newtonsoft).
  The trimmed image exports request, exception, log and metric telemetry; probe, keep-alive and
  `OPTIONS` requests are filtered out; and the request's operation ID and parent follow the
  incoming `traceparent`. This was verified by running the image against a local fake
  ingestion endpoint. Publish size went from 67 to 70 MB.
- Compare working set and cold-start time before and after on dev: a container restart, then
  the first `/api/chapters`. A regression over ~40 MB or ~2 s needs discussion before prod.

## Frontend

### Packages

`@microsoft/applicationinsights-web` only. The React plugin's route tracking hooks
`history.pushState`, which doesn't fit the App Router well, and we don't need its components.

### `src/lib/telemetry.ts` (new)

A module-level facade that the rest of the app imports. It never imports the SDK statically.

- `initTelemetry()`: no-op when `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` is empty (local dev,
  tests). Otherwise waits for `window` `load` and then `requestIdleCallback` (falls back to
  `setTimeout`), does `import("@microsoft/applicationinsights-web")`, creates the instance and
  flushes the buffer.
- `trackEvent(name: TelemetryEvent, props?)`, `trackMetric(name, value, props?)`,
  `trackException(error, props?)`, `trackPageView(uri)`, `setUser(oid | null)`: before init
  they push onto a bounded buffer (50 items, oldest dropped). After init they call the SDK.
  When telemetry is disabled they do nothing.
- `traceparentHeader(): string | undefined`: returns
  `00-<current operation trace ID>-<new 16-hex span ID>-01`, or `undefined` before init or when
  disabled. The trace ID is the SDK's `context.telemetryTrace.traceID`, so the API request
  joins the page view's operation.
- SDK config:

  ```ts
  {
    connectionString,
    distributedTracingMode: DistributedTracingModes.W3C,
    enableCorsCorrelation: false,          // see Decision 3; api-client adds the header itself
    disableAjaxTracking: true,             // nothing uses XHR
    disableFetchTracking: false,
    excludeRequestFromAutoTrackingPatterns: [/\/api\/healthz/],
    enableAutoRouteTracking: false,        // route changes tracked manually
    enableUnhandledPromiseRejectionTracking: true,
    autoTrackPageVisitTime: true,
  }
  ```

- A dependency initializer keeps only fetches to the API origin (`isApiCall`). Checking in a
  browser showed that Next.js prefetches every visible link's `?_rsc=` payload, hundreds of them
  on the Quran index, and each was recorded as a dependency. Entra token calls are dropped by the
  same rule.
- A telemetry initializer removes the URL hash and drops any item whose URL contains `/redirect/`
  as a safety net.

### `src/components/telemetry.tsx` (new)

Mounted in `src/components/app-shell.tsx` next to `<ApiKeepAlive />`, so it is skipped on the
redirect bridge route like the other app-shell components. It sits outside `AuthProvider`, like
`GlobalLoadingIndicator`.

- Calls `initTelemetry()` once.
- On `usePathname()` change: start a new operation ID (`context.telemetryTrace.traceID = generateW3CId()`),
  then `trackPageView`. Each page has its own operation, so its API calls group under it.
- `useReportWebVitals` from `next/web-vitals` → `trackMetric("web-vital-<name>", value, { rating, route })`
  for LCP, INP, CLS, FCP and TTFB. `route` is the **landing** route's pattern (number-only
  segments become `[n]`), because LCP and CLS can be reported after a client-side navigation
  but describe the first load. The callback is module-level: `useReportWebVitals` re-subscribes
  and re-reports when its callback changes identity.

### User context

Inside `AuthProvider`, wherever the active account is set or cleared (the existing MSAL event
callback in `auth-provider.tsx`), call `setUser(account?.idTokenClaims?.oid ?? null)`. The facade
hashes the `oid` with `crypto.subtle.digest` and calls `setAuthenticatedUserContext(hash, undefined, true)`,
or `clearAuthenticatedUserContext()` on null.

### `src/lib/api-client.ts`

In `apiFetchWithOptionalAuth` (when a token was attached) and in `authenticatedApiFetch`, add
`traceparent: traceparentHeader()` when it is defined. `apiFetch` itself is unchanged, so
anonymous requests stay simple.

### Reader activity events

`TelemetryEvent` is a string union in `src/lib/telemetry-events.ts`. Each name is added at one
call site:

| Event | Where | Properties |
|---|---|---|
| `verse-shared` | share sheet, after `navigator.share` resolves or the copy succeeds | `option`: `ayah` / `ruku`, `method`: `native` / `clipboard` |
| `bookmark-created` / `bookmark-deleted` | `bookmarks-context.tsx` on success | none |
| `sign-in-prompt-shown` | `sign-in-prompt-context.tsx` | `feature` (the `SignInFeature`) |
| `sign-in-started` | the sheet's sign-in button | `feature` |
| `translation-language-changed` | reader settings | `from`, `to` |
| `reading-mode-changed` | reader settings | `mode` |
| `theme-changed` | `theme-menu.tsx` | `theme` |
| `index-view-changed` | Quran index Sura/Juz toggle | `view` |
| `search-submitted` | search page, debounced, signed in only | `resultCount`. Never the query text |
| `book-model-shown` / `book-model-fallback` | `book-model.tsx` | `variant`, `reason` for fallback |

Properties never contain verse text, search text, email, names or tokens.

### Cold-start measurement

Subscribe to the `src/lib/api-readiness.ts` store from `telemetry.tsx`. When it moves from
`warming` to `ready`, emit `trackMetric("api-warmup-ms", <time since the probe started>)`, and
emit `trackEvent("api-unreachable")` on `unreachable`. This adds no readiness logic, only an
observer. If the store does not expose a subscribe, add one next to `useApiReadiness()`.

### Errors

The SDK records `window.onerror` and unhandled rejections automatically. The app has no
`error.tsx` or `global-error.tsx`, so render errors that Next.js catches are not seen. Adding a
`global-error.tsx` that calls `trackException` is a small optional follow-up, not part of this
spec.

### Bundle

The SDK is about 72 KB gzipped (measured), in its own chunk, loaded after `load` on every page.
It is not referenced from any page's first-load HTML.

## Privacy

Replace the "Analytics" paragraph in `src/app/privacy/page.tsx`. The new copy follows the
friendly non-technical copy rule (no "service", "API", "server"). Draft:

> **How the site is used**
> To find out what is slow or broken, and which parts of Ishqnama readers use, we record which
> pages are opened, how quickly they appear, errors that happen, and actions such as sharing a
> verse or adding a bookmark. When you are signed in, these records carry a scrambled code made
> from your account, so we can follow a problem you hit without knowing who you are. They never
> include your name, email address, what you search for, or what you read in the explanations.
> Two small cookies let us count visits; they are used for nothing else. The records are kept for
> 30 days.

Match "30 days" to the configured retention.

## Tests

- `src/lib/__tests__/telemetry.test.ts`: no-op without a connection string; buffers before init
  and flushes in order; buffer bounded at 50; `traceparentHeader()` format
  (`/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/`) and `undefined` before init; `oid` hash matches a
  known vector.
- `src/lib/__tests__/api-client.test.ts` (extend or add): `traceparent` present on authenticated
  calls, absent on anonymous `apiFetch`.
- `src/lib/__tests__/telemetry-events.test.ts`: event property keys are drawn from an allowlist,
  so a future `query` or `text` property fails the test.
- Backend: the solution has no test project yet, so `TelemetryFilter` and `UserHash` were
  checked by running the trimmed image against a fake ingestion endpoint (see Trimming and
  footprint). The frontend test pins the hash vector
  (`11111111-2222-3333-4444-555555555555` → `666ff6ccaa5b3c07`), which `UserHash.From` matches.
- Existing suites (`no-hardcoded-colours`, `sign-in-copy`, etc.) stay green.

## Verification (dev)

1. Sign in on dev.ishqnama.com and add a bookmark. In App Insights → Transaction search, the
   operation shows: page view → browser dependency `POST /api/bookmarks...` → API request →
   Cosmos dependency, all with the same `operation_Id`.
2. Open a chapter anonymously. Network tab: the verse GET has no preflight and no
   `traceparent`. App Insights still shows the browser dependency and, separately, the API
   request.
3. Leave a tab open 10 minutes: no `healthz`, `/health/*` or `OPTIONS` rows in `AppRequests`.
4. Wait for scale-to-zero, reload: an `api-warmup-ms` metric arrives close to the observed wait.
5. KQL saved in the workspace (and copied into `infra/README.md`):

   ```kusto
   // Core Web Vitals p75 by route, last 7 days
   AppMetrics
   | where Name startswith "web-vital-"
   | extend route = tostring(Properties.route)
   | summarize p75 = percentile(Sum / ItemCount, 75) by Name, route

   // Failed signed-in calls with their API and Cosmos side
   AppDependencies
   | where Success == false and Type == "Fetch"
   | join kind=leftouter (AppRequests) on OperationId
   | project TimeGenerated, Target, ResultCode, Name1, ResultCode1, UserAuthenticatedId
   ```

6. After a week on dev, check daily ingestion (`Usage | where IsBillable`) against the caps
   before enabling in prod.

## Rollout

1. Terraform module + caps + secrets on dev; no app change yet. Confirm a $0 forecast in Cost
   Management.
2. API instrumentation (trim check, footprint check), deploy to dev.
3. Frontend facade, page views, Web Vitals, correlation header; privacy copy in the same PR.
4. Activity events and the cold-start metric.
5. One week of dev data → adjust caps → prod via `prod-release.yml`.
6. Update `CLAUDE.md` (frontend telemetry bullet, backend tracing note, infra caps).
