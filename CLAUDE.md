# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ishqnama is a Quranic data web app (verses, translations, tafseer) with a monorepo structure: **frontend** (Next.js SPA), **backend** (.NET 9 API — the Minimal API on Container Apps is what the frontend calls; the Azure Functions host still builds but is no longer deployed), and **infra** (Terraform). The backend CLAUDE.md has detailed backend guidance — see `backend/CLAUDE.md`.

## Build & Run Commands

### Frontend (`frontend/`)

```bash
npm ci            # Install dependencies
npm run dev       # Dev server at http://localhost:3000
npm run build     # Static export to out/
npm run lint      # ESLint via Next.js
npm test          # Vitest unit tests (jsdom)
```

### Backend (`backend/`)

```bash
dotnet build                                    # Build solution
cd backend && docker-compose up -d --build      # Start PostgreSQL + Cosmos DB Emulator + the API image (:5081)
cd src/Ishqnama.Functions && func start         # Run the Functions host (needs Azure Functions Core Tools) — :7071
dotnet run --project src/Ishqnama.Api           # Run the Minimal API — :5080, Scalar UI at /scalar in Development
```

### Infrastructure (`infra/environments/{dev|prod}/`)

```bash
terraform init && terraform plan    # Preview changes
terraform apply                     # Deploy
```

## Architecture

```
frontend/          Next.js 15 + React 19, static export, Azure Static Web App
backend/           .NET 9 Minimal API (+ legacy Functions host, not deployed), Clean Architecture, PostgreSQL (read-only) + Cosmos DB (user data)
infra/             Terraform modules: azure/ (swa, keyvault, aca-environment, aca-app, cosmosdb)
```

### Frontend

- **Next.js 15 App Router** with `output: "export"` and `trailingSlash: true` — generates static HTML into `out/`
- **Fonts**: Google Fonts loaded via `next/font/google` (EB Garamond, Source Sans 3, Noto Serif, Noto Serif Devanagari) with CSS variable injection; local `@font-face` for Arabic/Urdu fonts
- **Auth**: Azure Entra ID External (CIAM) via MSAL.js v5 client-side redirect flow with PKCE
  - Config: `src/config/auth-config.ts`
  - Components: `auth-provider.tsx`, `protected-route.tsx`, `auth-button.tsx`, `app-shell.tsx`
  - **Redirect bridge**: msal-browser v5 does not read the auth response out of the hidden iframe (silent renewal) or popup it opened; the page at the redirect URI must call `broadcastResponseToMainFrame()` from `@azure/msal-browser/redirect-bridge`, or the main frame fails after 10 s with `timed_out`. That page is `src/app/redirect/page.tsx`, its path is the `AUTH_REDIRECT_PATH` constant (`/redirect/`) in `src/lib/auth-redirect.ts`, and `redirectUri` defaults to it. `src/components/app-shell.tsx` (everything inside `<body>`) renders that route bare, with no `AuthProvider`, keep-alive ping or app chrome, so the iframe loads only the bridge. Every SPA redirect URI registered in Entra must be `<origin>/redirect/` with the trailing slash (the static export writes `redirect/index.html` and Entra matches exactly). SPA refresh tokens expire 24 h after sign-in, so this iframe path runs at least daily for a returning reader; browsers that block third-party cookies make it return `login_required`, which `MsalAuthenticationTemplate` turns into an automatic `loginRedirect`
  - Env vars: `NEXT_PUBLIC_ENTRA_CLIENT_ID`, `NEXT_PUBLIC_ENTRA_AUTHORITY`, `NEXT_PUBLIC_ENTRA_REDIRECT_URI`, `NEXT_PUBLIC_ENTRA_API_SCOPE`, `NEXT_PUBLIC_API_URL`
  - **SPA registration settings** (all app registrations are portal-managed, not Terraform; documented in `infra/README.md` section 6): the SPA's enterprise application maps a custom claim `emailAddress` to `user.mail`, and the app registration manifest has `acceptMappedClaims: true` (without it the mapped claim is dropped) and `isFallbackPublicClient: true` (public-client PKCE flow, no client secret). Nothing in the code reads `emailAddress` yet; users are identified by `oid`
- **User data**: Authenticated users get settings persistence, bookmarks, favorites, and reading history via `src/lib/user-api.ts` → backend Cosmos DB
  - Reader settings synced via debounced save in `src/context/reader-settings-context.tsx`
  - Bookmarks synced per-sura in `src/app/quran/[sura]/sura-reader-client.tsx`
  - Saved page (`src/app/saved/page.tsx`) displays bookmarks, favorites, and history
