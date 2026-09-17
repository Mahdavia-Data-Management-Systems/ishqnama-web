/**
 * Path of the MSAL redirect bridge page (src/app/redirect/page.tsx).
 *
 * msal-browser v5 no longer reads the auth response out of the hidden iframe or
 * popup it opened. Instead the page loaded at the redirect URI must call
 * `broadcastResponseToMainFrame()`, which posts the response back over a
 * BroadcastChannel; the main frame gives up after `iframeBridgeTimeout` (10 s)
 * with `timed_out`. That page must therefore be a dedicated route that renders
 * nothing but the bridge call — no MsalProvider, no app chrome, no API calls.
 *
 * The trailing slash matters: the static export writes `redirect/index.html`
 * and Entra matches redirect URIs exactly, so the registered URIs are
 * `<origin>/redirect/`.
 */
export const AUTH_REDIRECT_PATH = "/redirect/";

/** True when `pathname` (with or without trailing slash) is the redirect bridge route. */
export function isAuthRedirectPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.replace(/\/+$/, "") === AUTH_REDIRECT_PATH.replace(/\/+$/, "");
}
