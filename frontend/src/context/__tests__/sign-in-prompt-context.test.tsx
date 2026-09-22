import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInPromptProvider, { useSignInGate, useSignInPrompt } from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";
import { loginRequest } from "@/config/auth-config";

const msal = vi.hoisted(() => ({
  authed: false,
  inProgress: "none",
  loginRedirect: vi.fn(),
}));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: msal.loginRedirect }, inProgress: msal.inProgress }),
}));
vi.mock("@azure/msal-browser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@azure/msal-browser")>();
  // auth-config.ts (imported transitively via loginRequest) also needs LogLevel from this
  // module at import time, so keep the real exports and only override InteractionStatus.
  return { ...actual, InteractionStatus: { None: "none" } };
});

function GateHarness() {
  const gate = useSignInGate("bookmark");
  const [ran, setRan] = useState(0);
  const [result, setResult] = useState("");
  return (
    <>
      <button onClick={() => setResult(String(gate(() => setRan((r) => r + 1))))}>go</button>
      <output data-testid="ran">{ran}</output>
      <output data-testid="result">{result}</output>
    </>
  );
}

function PromptHarness() {
  const { promptSignIn, dismiss, authSettled, isOpen } = useSignInPrompt();
  return (
    <>
      <button onClick={() => promptSignIn("search")}>prompt</button>
      <button onClick={dismiss}>dismiss</button>
      <output data-testid="settled">{String(authSettled)}</output>
      <output data-testid="open">{String(isOpen)}</output>
    </>
  );
}

function renderWith(ui: React.ReactNode) {
  return render(<SignInPromptProvider>{ui}</SignInPromptProvider>);
}

describe("useSignInGate", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
    msal.loginRedirect.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("runs the action and returns true when signed in", () => {
    msal.authed = true;
    renderWith(<GateHarness />);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByTestId("ran").textContent).toBe("1");
    expect(screen.getByTestId("result").textContent).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the prompt for its feature and returns false when anonymous", () => {
    renderWith(<GateHarness />);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByTestId("ran").textContent).toBe("0");
    expect(screen.getByTestId("result").textContent).toBe("false");
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.bookmark.title })).toBeTruthy();
  });
});

describe("SignInPromptProvider", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
    msal.loginRedirect.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("opens on promptSignIn and closes on dismiss", () => {
    renderWith(<PromptHarness />);
    expect(screen.getByTestId("open").textContent).toBe("false");
    fireEvent.click(screen.getByText("prompt"));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
    expect(screen.getByTestId("open").textContent).toBe("true");
    fireEvent.click(screen.getByText("dismiss"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts the redirect sign-in with the app's login request", () => {
    renderWith(<PromptHarness />);
    fireEvent.click(screen.getByText("prompt"));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(msal.loginRedirect).toHaveBeenCalledWith(loginRequest);
    // The sheet stays open while the browser navigates away.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("stays open if the redirect call rejects", async () => {
    msal.loginRedirect.mockRejectedValue(new Error("interaction_in_progress"));
    renderWith(<PromptHarness />);
    fireEvent.click(screen.getByText("prompt"));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await Promise.resolve();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes itself once the reader is signed in", () => {
    const view = renderWith(<PromptHarness />);
    fireEvent.click(screen.getByText("prompt"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    msal.authed = true;
    view.rerender(<SignInPromptProvider><PromptHarness /></SignInPromptProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports authSettled from MSAL's interaction status", () => {
    msal.inProgress = "startup";
    const view = renderWith(<PromptHarness />);
    expect(screen.getByTestId("settled").textContent).toBe("false");
    msal.inProgress = "none";
    view.rerender(<SignInPromptProvider><PromptHarness /></SignInPromptProvider>);
    expect(screen.getByTestId("settled").textContent).toBe("true");
  });

  it("throws when a hook is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<PromptHarness />)).toThrow(/SignInPromptProvider/);
    spy.mockRestore();
  });
});
