# Frontend keep-alive poll for the API Container App

## Context

The Minimal API runs on Azure Container Apps with `min_replicas = 0` so the project stays at $0.
ACA's default HTTP scale rule removes the last replica after roughly 300 s with no requests, and
the next request then pays a cold start (platform + container start + app boot, several seconds).

Ishqnama is a reading site: a user typically loads a sura and then reads for a long time without
triggering another API call. After ~5 minutes the API scales to zero, so the next navigation,
search, bookmark save or settings sync hits a cold start. The goal is that **while the site is open
and visible in a browser tab, the API stays warm**, without adding any always-on cost.

Approach: a tiny client-side component that pings `GET /api/healthz` on load, then every 2 minutes
while the tab is visible, pauses when the tab is hidden, and pings immediately when the tab becomes
visible again. Nothing server-side is possible because the frontend is a static export.

## What already exists (reuse, do not rewrite)

- `frontend/src/lib/api.ts:148` — `getHealth(signal?: AbortSignal)` calls `/healthz` through
  `apiFetch`. It is currently unused. Reuse it as-is.
- Backend `GET /api/healthz` (`backend/src/Ishqnama.Api/Endpoints/HealthEndpoints.cs`) is
  anonymous, constant-time (no DB), returns `{"status":"healthy"}`, and is **explicitly excluded**
  from the 30-day `Cache-Control` in `Middleware/CacheHeaderMiddleware.cs`. Cloudflare already
  bypasses cache for `/api/*`. So every ping reaches the origin. Do not switch to any other route:
  other `/api/*` routes are served from the browser HTTP cache and would never wake the app.
- CORS (`Program.cs:50-57`) already allows `GET` with `Accept` from the SWA origins and
  `http://localhost:3000`. No backend or infra change is needed.
- Precedent for a self-contained `"use client"` side-effect component that renders nothing:
  `frontend/src/components/pwa-install-prompt.tsx`.

## Changes

### 1. New component `frontend/src/components/api-keep-alive.tsx`

`"use client"`, default export `ApiKeepAlive`, returns `null`. One `useEffect` with `[]` deps:

- Constants at top of file (hardcoded; a new `NEXT_PUBLIC_*` var would need edits in
  `.env.example`, `infra/environments/dev/ishqnama-web.tf` and `deploy-frontend.yml`, not worth it):
  - `KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000` — comfortably under ACA's ~300 s scale-in cooldown,
    with margin for browser timer jitter.
  - `KEEP_ALIVE_TIMEOUT_MS = 30_000` — long enough that a ping that itself triggers a cold start is
    not aborted before the replica answers.
- `ping()`:
  - skip if `navigator.onLine === false`;
  - skip if a previous ping is still in flight (single `AbortController` ref);
  - `getHealth(AbortSignal.timeout(KEEP_ALIVE_TIMEOUT_MS))` wrapped in `try/catch`; **swallow all
    errors** (network, 5xx during cold start, `ApiError`, `NEXT_PUBLIC_API_URL` missing). Never
    surfaces to the UI; at most `console.debug`.
- Scheduling:
  - on mount: `ping()` immediately (warms the API before the page's first real data request), then
    `setInterval(ping, KEEP_ALIVE_INTERVAL_MS)` if `document.visibilityState === "visible"`;
  - `document.addEventListener("visibilitychange", …)`: on `hidden` → `clearInterval`; on
    `visible` → `ping()` immediately (the app may have scaled down while the tab was hidden) then
    restart the interval;
  - cleanup: clear interval, remove listener, abort in-flight request.
- Runs on every page (public and protected). The user's requirement is "website is active on a
  browser", and keeping it global is simplest; the visible-tab gate is what bounds cost.

### 2. Mount it in `frontend/src/app/layout.tsx`

Render `<ApiKeepAlive />` as the **first child of `<body>`, outside `<AuthProvider>`**. It needs no
context, and `AuthProvider` returns `null` until MSAL initialises, so mounting outside it gets the
first ping out as early as possible. Import alongside the other components.

### 3. Documentation

- Add a one-line bullet under **Frontend** in the root `CLAUDE.md` describing the keep-alive
  component and why `/api/healthz` is the only safe route to ping.
- Copy this plan into the repo at `plans/frontend-api-keep-alive-plan.md` (plans live in the
  top-level `plans/` directory).

## Cost check ($0 constraint)

- No new Azure resources, no `min_replicas` change.
- While at least one tab is visible, one replica (API 0.25 vCPU/0.5 GiB + Postgres sidecar
  0.25 vCPU/0.5 GiB) stays up. Between pings it is billed at ACA's idle rate, and the monthly free
  grant (vCPU-seconds, GiB-seconds and 2 M requests) applies. One ping per 2 minutes per tab is
  ~720 requests/day/tab, negligible against the request grant.
- Worst case is a tab left open and visible 24/7, which approaches the vCPU-second grant; that is
  still cheaper than `min_replicas = 1`, which was rejected earlier in
  `plans/dotnet-api-container-apps-plan.md`. The hidden-tab pause is what keeps this bounded, so
  it must not be dropped.

## Verification

1. `cd frontend && npm run lint && npm run build` — static export still succeeds.
2. Run the API locally (`dotnet run --project backend/src/Ishqnama.Api`) and `npm run dev`; open
   `http://localhost:3000` with DevTools Network filtered to `healthz`:
   - one `GET /api/healthz` on page load, HTTP 200, `{"status":"healthy"}`;
   - another every ~2 min while the tab is in the foreground;
   - switch to another tab for >2 min → no requests; switch back → an immediate request, then the
     2-minute cadence resumes;
   - navigate between `/`, `/about`, `/quran/1` → no duplicate intervals (only one request per
     period; the root layout component is not remounted by App Router navigation).
3. Stop the API and reload: no console errors beyond a debug line, no UI change, no unhandled
   promise rejection.
4. After deploy to dev: open `https://dev.ishqnama.com`, leave the tab visible for 10 minutes,
   then load a new sura — response should be warm (sub-second), not a cold start. Confirm in the
   Container App's revision replica count (stays at 1 while the tab is open, returns to 0 a few
   minutes after closing it).
