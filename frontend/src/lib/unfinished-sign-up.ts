import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "@/config/auth-config";

/**
 * Recovers from a sign-up the reader left half way.
 *
 * A reader who signs in with Google or Facebook for the first time is sent from the provider to
 * Entra's sign-up form, and only submitting it creates their user in the tenant. If they close the
 * browser on that form, Entra still keeps a session for the provider identity. On the next sign-in
 * it reuses that session without showing any page, finds no user for it and sends the app
 * AADSTS16000 ("User account ... from identity provider 'facebook.com' does not exist in tenant"),
 * which handleRedirectPromise throws. Every later attempt does the same until the session ends.
 *
 * prompt=login makes Entra ignore that session and show its sign-in page, so choosing the provider
 * again leads back to the sign-up form. That redirect is tried once: if the reader comes back
 * within ATTEMPT_WINDOW_MS with the same error, they are left signed out rather than sent round again.
 */

const MARKER_KEY = "ishqnama:unfinished-sign-up-retried";

/** A retry started within this window counts as the one retry for this failure. */
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const UNKNOWN_USER_CODE = "AADSTS16000";

export function isUnfinishedSignUpError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { errorMessage, message } = err as { errorMessage?: unknown; message?: unknown };
  return [errorMessage, message].some((text) => typeof text === "string" && text.includes(UNKNOWN_USER_CODE));
}

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
    // Storage blocked: the retry still happens, and a repeat failure lands here again.
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
 * Call when handleRedirectPromise has thrown an AADSTS16000 error. Returns true when the reader is
 * being sent back to Entra's sign-in page, false when this failure was already retried.
 */
export function retryUnfinishedSignUp(
  instance: Pick<IPublicClientApplication, "loginRedirect">,
  now: number = Date.now(),
): boolean {
  const attemptedAt = readMarker();
  if (attemptedAt !== null && now - attemptedAt < ATTEMPT_WINDOW_MS) {
    clearMarker();
    return false;
  }

  writeMarker(now);
  instance.loginRedirect({ ...loginRequest, prompt: "login" }).catch((err: unknown) => {
    console.warn("[MSAL] could not start the sign-in redirect:", err);
  });
  return true;
}

/** Test hook: forgets the retry marker, as a new browser session would. */
export function resetUnfinishedSignUpForTests(): void {
  clearMarker();
}
