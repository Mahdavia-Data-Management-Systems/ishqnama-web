import type { AccountInfo, RedirectRequest } from "@azure/msal-browser";

/**
 * Builds the interactive (redirect) request for a reader who already has a cached account, so
 * that the Entra sign-in page shows them something they recognise.
 *
 * The tenant's ID tokens carry Microsoft's opaque `login_hint` claim, which MSAL sends first.
 * Entra resolves it to the user but then labels them on its page with the principal name,
 * `<guid>@<tenant>.onmicrosoft.com`, which no reader recognises. MSAL's order of preference is
 * that claim, then `sid` (only with prompt=none), then an explicit `loginHint`, then the
 * account username, and it deliberately skips the opaque claim when `domainHint` is set.
 *
 * So for readers who signed in through a social provider (the ID token's `idp` claim), this
 * sets `domainHint`, which makes External ID skip its own page and send them straight to that
 * provider ("issuer acceleration"), and `loginHint` with their email, which then reaches the
 * provider and preselects their account.
 *
 * For other readers (local email accounts) with an email, the request leaves `account` out:
 * MSAL then has no account to read the opaque claim from, skips its active-account lookup
 * because `loginHint` is set, and sends the email as `login_hint`, so Entra's page shows the
 * address the reader signed up with. Without an email the account stays, as the least-bad hint.
 */

/** External ID `domain_hint` values by the `idp` claim each provider the tenant federates with produces. */
const DOMAIN_HINT_BY_IDP: Record<string, string> = {
  "google.com": "google",
  "facebook.com": "facebook",
};

function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.includes("@") && !value.endsWith(".onmicrosoft.com");
}

/** The reader's email from the ID token, if any claim carries one. */
export function emailHintFor(account: AccountInfo): string | undefined {
  const claims = account.idTokenClaims;
  if (!claims) return undefined;
  // `emailAddress` is the custom claim the SPA's enterprise application maps to user.mail.
  const candidates: unknown[] = [claims.email, claims.emailAddress, claims.emails?.[0]];
  return candidates.find(isEmail);
}

/** The External ID `domain_hint` for the provider the reader signed in with, if it is a social one. */
export function domainHintFor(account: AccountInfo): string | undefined {
  const idp = account.idTokenClaims?.idp;
  return typeof idp === "string" ? DOMAIN_HINT_BY_IDP[idp.toLowerCase()] : undefined;
}

export function interactiveRequestFor(account: AccountInfo, scopes: string[]): RedirectRequest {
  const loginHint = emailHintFor(account);
  const domainHint = domainHintFor(account);
  if (domainHint) {
    const request: RedirectRequest = { scopes, account, domainHint };
    if (loginHint) request.loginHint = loginHint;
    return request;
  }
  return loginHint ? { scopes, loginHint } : { scopes, account };
}
