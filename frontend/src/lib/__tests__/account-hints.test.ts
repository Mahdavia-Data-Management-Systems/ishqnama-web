import type { AccountInfo } from "@azure/msal-browser";
import { describe, expect, it } from "vitest";
import { interactiveRequestFor } from "@/lib/account-hints";

const scopes = ["api://ishqnama/access"];

function account(idTokenClaims?: Record<string, unknown>): AccountInfo {
  return {
    homeAccountId: "h",
    localAccountId: "l",
    environment: "e",
    tenantId: "t",
    username: "0f8fad5b-d9cb-469f-a165-70867728950e@mahdavisonline.onmicrosoft.com",
    idTokenClaims,
  } as AccountInfo;
}

describe("interactiveRequestFor", () => {
  it("passes only scopes and account when the token carries no usable hints", () => {
    expect(interactiveRequestFor(account(), scopes)).toEqual({ scopes, account: account() });
    expect(interactiveRequestFor(account({ oid: "x" }), scopes)).toEqual({
      scopes,
      account: account({ oid: "x" }),
    });
  });

  it("sends a local account's email without the account, so MSAL cannot send the opaque login_hint claim", () => {
    const acc = account({ email: "reader@example.com", login_hint: "O.opaque" });
    const request = interactiveRequestFor(acc, scopes);
    expect(request).toEqual({ scopes, loginHint: "reader@example.com" });
    expect(request.account).toBeUndefined();
  });

  it("falls back to the mapped emailAddress claim, then the emails array", () => {
    expect(interactiveRequestFor(account({ emailAddress: "r@example.com" }), scopes).loginHint).toBe("r@example.com");
    expect(interactiveRequestFor(account({ emails: ["first@example.com", "x@y"] }), scopes).loginHint).toBe(
      "first@example.com",
    );
  });

  it("never sends a principal name as the login hint", () => {
    const acc = account({ email: "abc@mahdavisonline.onmicrosoft.com" });
    expect(interactiveRequestFor(acc, scopes).loginHint).toBeUndefined();
  });

  it("adds domain_hint=google for a reader who signed in with Google", () => {
    const acc = account({ idp: "google.com", email: "reader@gmail.com" });
    expect(interactiveRequestFor(acc, scopes)).toEqual({
      scopes,
      account: acc,
      loginHint: "reader@gmail.com",
      domainHint: "google",
    });
  });

  it("adds domain_hint=facebook for a reader who signed in with Facebook", () => {
    expect(interactiveRequestFor(account({ idp: "facebook.com" }), scopes).domainHint).toBe("facebook");
  });

  it("leaves domain_hint out for local accounts and unknown providers", () => {
    expect(interactiveRequestFor(account({ idp: "https://login.microsoftonline.com/t/v2.0" }), scopes).domainHint)
      .toBeUndefined();
    expect(interactiveRequestFor(account({ idp: "apple.com" }), scopes).domainHint).toBeUndefined();
    expect(interactiveRequestFor(account({ email: "r@example.com" }), scopes).domainHint).toBeUndefined();
  });
});
