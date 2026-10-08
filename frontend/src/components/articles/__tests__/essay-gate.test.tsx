import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EssayGate from "@/components/articles/essay-gate";
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
vi.mock("@/components/protected-route", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected">{children}</div>,
}));
vi.mock("@/components/articles/essay-content", () => ({
  default: ({ slug }: { slug: string }) => <p>essay {slug}</p>,
}));

function renderGate() {
  return render(
    <SignInPromptProvider>
      <EssayGate slug="naskh" />
    </SignInPromptProvider>,
  );
}

describe("EssayGate", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
  });
  afterEach(cleanup);

  it("waits for sign-in to settle before deciding", () => {
    msal.inProgress = "startup";
    renderGate();
    expect(screen.getByText("One moment")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("essay naskh")).toBeNull();
  });

  it("prompts an anonymous reader once and never fetches the essay", () => {
    renderGate();
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.articles.title })).toBeTruthy();
    expect(screen.queryByTestId("protected")).toBeNull();
    expect(screen.queryByText("essay naskh")).toBeNull();
  });

  it("lets the inline message reopen the prompt", () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.articles.title })).toBeTruthy();
  });

  it("shows a signed-in reader the essay inside ProtectedRoute", () => {
    msal.authed = true;
    renderGate();
    expect(screen.getByTestId("protected").textContent).toBe("essay naskh");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
