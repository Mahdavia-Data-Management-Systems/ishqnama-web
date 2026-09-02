# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ishqnama is a Quranic data web app (verses, translations, tafseer) with a monorepo structure: **frontend** (Next.js SPA), **backend** (.NET 9 Azure Functions API), and **infra** (Terraform). The backend CLAUDE.md has detailed backend guidance — see `backend/CLAUDE.md`.

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
cd src/Ishqnama.Functions && func start         # Run locally (needs Azure Functions Core Tools)
bash start-local-db.sh                          # Start PostgreSQL + Cosmos DB emulator via Podman
```

### Database

```bash
podman run -d --name ishqnama-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres docker.io/noormahdi/ishqnama-db:dev
```

### Infrastructure (`infra/environments/{dev|prod}/`)

```bash
terraform init && terraform plan    # Preview changes
terraform apply                     # Deploy
```

## Architecture

```
frontend/          Next.js 15 + React 19, static export, Azure Static Web App
backend/           .NET 9 Azure Functions, Clean Architecture, PostgreSQL (read-only) + Cosmos DB (user data)
infra/             Terraform modules: azure/ (swa, functions, keyvault, aca, cosmosdb)
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
- **Public pages**: `/`, `/about`, `/contact`, `/terms`, `/privacy`
- **Protected pages**: `/quran/*` — guarded by `<ProtectedRoute>` in `src/app/quran/layout.tsx`
- **SPA routing**: `public/staticwebapp.config.json` configures Azure SWA fallback to `index.html`
- **Path aliases**: `@/*` maps to `src/*`

### Backend

Clean Architecture: Domain → Application → Infrastructure → Functions. Two data stores:
1. **PostgreSQL** (read-only) — Quran data served via `IQuranReadOnlyRepository` with `CachedQuranReadOnlyRepository` (loads all data into memory on first request)
2. **Cosmos DB** (read-write) — User data (settings, bookmarks, favorites, history) via `IUserDataRepository`, protected by JWT auth middleware

See `backend/CLAUDE.md` for full details.

### Infrastructure

Terraform modules deploy to Azure: Static Web App (frontend), Functions (backend), Container Apps (PostgreSQL), Key Vault (secrets), Cosmos DB (user data, free tier). Two environments: dev and prod. Azure auth via OIDC federated identity.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- **`ci.yml`** — Main pipeline: build backend → deploy infra → deploy frontend → deploy backend (dev)
- **`deploy-frontend.yml`** / **`deploy-backend.yml`** / **`deploy-infra.yml`** — Reusable callable workflows
- **`prod-release.yml`** — Manual trigger for production deployment
- **`destroy-infra.yml`** — Manual trigger to tear down infrastructure

Push to `main` triggers the full dev deployment pipeline.
