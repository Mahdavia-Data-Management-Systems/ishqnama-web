import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ListsProvider, { useLists } from "@/context/lists-context";
import { appendListGroup, deleteFavorite, getFavorites, getMyLists, saveListFavorite } from "@/lib/lists-api";
import type { FavoriteDto, VerseListDto, VerseListSummaryDto } from "@/types/lists";

vi.mock("@azure/msal-react", () => ({ useIsAuthenticated: () => true }));
vi.mock("@/lib/lists-api", () => ({
  getMyLists: vi.fn(),
  getFavorites: vi.fn(),
  createList: vi.fn(),
  appendListGroup: vi.fn(),
  saveListFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
}));

const A: VerseListSummaryDto = {
  id: "aaaaaaaaaaaa",
  title: "A",
  description: null,
  ownerName: "Noor",
  status: "draft",
  groupCount: 0,
  updatedAt: "2026-01-01T00:00:00Z",
};
const B: VerseListSummaryDto = { ...A, id: "bbbbbbbbbbbb", title: "B" };
const FAV: FavoriteDto = { id: "fav_list_cccccccccccc", kind: "list", listId: "cccccccccccc", title: "C", createdAt: "" };

function wrapper({ children }: { children: ReactNode }) {
  return <ListsProvider>{children}</ListsProvider>;
}

describe("ListsProvider", () => {
  beforeEach(() => {
    vi.mocked(getMyLists).mockResolvedValue([A, B]);
    vi.mocked(getFavorites).mockResolvedValue([FAV]);
  });
  afterEach(cleanup);

  it("loads my lists and favourites", async () => {
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.myLists.map((l) => l.id)).toEqual([A.id, B.id]);
    expect(result.current.favoriteFor("cccccccccccc")).toEqual(FAV);
  });

  it("moves a list to the top of My collection when a group is added", async () => {
    const updated: VerseListDto = {
      ...B,
      isMine: true,
      groups: [{ id: "g001", chapter: 1, fromVerse: 1, toVerse: 7, caption: null }],
      createdAt: "",
      publishedAt: null,
    };
    vi.mocked(appendListGroup).mockResolvedValue(updated);
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(() => result.current.addGroup(B.id, { chapter: 1, fromVerse: 1, toVerse: 7, caption: null }));

    expect(result.current.myLists.map((l) => [l.id, l.groupCount])).toEqual([
      [B.id, 1],
      [A.id, 0],
    ]);
  });

  it("adds and removes favourites", async () => {
    const saved: FavoriteDto = { ...FAV, id: "fav_list_dddddddddddd", listId: "dddddddddddd" };
    vi.mocked(saveListFavorite).mockResolvedValue(saved);
    vi.mocked(deleteFavorite).mockResolvedValue(undefined);
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(() => result.current.addFavorite("dddddddddddd"));
    expect(result.current.favoriteFor("dddddddddddd")).toEqual(saved);

    act(() => result.current.removeFavorite(FAV.id));
    expect(result.current.favoriteFor("cccccccccccc")).toBeUndefined();
    expect(deleteFavorite).toHaveBeenCalledWith(FAV.id);
  });

  it("marks the lists failed when they cannot load", async () => {
    vi.mocked(getMyLists).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("failed"));
  });
});
