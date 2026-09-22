import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "@/app/search/page";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";
import { searchQuran } from "@/lib/api";

const msal = vi.hoisted(() => ({ authed: false }));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: "none" }),
}));
vi.mock("@azure/msal-browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@azure/msal-browser")>()),
  InteractionStatus: { None: "none" },
}));
vi.mock("@/lib/api", () => ({ searchQuran: vi.fn() }));

function renderPage() {
  return render(
    <SignInPromptProvider>
      <SearchPage />
    </SignInPromptProvider>,
  );
}

describe("SearchPage for an anonymous reader", () => {
  beforeEach(() => {
    msal.authed = false;
    vi.mocked(searchQuran).mockReset();
  });
  afterEach(cleanup);

  it("keeps the heading and the field, with no prompt until the reader types", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(SIGN_IN_COPY.search.title)).toBeTruthy();
  });

  it("prompts once on the first keystroke and never searches", () => {
    renderPage();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "n" } });
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "noor" } });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(searchQuran).not.toHaveBeenCalled();
  });

  it("reopens the prompt from the inline Sign in button", () => {
    renderPage();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "n" } });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
  });
});
