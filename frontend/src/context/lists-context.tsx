"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import { onReady } from "@/lib/api-readiness";
import {
  appendListGroup,
  createList as apiCreateList,
  deleteFavorite,
  getFavorites,
  getMyLists,
  saveListFavorite,
} from "@/lib/lists-api";
import { trackEvent } from "@/lib/telemetry";
import type { FavoriteDto, VerseListDto, VerseListGroupDto, VerseListSummaryDto } from "@/types/lists";

/**
 * The signed-in reader's own lists (as summaries) and favourites, shared by the Saved page, the
 * list pages and "Add to list" in the reader. Loads like the bookmarks: no timeout on the GET
 * (a cold start resolves it by itself), and a failed GET refetches on the next ready transition.
 * Creating a list and adding a group wait for the server, with a long timeout.
 */

export type ListsStatus = "idle" | "loading" | "loaded" | "failed";

/** Long enough to outlive a ~50 s cold start. */
const WRITE_TIMEOUT_MS = 90_000;

interface ListsContextValue {
  myLists: VerseListSummaryDto[];
  favorites: FavoriteDto[];
  status: ListsStatus;
  refresh: () => void;
  createList: (title: string, description: string | null) => Promise<VerseListDto>;
  addGroup: (listId: string, group: Omit<VerseListGroupDto, "id">) => Promise<VerseListDto>;
  /** Keeps My collection in step after the editor saves a list. */
  noteListChanged: (list: VerseListDto) => void;
  noteListDeleted: (listId: string) => void;
  favoriteFor: (listId: string) => FavoriteDto | undefined;
  addFavorite: (listId: string) => Promise<void>;
  removeFavorite: (favoriteId: string) => void;
}

const ListsContext = createContext<ListsContextValue | null>(null);

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within a ListsProvider");
  return ctx;
}

export function summaryOf(list: VerseListDto): VerseListSummaryDto {
  return {
    id: list.id,
    title: list.title,
    description: list.description,
    ownerName: list.ownerName,
    status: list.status,
    groupCount: list.groups.length,
    updatedAt: list.updatedAt,
  };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function ListsProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const [myLists, setMyLists] = useState<VerseListSummaryDto[]>([]);
  const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
  const [status, setStatus] = useState<ListsStatus>("idle");

  const fetchAll = useCallback(
    (signal?: AbortSignal): Promise<boolean> => {
      if (!isAuthenticated) return Promise.resolve(false);
      setStatus("loading");
      return Promise.all([getMyLists(signal), getFavorites(signal)])
        .then(([lists, favs]) => {
          setMyLists(lists);
          setFavorites(favs);
          setStatus("loaded");
          return true;
        })
        .catch(() => {
          if (!signal?.aborted) setStatus("failed");
          return false;
        });
    },
    [isAuthenticated],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setMyLists([]);
      setFavorites([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    let unregister: (() => void) | null = null;
    let cancelled = false;

    const load = () => {
      void fetchAll(controller.signal).then((ok) => {
        if (cancelled || ok) return;
        unregister = onReady(() => {
          unregister = null;
          load();
        });
      });
    };
    load();

    return () => {
      cancelled = true;
      controller.abort();
      unregister?.();
    };
  }, [fetchAll, isAuthenticated]);

  const refresh = useCallback(() => {
    void fetchAll();
  }, [fetchAll]);

  const noteListChanged = useCallback((list: VerseListDto) => {
    const summary = summaryOf(list);
    setMyLists((prev) => [summary, ...prev.filter((l) => l.id !== list.id)]);
  }, []);

  const noteListDeleted = useCallback((listId: string) => {
    setMyLists((prev) => prev.filter((l) => l.id !== listId));
  }, []);

  const createList = useCallback(
    async (title: string, description: string | null) => {
      const created = await withTimeout((signal) => apiCreateList(title, description, signal));
      noteListChanged(created);
      trackEvent("list-created");
      return created;
    },
    [noteListChanged],
  );

  const addGroup = useCallback(
    async (listId: string, group: Omit<VerseListGroupDto, "id">) => {
      const updated = await withTimeout((signal) => appendListGroup(listId, group, signal));
      noteListChanged(updated);
      trackEvent("list-group-added", { resultCount: updated.groups.length });
      return updated;
    },
    [noteListChanged],
  );

  const favoriteFor = useCallback(
    (listId: string) => favorites.find((f) => f.kind === "list" && f.listId === listId),
    [favorites],
  );

  const addFavorite = useCallback(async (listId: string) => {
    const saved = await saveListFavorite(listId);
    setFavorites((prev) => [saved, ...prev.filter((f) => f.id !== saved.id)]);
    trackEvent("list-favorited");
  }, []);

  const removeFavorite = useCallback(
    (favoriteId: string) => {
      // Optimistic; a real failure reloads the favourites from the server
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
      deleteFavorite(favoriteId)
        .then(() => trackEvent("list-unfavorited"))
        .catch(() => {
          void fetchAll();
        });
    },
    [fetchAll],
  );

  const value = useMemo(
    () => ({
      myLists,
      favorites,
      status,
      refresh,
      createList,
      addGroup,
      noteListChanged,
      noteListDeleted,
      favoriteFor,
      addFavorite,
      removeFavorite,
    }),
    [myLists, favorites, status, refresh, createList, addGroup, noteListChanged, noteListDeleted, favoriteFor, addFavorite, removeFavorite],
  );

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}
