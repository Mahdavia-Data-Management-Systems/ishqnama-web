# Authentication with Azure Entra ID External (MSAL.js)

## Overview

Client-side authentication using `@azure/msal-browser` and `@azure/msal-react` with Azure Entra External ID (CIAM). Works with static export on Azure Static Web App Free tier — no SWA built-in auth needed.

## Architecture

- **Public pages**: `/`, `/about`, `/contact`, `/terms`, `/privacy` — no login required
- **Protected pages**: `/quran/*` — requires authentication via `<ProtectedRoute>`
- **Auth flow**: MSAL.js redirect flow with PKCE (no client secret)
- **Token storage**: localStorage (persistent across tabs)
- **API protection**: Actual data is gated server-side by Azure API Management; client-side auth is UX gating

## Key Files

| File | Purpose |
|------|---------|
| `src/config/auth-config.ts` | MSAL configuration (client ID, authority, scopes) |
| `src/components/auth-provider.tsx` | Initializes MSAL instance, wraps app with `MsalProvider` |
| `src/components/protected-route.tsx` | Redirects unauthenticated users to login |
| `src/components/auth-button.tsx` | Login/logout button component |
| `src/app/quran/layout.tsx` | Wraps Quran pages with `<ProtectedRoute>` |
| `public/staticwebapp.config.json` | SWA navigation fallback for SPA routing |
| `.env.example` | Documents required env vars |

## Environment Variables

```
NEXT_PUBLIC_ENTRA_CLIENT_ID=<app-registration-client-id>
NEXT_PUBLIC_ENTRA_AUTHORITY=https://<tenant>.ciamlogin.com/
NEXT_PUBLIC_ENTRA_REDIRECT_URI=http://localhost:3000
```

Create `.env.local` with real values (never committed).

## Azure Setup (Manual)

1. Create app registration in Azure Entra External ID tenant
2. Set platform to **Single-page application** (not Web)
3. Add redirect URIs: `http://localhost:3000` (dev), `https://<swa-hostname>` (prod)
4. Copy Application (client) ID and tenant subdomain into env vars

## Local Development

```bash
cp .env.example .env.local
# Fill in real values
npm run dev
```

Visit `/about` (public) and `/quran/` (triggers login redirect).
