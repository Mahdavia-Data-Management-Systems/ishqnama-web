import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppBar from "@/components/navigation/app-bar";
import BottomNav from "@/components/navigation/bottom-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => false,
  useMsal: () => ({ instance: { loginRedirect: vi.fn() }, accounts: [], inProgress: "none" }),
}));
vi.mock("@/context/reader-settings-context", () => ({ useReaderSettings: () => ({ openSettings: vi.fn() }) }));

describe("Saved navigation for an anonymous reader", () => {
  afterEach(cleanup);

  it("is listed in the app bar", () => {
    render(<AppBar />);
    expect(screen.getByRole("link", { name: "Saved" })).toBeTruthy();
  });

  it("is listed in the bottom navigation", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /Saved/ })).toBeTruthy();
  });
});
