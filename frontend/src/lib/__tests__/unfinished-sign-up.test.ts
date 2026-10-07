import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATTEMPT_WINDOW_MS,
  isUnfinishedSignUpError,
  resetUnfinishedSignUpForTests,
  retryUnfinishedSignUp,
} from "@/lib/unfinished-sign-up";

const entraError = {
  errorCode: "invalid_request",
  errorMessage:
    "AADSTS16000: User account '{EUII Hidden}' from identity provider 'facebook.com' does not exist in tenant 'Mahdavis Online - Dev'",
};

function makeInstance() {
  return { loginRedirect: vi.fn().mockResolvedValue(undefined) };
}

describe("isUnfinishedSignUpError", () => {
  it("recognises AADSTS16000", () => {
    expect(isUnfinishedSignUpError(entraError)).toBe(true);
    expect(isUnfinishedSignUpError(new Error("invalid_request: AADSTS16000: ..."))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isUnfinishedSignUpError({ errorMessage: "AADSTS50196: request loop" })).toBe(false);
    expect(isUnfinishedSignUpError(null)).toBe(false);
    expect(isUnfinishedSignUpError("AADSTS16000")).toBe(false);
  });
});

describe("retryUnfinishedSignUp", () => {
  beforeEach(() => {
    resetUnfinishedSignUpForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    resetUnfinishedSignUpForTests();
  });

  it("sends the reader to Entra's sign-in page, ignoring its session", () => {
    const instance = makeInstance();
    expect(retryUnfinishedSignUp(instance, 1_000)).toBe(true);
    expect(instance.loginRedirect).toHaveBeenCalledWith(expect.objectContaining({ prompt: "login" }));
  });

  it("does not retry the same failure twice within the window", () => {
    retryUnfinishedSignUp(makeInstance(), 1_000);
    const second = makeInstance();
    expect(retryUnfinishedSignUp(second, 1_000 + ATTEMPT_WINDOW_MS - 1)).toBe(false);
    expect(second.loginRedirect).not.toHaveBeenCalled();

    // The marker is spent, so a later failure gets its own retry.
    const third = makeInstance();
    expect(retryUnfinishedSignUp(third, 2_000 + ATTEMPT_WINDOW_MS)).toBe(true);
  });

  it("retries again once the window has passed", () => {
    retryUnfinishedSignUp(makeInstance(), 1_000);
    const later = makeInstance();
    expect(retryUnfinishedSignUp(later, 1_000 + ATTEMPT_WINDOW_MS)).toBe(true);
    expect(later.loginRedirect).toHaveBeenCalledTimes(1);
  });

  it("swallows a redirect that cannot start", async () => {
    const instance = { loginRedirect: vi.fn().mockRejectedValue(new Error("interaction_in_progress")) };
    expect(retryUnfinishedSignUp(instance, 1_000)).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(console.warn).toHaveBeenCalled();
  });
});
