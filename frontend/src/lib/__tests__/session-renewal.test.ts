import type { AccountInfo } from "@azure/msal-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATTEMPT_WINDOW_MS,
  recoverExpiredSession,
  resetSessionRenewalForTests,
} from "@/lib/session-renewal";

const account = { homeAccountId: "h", localAccountId: "l", environment: "e", tenantId: "t", username: "u" } as AccountInfo;
const scopes = ["api://ishqnama/access"];

function makeInstance() {
  return {
    acquireTokenRedirect: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    setActiveAccount: vi.fn(),
  };
}

describe("recoverExpiredSession", () => {
  beforeEach(() => {
    resetSessionRenewalForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    resetSessionRenewalForTests();
  });

  it("sends the reader through Entra once on the first failure", async () => {
    const instance = makeInstance();
    const outcome = await recoverExpiredSession(instance, account, scopes, 1_000);
    expect(outcome).toBe("redirected");
    expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1);
    expect(instance.acquireTokenRedirect).toHaveBeenCalledWith({ scopes, account });
    expect(instance.clearCache).not.toHaveBeenCalled();
  });

  it("carries the reader's email and provider hints from the cached token", async () => {
    const instance = makeInstance();
    const google = { ...account, idTokenClaims: { idp: "google.com", email: "reader@gmail.com" } } as AccountInfo;
    await recoverExpiredSession(instance, google, scopes, 1_000);
    expect(instance.acquireTokenRedirect).toHaveBeenCalledWith({
      scopes,
      account: google,
      loginHint: "reader@gmail.com",
      domainHint: "google",
    });
  });

  it("does not start a second redirect for parallel requests in the same page load", async () => {
    const instance = makeInstance();
    await recoverExpiredSession(instance, account, scopes, 1_000);
    const outcome = await recoverExpiredSession(instance, account, scopes, 1_001);
    expect(outcome).toBe("redirect-pending");
    expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1);
  });

  it("signs the reader out locally when the redirect did not produce a token", async () => {
    const first = makeInstance();
    await recoverExpiredSession(first, account, scopes, 1_000);

    // The reader is back on the page (new load) shortly afterwards, still without a token.
    resetInMemoryFlagOnly();
    const second = makeInstance();
    const outcome = await recoverExpiredSession(second, account, scopes, 1_000 + 60_000);
    expect(outcome).toBe("signed-out");
    expect(second.acquireTokenRedirect).not.toHaveBeenCalled();
    expect(second.clearCache).toHaveBeenCalledWith({ account });
    expect(second.setActiveAccount).toHaveBeenCalledWith(null);

    // The marker is consumed, so a later expiry redirects again.
    resetInMemoryFlagOnly();
    const third = makeInstance();
    expect(await recoverExpiredSession(third, account, scopes, 1_000 + 120_000)).toBe("redirected");
  });

  it("treats an old attempt as a new expiry and redirects again", async () => {
    const first = makeInstance();
    await recoverExpiredSession(first, account, scopes, 1_000);

    resetInMemoryFlagOnly();
    const second = makeInstance();
    const outcome = await recoverExpiredSession(second, account, scopes, 1_000 + ATTEMPT_WINDOW_MS);
    expect(outcome).toBe("redirected");
    expect(second.acquireTokenRedirect).toHaveBeenCalledTimes(1);
    expect(second.clearCache).not.toHaveBeenCalled();
  });

  it("still redirects when sessionStorage is unavailable", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      const instance = makeInstance();
      expect(await recoverExpiredSession(instance, account, scopes, 1_000)).toBe("redirected");
      expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("swallows a redirect that fails to start and does not retry in this page load", async () => {
    const instance = makeInstance();
    instance.acquireTokenRedirect.mockRejectedValue(new Error("interaction_in_progress"));
    expect(await recoverExpiredSession(instance, account, scopes, 1_000)).toBe("redirected");
    await Promise.resolve();
    expect(console.warn).toHaveBeenCalled();
    expect(await recoverExpiredSession(instance, account, scopes, 1_001)).toBe("redirect-pending");
    expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1);
  });
});

/** Simulates a fresh page load: the module flag is gone but sessionStorage survives. */
function resetInMemoryFlagOnly() {
  const marker = window.sessionStorage.getItem("ishqnama:session-renewal-attempted");
  resetSessionRenewalForTests();
  if (marker !== null) window.sessionStorage.setItem("ishqnama:session-renewal-attempted", marker);
}
