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

  it("swallows the keystroke, opens the prompt and never searches", () => {
    renderPage();
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "n" } });
    expect(field.value).toBe("");
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
    expect(searchQuran).not.toHaveBeenCalled();
  });

  it("prompts again on every attempt after the sheet is dismissed", () => {
    renderPage();
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "n" } });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.change(field, { target: { value: "no" } });
    expect(field.value).toBe("");
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
    expect(searchQuran).not.toHaveBeenCalled();
  });

  it("reopens the prompt from the inline Sign in button", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
  });

  it("clears a typed query when the reader is signed out", () => {
    msal.authed = true;
    const view = renderPage();
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "noor" } });
    expect(field.value).toBe("noor");

    msal.authed = false;
    view.rerender(
      <SignInPromptProvider>
        <SearchPage />
      </SignInPromptProvider>,
    );
    expect(field.value).toBe("");
  });
});

describe("SearchPage for a signed-in reader", () => {
  beforeEach(() => {
    msal.authed = true;
    vi.mocked(searchQuran).mockReset().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  });
  afterEach(cleanup);

  it("lets the reader type without any prompt", () => {
    renderPage();
    const field = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "noor" } });
    expect(field.value).toBe("noor");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
