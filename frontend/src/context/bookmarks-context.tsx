"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import { onReady } from "@/lib/api-readiness";
import {
  getUserBookmarks,
  createBookmark as apiCreateBookmark,
  updateBookmarkPosition,
  deleteBookmark as apiDeleteBookmark,
} from "@/lib/user-api";
import type { UserBookmarkDto } from "@/types/user";

/**
 * Bookmarks for the signed-in reader.
 *
 * The initial GET has no timeout: during an API cold start the ingress queues
 * it and it resolves by itself when the replica is up. Only a GET that fails
 * outright marks the list "failed" and registers a refetch for the next ready
 * transition (see lib/api-readiness.ts). Position saves and deletes are
 * optimistic; a hanging request lands when the API is up and a real failure
 * refetches the list. Creating a bookmark needs the server to mint the slug,
 * so it waits, with a long timeout so a hung request eventually reports back.
 */

export type BookmarksStatus = "idle" | "loading" | "loaded" | "failed";

/** Long enough to outlive a ~50 s cold start; the dialog shows a friendly message if it fires. */
const CREATE_TIMEOUT_MS = 90_000;

interface BookmarksContextValue {
  bookmarks: UserBookmarkDto[];
  status: BookmarksStatus;
  savePosition: (slug: string, chapterNumber: number, verseNumber: number) => void;
  addBookmark: (title: string, icon: string) => Promise<UserBookmarkDto>;
  removeBookmark: (slug: string) => void;
  refresh: () => void;
  hasCustomBookmarks: boolean;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) {
    throw new Error("useBookmarks must be used within a BookmarksProvider");
  }
  return ctx;
}

export default function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const [bookmarks, setBookmarks] = useState<UserBookmarkDto[]>([]);
  const [status, setStatus] = useState<BookmarksStatus>("idle");

  /** Resolves true on success, false on failure (including abort). */
  const fetchBookmarks = useCallback(
    (signal?: AbortSignal): Promise<boolean> => {
      if (!isAuthenticated) return Promise.resolve(false);
      setStatus("loading");
      return getUserBookmarks(signal)
        .then((list) => {
          setBookmarks(list);
          setStatus("loaded");
          return true;
        })
        .catch(() => {
          // An abort means we are unmounting or reloading; leave the status alone.
          if (!signal?.aborted) setStatus("failed");
          return false;
        });
    },
    [isAuthenticated],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setBookmarks([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    let unregister: (() => void) | null = null;
    let cancelled = false;

    const load = () => {
      void fetchBookmarks(controller.signal).then((ok) => {
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
  }, [fetchBookmarks, isAuthenticated]);

  const refresh = useCallback(() => {
    void fetchBookmarks();
  }, [fetchBookmarks]);

  const savePosition = useCallback(
    (slug: string, chapterNumber: number, verseNumber: number) => {
      // Optimistic update
      setBookmarks((prev) =>
        prev.map((b) =>
          b.slug === slug
            ? { ...b, chapterNumber, verseNumber, updatedAt: new Date().toISOString() }
            : b,
        ),
      );
      updateBookmarkPosition(slug, chapterNumber, verseNumber).catch(() => {
        // Revert on failure — refresh from server
        void fetchBookmarks();
      });
    },
    [fetchBookmarks],
  );

  const addBookmark = useCallback(
    async (title: string, icon: string): Promise<UserBookmarkDto> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS);
      try {
        const created = await apiCreateBookmark(title, icon, controller.signal);
        setBookmarks((prev) => [...prev, created]);
        return created;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [],
  );

  const removeBookmark = useCallback(
    (slug: string) => {
      // Optimistic remove
      setBookmarks((prev) => prev.filter((b) => b.slug !== slug));
      apiDeleteBookmark(slug).catch(() => {
        void fetchBookmarks();
      });
    },
    [fetchBookmarks],
  );

  const hasCustomBookmarks = bookmarks.some((b) => !b.isDefault);

  return (
    <BookmarksContext.Provider
      value={{ bookmarks, status, savePosition, addBookmark, removeBookmark, refresh, hasCustomBookmarks }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}
