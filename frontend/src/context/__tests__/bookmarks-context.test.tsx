import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookmarksProvider, { useBookmarks } from "@/context/bookmarks-context";
import { markProbeSettled, resetApiReadiness } from "@/lib/api-readiness";
import { createBookmark, getUserBookmarks } from "@/lib/user-api";
import type { UserBookmarkDto } from "@/types/user";

vi.mock("@azure/msal-react", () => ({ useIsAuthenticated: () => true }));
vi.mock("@/lib/user-api", () => ({
  getUserBookmarks: vi.fn(),
  createBookmark: vi.fn(),
  updateBookmarkPosition: vi.fn(),
  deleteBookmark: vi.fn(),
}));

const mockedGet = vi.mocked(getUserBookmarks);
const mockedCreate = vi.mocked(createBookmark);

const NAZRA: UserBookmarkDto = {
  slug: "nazra",
  title: "Nazra",
  icon: "book",
  chapterNumber: 1,
  verseNumber: 0,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  return <BookmarksProvider>{children}</BookmarksProvider>;
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("BookmarksProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("reports loading, then loaded with the list", async () => {
    mockedGet.mockResolvedValueOnce([NAZRA]);
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    expect(result.current.status).toBe("loading");
    await flush();
    expect(result.current.status).toBe("loaded");
    expect(result.current.bookmarks).toEqual([NAZRA]);
  });

  it("reports failed after a failed load and refetches on ready", async () => {
    mockedGet.mockRejectedValueOnce(new Error("network"));
    mockedGet.mockResolvedValueOnce([NAZRA]);
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    await flush();
    expect(result.current.status).toBe("failed");
    expect(mockedGet).toHaveBeenCalledTimes(1);

    act(() => markProbeSettled(true));
    await flush();
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("loaded");
    expect(result.current.bookmarks).toEqual([NAZRA]);
  });

  it("passes an abort signal to createBookmark that fires after 90 seconds", async () => {
    mockedGet.mockResolvedValueOnce([]);
    mockedCreate.mockImplementationOnce(
      (_title, _icon, signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    await flush();

    let rejection: unknown = null;
    const pending = result.current.addBookmark("Daily", "sun").catch((e) => {
      rejection = e;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    await pending;
    expect((rejection as { name?: string } | null)?.name).toBe("AbortError");
  });

  it("appends a created bookmark even after the caller stopped waiting", async () => {
    mockedGet.mockResolvedValueOnce([]);
    const created: UserBookmarkDto = { ...NAZRA, slug: "daily", title: "Daily", isDefault: false };
    mockedCreate.mockResolvedValueOnce(created);
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    await flush();

    await act(async () => {
      await result.current.addBookmark("Daily", "sun");
    });
    expect(result.current.bookmarks).toEqual([created]);
  });
});
