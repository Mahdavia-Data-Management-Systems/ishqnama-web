import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReaderToolbar from "@/components/reader-toolbar";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";

const msal = vi.hoisted(() => ({ authed: false }));
const openSettings = vi.fn();

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: "none" }),
}));
vi.mock("@azure/msal-browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@azure/msal-browser")>()),
  InteractionStatus: { None: "none" },
}));
vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ openSettings }),
}));

function renderToolbar() {
  return render(
    <SignInPromptProvider>
      <ReaderToolbar
        prev={null}
        next={null}
        mode="verse"
        onModeChange={() => {}}
        lang="english"
        onLangChange={() => {}}
        fontScale={2}
        onFontScaleChange={() => {}}
      />
    </SignInPromptProvider>,
  );
}

describe("ReaderToolbar settings gear", () => {
  beforeEach(() => {
    msal.authed = false;
    openSettings.mockReset();
  });
  afterEach(cleanup);

  it("is shown to an anonymous reader and opens the sign-in prompt instead of settings", () => {
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(openSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.settings.title })).toBeTruthy();
  });

  it("opens the settings sheet for a signed-in reader", () => {
    msal.authed = true;
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(openSettings).toHaveBeenCalledWith("reader");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
