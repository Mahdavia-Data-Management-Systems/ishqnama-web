import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SavedPage from "@/app/saved/page";
import { useBookmarks } from "@/context/bookmarks-context";
import type { UserBookmarkDto } from "@/types/user";

vi.mock("@azure/msal-react", () => ({ useIsAuthenticated: () => true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/context/bookmarks-context", () => ({ useBookmarks: vi.fn() }));
vi.mock("@/components/lists/saved-lists-panel", () => ({ default: () => <p>lists panel</p> }));
vi.mock("@/lib/user-api", () => ({ getUserHistory: vi.fn() }));

const NAZRA: UserBookmarkDto = {
  slug: "nazra",
  title: "Nazra",
  icon: "book",
  chapterNumber: 1,
  verseNumber: 0,
  isDefault: true,
  createdAt: "",
  updatedAt: "",
};
const DAILY: UserBookmarkDto = { ...NAZRA, slug: "daily-1", title: "Daily", icon: "moon", isDefault: false };

function withBookmarks(bookmarks: UserBookmarkDto[], status: "loading" | "loaded") {
  vi.mocked(useBookmarks).mockReturnValue({
    bookmarks,
    status,
    removeBookmark: vi.fn(),
  } as unknown as ReturnType<typeof useBookmarks>);
}

describe("SavedPage", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("leaves the bookmarks section out when only the default bookmark exists", () => {
    withBookmarks([NAZRA], "loaded");
    render(<SavedPage />);
    expect(screen.queryByRole("tab", { name: "Bookmarks" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Lists" })).toBeTruthy();
  });

  it("shows the bookmarks section once the reader has their own bookmark", () => {
    withBookmarks([NAZRA, DAILY], "loaded");
    render(<SavedPage />);
    expect(screen.getByRole("tab", { name: "Bookmarks" })).toBeTruthy();
    expect(screen.getByText("Daily")).toBeTruthy();
  });

  it("holds the section's place while bookmarks load", () => {
    withBookmarks([], "loading");
    render(<SavedPage />);
    expect(screen.getByRole("tab", { name: "Bookmarks" })).toBeTruthy();
  });
});