- **API keep-alive and readiness**: `src/components/api-keep-alive.tsx` (mounted in `src/components/app-shell.tsx`, skipped on the redirect bridge route) pings `GET /api/healthz` on load, on tab visibility, on the browser `online` event and every 2 minutes while the tab is visible, pausing when hidden, so the scale-to-zero Container App stays warm while someone is reading. The ping is also the probe behind `src/lib/api-readiness.ts`, a module-level store exposing `unknown | warming | ready | unreachable` through `useApiReadiness()`: `warming` after the ping has hung for 3 s (cold starts take ~50 s on dev, so the ping timeout is 90 s), `ready` when it answers (which runs every `onReady()` callback once), `unreachable` on failure, timeout or offline (then it re-pings every 15 s, and `requestProbe()` pings on demand). `/api/healthz` is the only route safe to ping: it is anonymous, skips the database, and is excluded from the long-lived `Cache-Control` header every other `/api` route carries
- **Cold-start UI**: while the store says `warming` or `unreachable`, the loading rail breathes instead of gleaming, `src/components/api-warmup-notice.tsx` hangs a gold bookmark ribbon from the app bar (the only looping motion is the rail; both follow the bar's real bottom edge via `useAppBarBottom()` in `src/lib/app-bar-offset.ts` and clamp at the viewport top, because the sticky bar scrolls away with the `height: 100%` body on long pages), the reader placeholder and the bookmark shelves (skeletons from `src/components/bookmark-tile-skeleton.tsx`) explain the wait, the settings sheet shows a sync line, and the create-bookmark dialog shows a helper line (its POST has a 90 s abort). `src/context/reader-settings-context.tsx` never treats a failed settings GET as loaded (it retries on `ready`), keeps changes made before the GET succeeded in a pending patch merged over the server values, and queues PUTs while warming, flushing the latest value once on `ready`. `src/context/bookmarks-context.tsx` exposes `status` and refetches a failed GET on `ready`. All copy lives in `src/config/readiness-copy.ts` and must avoid technical words (no "service", "API", "server"); the audience includes readers unfamiliar with technology. Design in `plans/frontend-cold-start-handling-spec.md`
- **Global loading indicator**: `src/components/global-loading-indicator.tsx` (mounted in `src/components/app-shell.tsx`, outside `AuthProvider` so it works before MSAL initialises) lights up a 2px gold rail on the seam between the app bar and the page while API requests are in flight. Every network call in `src/lib/api-client.ts` is counted via `beginRequest()` from `src/lib/pending-requests.ts`, from before `fetch` until the body is parsed, including the keep-alive ping; MSAL token acquisition is not counted. To avoid flicker it paints nothing until requests have been pending for 300 ms, then stays at least 600 ms, lingers 150 ms after the last request settles (bridging the reader's chained verse-page and ruku calls) and fades on opacity only. It is `position: fixed`, `pointer-events: none` and `aria-hidden`; the per-page inline loaders remain the explanatory loading state
- **PWA name per environment**: `public/manifest.json` names the app "Ishqnama". An inline head script from `src/lib/pwa-manifest.ts` (rendered in the root layout) suffixes the environment for installs from `<sub>.ishqnama.com` hosts other than `www`, e.g. "Ishqnama - Dev" on dev.ishqnama.com and "Ishqnama - Preview" on preview.ishqnama.com, by swapping the manifest link for a data: URL copy with the new name and setting `apple-mobile-web-app-title`. It has to be runtime, not a build-time env var, because the prod build serves `ishqnama.com`, `www` and `preview` alike. Production and unknown hosts keep the static manifest untouched
- **The printed volume**: `src/components/book-model/book-model.tsx` renders the Noor e Imaan book as a Three.js scene on the signed-out home hero (`variant="hero"`, pointer tilt), the continue-reading card (`variant="card"`, a gold ribbon at the reader's `quranProgress()` through all 6236 verses, from `src/lib/quran-progress.ts`) and the About page (`variant="inspect"`, drag to rotate, pinch to zoom; a plain mouse wheel still scrolls the page, only a trackpad pinch, which arrives as a ctrl+wheel event, zooms). The component owns lifecycle only: it shows the poster `public/images/noor-e-imaan-book-poster.webp` first, and only when `canRenderBook()` in `src/lib/book-model-support.ts` passes (no reduced motion, no Save-Data, at least 2 GB device memory, WebGL 2 available), the box is within 200 px of the viewport and the window has loaded does it `import()` `book-scene.ts`, so Three.js is a separate chunk never loaded by `/quran/*`. The scene renders on demand (no frames at rest) and any failure leaves the poster. The consumer sizes the box through `className`; the component's own default size sits in a `:where()` rule so it never outranks the consumer's class. The served model `public/models/noor-e-imaan-book.v1.glb` (about 370 KB, budget 500 KB) is built from the 34 MB Blender export `design/noor_e_iman_book.glb` by `npm run model:build`; the poster is captured from the live dev server by `npm run model:poster` (needs local Chrome; the dev server must not share its `.next` folder with a concurrent `npm run build`, which 404s the dev chunks). The cover is a single mesh with no hinge, so the book does not open; the spec `plans/frontend-book-model-spec.md` records the Blender work an opening transition would need. Copy rules from the cold-start work apply: nothing says "3D", "model" or "loading"
- **Sharing a verse**: the Share button on a verse (continuous-mode block or verse-mode popup) opens `src/components/scripture/share-verse-sheet.tsx`, a bottom sheet headed simply "Share" over the verse reference, with two options named for what the recipient receives rather than where the link opens from: **"This ayah"** shares the chapter link (`/quran/<c>/?verse=<v>`, which scrolls to and flashes the verse; hint "<chapter name>, verse <v>") and **"This ruku"** shares the ruku within the juz (`/quran/juz/<j>/ruku/<r>/`, deliberately without a `?verse=` query: the ruku link shares the passage and opens at its start; hint "Ruku <r> of juz <j>"). A third "From its juz" option (`/quran/juz/<j>/?verse=<c>-<v>`) was removed as redundant with the ruku one, and the options were renamed from "From its chapter"/"From its ruku" at the same time. The juz and ruku numbers come from the reader's `rukuMap` (the verse's `RukuDto`), so the ruku option stays disabled with the hint "Finding its place in the book" until it loads. Link and message builders live in `src/lib/share-verse.ts`; the message opens with "Noor-e-Imaan | <chapter name> <c>:<v>", plus " | Juz <j>, Ruku <r>" when shared from the ruku (so the recipient still sees which verse prompted the share even though that link opens at the ruku's start), then the translation as displayed on its own line, never the Arabic. The link travels separately: `navigator.share` gets it in `url` only (share targets append `url` to `text` themselves, so putting it in both printed it twice), and the clipboard fallback appends it once to the copied text, with a "Copied" confirmation in the sheet that closes it after a moment
- **Public pages**: `/`, `/about`, `/contact`, `/terms`, `/privacy`, `/redirect/` (MSAL bridge) and all of `/quran/*`. The reader is open to anonymous users; verse explanations (tafseer) are the paid-for feature: the API strips `explanation` from every verse response unless the request carries a valid bearer token (`StripExplanations` in `backend/src/Ishqnama.Api/Helpers/AuthExtensions.cs`), and the frontend sends one when it has an account via `apiFetchWithOptionalAuth`
- **Protected pages**: `/saved` — guarded by `<ProtectedRoute>` in `src/app/saved/layout.tsx`. `/search` is public UI but the `/api/search` call requires a token
- **SPA routing**: `public/staticwebapp.config.json` configures Azure SWA fallback to `index.html`
- **Path aliases**: `@/*` maps to `src/*`

### Backend

Clean Architecture: Domain → Application → Infrastructure → presentation (`Ishqnama.Functions` and `Ishqnama.Api`, same `/api` routes). Two data stores:
1. **PostgreSQL** (read-only) — Quran data served via `IQuranReadOnlyRepository` with `CachedQuranReadOnlyRepository` (loads all data into memory on first request)
2. **Cosmos DB** (read-write) — User data (settings, bookmarks, favorites, history) via `IUserDataRepository`, protected by JWT auth middleware
3. **Search** — `/api/search` searches translation/tafseer text, protected by JWT auth to prevent abuse

See `backend/CLAUDE.md` for full details.

### Infrastructure

Terraform modules deploy to Azure: Static Web App (frontend), Container Apps (API with a PostgreSQL sidecar, scale-to-zero), Key Vault (secrets), Cosmos DB (user data, free tier). The SWA's `NEXT_PUBLIC_API_URL` is `https://api.dev.ishqnama.com/api`, from `local.api_url` in `infra/environments/dev/ishqnama-api.tf`. That custom domain (Cloudflare DNS-only CNAME to the Container App FQDN, `asuid` TXT record, and Azure managed certificate) was added by hand in the portal and is not in Terraform. Container Apps has no path routing: the hostname selects the app and the path passes through, so the `/api` prefix is simply the `MapGroup("/api")` in the API's `Program.cs`. Two environments: dev and prod. `infra/environments/prod/` mirrors dev with prod names (`rg-ishqnama-prod`, `ca-ishqnama-api-prod`, `cosmos-ishqnama-prod`), `ishqnama.com`/`www.ishqnama.com`/`preview.ishqnama.com` as the frontend hosts and `https://api.ishqnama.com` as the API URL, reads the CIAM tenant from the `core-prod` Terraform Cloud workspace (`mdms_core_workspace` variable) and defaults `api_image_tag` and `db_image_tag` to `latest`. Dev and prod each have a dedicated Azure subscription, so each gets its own Cosmos DB free-tier account. Azure auth via OIDC federated identity. Everything Terraform does not manage (subscription and resource provider setup, the CI service principal and its Contributor role, GitHub environment variables, Terraform Cloud workspaces, custom domains, and every Entra app registration) is documented step by step in `infra/README.md`. All Entra app registrations (SPA, `Ishqnama API`, the CI service principal) are managed by hand in the portal; Terraform only consumes their client IDs, so never propose `azuread` resources for them.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- **`ci.yml`** — Main pipeline: build backend (+ push API image) → deploy infra → deploy frontend (dev). The image version from `build-backend.yml` is passed to `deploy-infra.yml` as `api_image_tag`, so every push changes the Container App's image reference and Terraform rolls a new revision (re-pushing a fixed tag would not). A `changes` job (`dorny/paths-filter`) gates the deploy jobs by changed paths: `setup-zone` runs for `infra/environments/cloudflare/`, `infra-dev` for `infra/` or `backend/` (Terraform rolling the image tag is what deploys the API), and `deploy-frontend-dev` for `frontend/` or whenever `infra-dev` ran (the frontend bakes SWA app settings into its build). Each filter also includes the reusable workflow it drives. `build` runs only for `backend/` changes; when it is skipped but `infra-dev` still runs, an `api-version` job resolves the newest `api-v*` git tag so the Container App keeps its current image reference. A manual `workflow_dispatch` run builds and deploys everything
- **`build-backend.yml`** / **`deploy-frontend.yml`** / **`deploy-infra.yml`** — Reusable callable workflows. `build-backend.yml` runs two parallel jobs: a Release build of the backend solution, and build + push of the `noormahdi/ishqnama-api` Docker image. For non-prod environments the image is tagged with a patch-bumped semantic version from `api-v*.*.*` git tags plus `:<environment>`, the git tag is created (callers need `contents: write`), and the version is exposed as the `api_image_version` output. Its `prod` branch (push `:latest` only, no version or git tag) is no longer used: prod images are promoted from dev versions by `prod-release.yml`. The Functions host in `backend/src/Ishqnama.Functions` is built as part of the solution but has no deployment target any more
- **`prod-release.yml`** — Manual trigger for production deployment. It promotes rather than rebuilds: a `resolve-api-version` job takes an optional `api_image_version` input (defaulting to the newest `api-v*` git tag), checks the tag and the Docker Hub image exist, retags that image as `:latest` without rebuilding, and passes the version to `deploy-infra.yml` as `api_image_tag` so the prod Container App rolls to exactly the image that ran in dev. The frontend deploy follows, as in dev. A `concurrency` group serialises releases
- **`destroy-infra.yml`** — Manual trigger to tear down infrastructure
- **`pr-validation.yml`** — Runs on `pull_request` into `main`: frontend build, backend Release build, `terraform fmt -check`. It is the only workflow a fork can trigger, so it holds no secrets, declares no environment and takes a read-only token; its three job names are required status checks on `main`

Push to `main` triggers the full dev deployment pipeline.

The repository is public, so deployments are fenced off with GitHub settings rather than code: the `dev`, `prod` and `cloudflare` environments accept deployments from `main` only (which, given the `...:environment:<env>` federated credential subject, is what binds Azure access to `main`), `prod` requires a review, workflows may only use actions on an allowlist, and `api-v*` tags are protected from deletion and force-moves. All of it is documented in `infra/README.md` under **Repository protection**.
