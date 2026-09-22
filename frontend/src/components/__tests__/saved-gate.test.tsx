import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SavedGate from "@/components/saved-gate";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";

const msal = vi.hoisted(() => ({ authed: false, inProgress: "none" }));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: msal.inProgress }),
}));
vi.mock("@azure/msal-browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@azure/msal-browser")>()),
  InteractionStatus: { None: "none" },
}));
// ProtectedRoute wraps MsalAuthenticationTemplate; here we only care that it is (or is not) mounted.
vi.mock("@/components/protected-route", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected">{children}</div>,
}));

function renderGate() {
  return render(
    <SignInPromptProvider>
      <SavedGate>
        <p>saved page content</p>
      </SavedGate>
    </SignInPromptProvider>,
  );
}

function rerenderGate(view: ReturnType<typeof render>) {
  view.rerender(
    <SignInPromptProvider>
      <SavedGate>
        <p>saved page content</p>
      </SavedGate>
    </SignInPromptProvider>,
  );
}

describe("SavedGate", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
  });
  afterEach(cleanup);

  it("shows the signing-in spinner and mounts nothing else while MSAL is still starting", () => {
    msal.inProgress = "startup";
    renderGate();
    expect(screen.getByText("Signing in...")).toBeTruthy();
    expect(screen.queryByTestId("protected")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("saved page content")).toBeNull();
  });

  it("shows the page shell and opens the prompt once for an anonymous reader", () => {
    const view = renderGate();
    expect(screen.getByRole("heading", { name: "Saved" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.saved.title })).toBeTruthy();
    expect(screen.queryByTestId("protected")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    rerenderGate(view);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the inline empty state reopen the prompt after it was dismissed", () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    // The inline empty state's button and the (closed) sheet share the label; only one remains.
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.saved.title })).toBeTruthy();
  });

  it("renders the page inside ProtectedRoute for a signed-in reader", () => {
    msal.authed = true;
    renderGate();
    expect(screen.getByTestId("protected")).toBeTruthy();
    expect(screen.getByText("saved page content")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
