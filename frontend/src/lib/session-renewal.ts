import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { interactiveRequestFor } from "@/lib/account-hints";

/**
 * Recovers from an expired sign-in on public pages.
 *
 * Refresh tokens issued to a single-page app expire 24 hours after sign-in and cannot be
 * extended. When that happens acquireTokenSilent throws InteractionRequiredAuthError: the hidden
 * iframe found no Entra session, or the browser blocked its cookies. On /saved/ the
 * MsalAuthenticationTemplate falls back to a login redirect by itself, but the reader is public,
 * so before this module a signed-in reader kept their name in the menu while the explanations
 * quietly disappeared and nothing sent them back through Entra.
 *
 * The first failure in a page load sends the reader through Entra once with acquireTokenRedirect.
 * With a live Entra session that is a bounce back to the same page with fresh tokens and no
 * prompt. If the reader comes back within ATTEMPT_WINDOW_MS still unable to get a token, they did
 * not complete sign-in, so the stale account is cleared locally and the app is honestly signed
 * out instead of redirecting on every fetch. Nothing here touches the Entra session itself: a
 * server-side sign-out would make the reader type their password again.
 */

const MARKER_KEY = "ishqnama:session-renewal-attempted";

/** A redirect started within this window counts as the one attempt for the current expiry. */
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export type RenewalOutcome =
  /** The reader is being sent through Entra; the page is about to navigate away. */
  | "redirected"
  /** An earlier call in this page load already started the redirect. */
  | "redirect-pending"
  /** The previous redirect did not produce a token, so the stale account was cleared locally. */
  | "signed-out";

let redirectStarted = false;

function readMarker(): number | null {
  try {
    const value = window.sessionStorage.getItem(MARKER_KEY);
    if (value === null) return null;
    const at = Number(value);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

function writeMarker(at: number): void {
  try {
    window.sessionStorage.setItem(MARKER_KEY, String(at));
  } catch {
    // Storage blocked: the in-memory flag still prevents a second redirect in this page load.
  }
}

function clearMarker(): void {
  try {
    window.sessionStorage.removeItem(MARKER_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Call when acquireTokenSilent has thrown InteractionRequiredAuthError for `account`.
 * Resolves quickly in every case; the redirect itself happens in the background.
 */
export async function recoverExpiredSession(
  instance: Pick<IPublicClientApplication, "acquireTokenRedirect" | "clearCache" | "setActiveAccount">,
  account: AccountInfo,
  scopes: string[],
  now: number = Date.now(),
): Promise<RenewalOutcome> {
  if (redirectStarted) return "redirect-pending";

  const attemptedAt = readMarker();
  if (attemptedAt !== null && now - attemptedAt < ATTEMPT_WINDOW_MS) {
    clearMarker();
    try {
      await instance.clearCache({ account });
    } catch (err) {
      console.warn("[MSAL] could not clear the expired account:", err);
    }
    // Emits ACTIVE_ACCOUNT_CHANGED, which makes msal-react re-read the (now empty) account list.
    instance.setActiveAccount(null);
    return "signed-out";
  }

  redirectStarted = true;
  writeMarker(now);
  // MSAL records the current URL and the redirect bridge navigates back to it afterwards. The
  // request carries the reader's email, so Entra shows an address they recognise (or, for social
  // sign-ins, skips its page and goes straight to the provider) rather than the GUID principal name.
  instance.acquireTokenRedirect(interactiveRequestFor(account, scopes)).catch((err: unknown) => {
    // Typically interaction_in_progress when another redirect has already begun. The flag stays
    // set so this page load does not keep retrying; the next load starts afresh.
    console.warn("[MSAL] could not start the sign-in redirect:", err);
  });
  return "redirected";
}

/** Test hook: forgets the in-memory "already redirecting" flag, as a page load would. */
export function resetSessionRenewalForTests(): void {
  redirectStarted = false;
  clearMarker();
}
