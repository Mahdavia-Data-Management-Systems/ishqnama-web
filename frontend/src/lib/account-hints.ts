import type { AccountInfo, RedirectRequest } from "@azure/msal-browser";

/**
 * Builds the interactive (redirect) request for a reader who already has a cached account, so
 * that the Entra sign-in page shows them something they recognise.
 *
 * The tenant's ID tokens carry Microsoft's opaque `login_hint` claim, which MSAL sends first.
 * Entra resolves it to the user but then labels them on its page with the principal name,
 * `<guid>@<tenant>.onmicrosoft.com`, which no reader recognises. MSAL's order of preference is
 * that claim, then `sid` (only with prompt=none), then an explicit `loginHint`, then the
 * account username.
 *
 * So when the ID token has an email, the request carries it as `loginHint` and leaves `account`
 * out: MSAL then has no account to read the opaque claim from, and skips its active-account
 * lookup because `loginHint` is set. Entra looks the reader up by that email and, for readers who
 * signed in through Google or Facebook, goes straight to that provider without showing its own
 * page; local email accounts see their address on it. Without an email the account stays, as the
 * least-bad hint.
 *
 * The request never sets `domainHint`. In this tenant `domain_hint=google` on its own fails with
 * AADSTS90023 ("'google' '' pair is not an external identity provider"), and together with the
 * email `login_hint` it makes Entra answer every sign-in Google posts back with a redirect to
 * Google again, about 20 times, until it stops with AADSTS50196 (request loop). The email alone
 * already reaches the right provider, for Facebook too.
 */

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

export function interactiveRequestFor(account: AccountInfo, scopes: string[]): RedirectRequest {
  const loginHint = emailHintFor(account);
  return loginHint ? { scopes, loginHint } : { scopes, account };
}
