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
  - Components: `auth-provider.tsx`, `protected-route.tsx`, `auth-button.tsx`
  - Env vars: `NEXT_PUBLIC_ENTRA_CLIENT_ID`, `NEXT_PUBLIC_ENTRA_AUTHORITY`, `NEXT_PUBLIC_ENTRA_REDIRECT_URI`, `NEXT_PUBLIC_ENTRA_API_SCOPE`, `NEXT_PUBLIC_API_URL`
- **User data**: Authenticated users get settings persistence, bookmarks, favorites, and reading history via `src/lib/user-api.ts` → backend Cosmos DB
  - Reader settings synced via debounced save in `src/context/reader-settings-context.tsx`
  - Bookmarks synced per-sura in `src/app/quran/[sura]/sura-reader-client.tsx`
  - Saved page (`src/app/saved/page.tsx`) displays bookmarks, favorites, and history
- **API keep-alive**: `src/components/api-keep-alive.tsx` (mounted in the root layout) pings `GET /api/healthz` on load and every 2 minutes while the tab is visible, pausing when hidden, so the scale-to-zero Container App stays warm while someone is reading. `/api/healthz` is the only route safe to ping: it is anonymous, skips the database, and is excluded from the long-lived `Cache-Control` header every other `/api` route carries
- **PWA name per environment**: `public/manifest.json` names the app "Ishqnama". An inline head script from `src/lib/pwa-manifest.ts` (rendered in the root layout) suffixes the environment for installs from `<sub>.ishqnama.com` hosts other than `www`, e.g. "Ishqnama - Dev" on dev.ishqnama.com and "Ishqnama - Preview" on preview.ishqnama.com, by swapping the manifest link for a data: URL copy with the new name and setting `apple-mobile-web-app-title`. It has to be runtime, not a build-time env var, because the prod build serves `ishqnama.com`, `www` and `preview` alike. Production and unknown hosts keep the static manifest untouched
- **Public pages**: `/`, `/about`, `/contact`, `/terms`, `/privacy`
- **Protected pages**: `/quran/*` — guarded by `<ProtectedRoute>` in `src/app/quran/layout.tsx`
- **SPA routing**: `public/staticwebapp.config.json` configures Azure SWA fallback to `index.html`
- **Path aliases**: `@/*` maps to `src/*`

### Backend

Clean Architecture: Domain → Application → Infrastructure → presentation (`Ishqnama.Functions` and `Ishqnama.Api`, same `/api` routes). Two data stores:
1. **PostgreSQL** (read-only) — Quran data served via `IQuranReadOnlyRepository` with `CachedQuranReadOnlyRepository` (loads all data into memory on first request)
2. **Cosmos DB** (read-write) — User data (settings, bookmarks, favorites, history) via `IUserDataRepository`, protected by JWT auth middleware
3. **Search** — `/api/search` searches translation/tafseer text, protected by JWT auth to prevent abuse

See `backend/CLAUDE.md` for full details.

### Infrastructure

Terraform modules deploy to Azure: Static Web App (frontend), Container Apps (API with a PostgreSQL sidecar, scale-to-zero), Key Vault (secrets), Cosmos DB (user data, free tier). The SWA's `NEXT_PUBLIC_API_URL` is `https://api.dev.ishqnama.com/api`, from `local.api_url` in `infra/environments/dev/ishqnama-api.tf`. That custom domain (Cloudflare DNS-only CNAME to the Container App FQDN, `asuid` TXT record, and Azure managed certificate) was added by hand in the portal and is not in Terraform. Container Apps has no path routing: the hostname selects the app and the path passes through, so the `/api` prefix is simply the `MapGroup("/api")` in the API's `Program.cs`. Two environments: dev and prod. `infra/environments/prod/` mirrors dev with prod names (`rg-ishqnama-prod`, `ca-ishqnama-api-prod`, `cosmos-ishqnama-prod`), `ishqnama.com`/`www.ishqnama.com`/`preview.ishqnama.com` as the frontend hosts and `https://api.ishqnama.com` as the API URL, reads the CIAM tenant from the `core-prod` Terraform Cloud workspace (`mdms_core_workspace` variable) and defaults `api_image_tag` and `db_image_tag` to `latest`. Dev and prod each have a dedicated Azure subscription, so each gets its own Cosmos DB free-tier account. Azure auth via OIDC federated identity. Everything Terraform does not manage (subscription and resource provider setup, the CI service principal and its Contributor role, GitHub environment variables, Terraform Cloud workspaces, Entra redirect URIs, custom domains) is documented step by step in `infra/README.md`.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- **`ci.yml`** — Main pipeline: build backend (+ push API image) → deploy infra → deploy frontend (dev). The image version from `build-backend.yml` is passed to `deploy-infra.yml` as `api_image_tag`, so every push changes the Container App's image reference and Terraform rolls a new revision (re-pushing a fixed tag would not). A `changes` job (`dorny/paths-filter`) gates the deploy jobs by changed paths: `setup-zone` runs for `infra/environments/cloudflare/`, `infra-dev` for `infra/` or `backend/` (Terraform rolling the image tag is what deploys the API), and `deploy-frontend-dev` for `frontend/` or whenever `infra-dev` ran (the frontend bakes SWA app settings into its build). Each filter also includes the reusable workflow it drives. `build` runs only for `backend/` changes; when it is skipped but `infra-dev` still runs, an `api-version` job resolves the newest `api-v*` git tag so the Container App keeps its current image reference. A manual `workflow_dispatch` run builds and deploys everything
- **`build-backend.yml`** / **`deploy-frontend.yml`** / **`deploy-infra.yml`** — Reusable callable workflows. `build-backend.yml` runs two parallel jobs: a Release build of the backend solution, and build + push of the `noormahdi/ishqnama-api` Docker image. For non-prod environments the image is tagged with a patch-bumped semantic version from `api-v*.*.*` git tags plus `:<environment>`, the git tag is created (callers need `contents: write`), and the version is exposed as the `api_image_version` output. Its `prod` branch (push `:latest` only, no version or git tag) is no longer used: prod images are promoted from dev versions by `prod-release.yml`. The Functions host in `backend/src/Ishqnama.Functions` is built as part of the solution but has no deployment target any more
- **`prod-release.yml`** — Manual trigger for production deployment. It promotes rather than rebuilds: a `resolve-api-version` job takes an optional `api_image_version` input (defaulting to the newest `api-v*` git tag), checks the tag and the Docker Hub image exist, retags that image as `:latest` without rebuilding, and passes the version to `deploy-infra.yml` as `api_image_tag` so the prod Container App rolls to exactly the image that ran in dev. The frontend deploy follows, as in dev. A `concurrency` group serialises releases
- **`destroy-infra.yml`** — Manual trigger to tear down infrastructure
- **`pr-validation.yml`** — Runs on `pull_request` into `main`: frontend build, backend Release build, `terraform fmt -check`. It is the only workflow a fork can trigger, so it holds no secrets, declares no environment and takes a read-only token; its three job names are required status checks on `main`

Push to `main` triggers the full dev deployment pipeline.

The repository is public, so deployments are fenced off with GitHub settings rather than code: the `dev`, `prod` and `cloudflare` environments accept deployments from `main` only (which, given the `...:environment:<env>` federated credential subject, is what binds Azure access to `main`), `prod` requires a review, every action is pinned to a commit SHA against an allowlist, and `api-v*` tags are protected from deletion and force-moves. All of it is documented in `infra/README.md` under **Repository protection**.
