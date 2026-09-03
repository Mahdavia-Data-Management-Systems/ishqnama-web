"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import {
  getUserBookmarks,
  createBookmark as apiCreateBookmark,
  updateBookmarkPosition,
  deleteBookmark as apiDeleteBookmark,
} from "@/lib/user-api";
import type { UserBookmarkDto } from "@/types/user";

interface BookmarksContextValue {
  bookmarks: UserBookmarkDto[];
  loading: boolean;
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
  const [loading, setLoading] = useState(false);

  const fetchBookmarks = useCallback((signal?: AbortSignal) => {
    if (!isAuthenticated) return;
    setLoading(true);
    getUserBookmarks(signal)
      .then(setBookmarks)
      .catch(() => { /* keep existing */ })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBookmarks(controller.signal);
    return () => controller.abort();
  }, [fetchBookmarks]);

  const refresh = useCallback(() => {
    fetchBookmarks();
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
        fetchBookmarks();
      });
    },
    [fetchBookmarks],
  );

  const addBookmark = useCallback(
    async (title: string, icon: string): Promise<UserBookmarkDto> => {
      const created = await apiCreateBookmark(title, icon);
      setBookmarks((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const removeBookmark = useCallback(
    (slug: string) => {
      // Optimistic remove
      setBookmarks((prev) => prev.filter((b) => b.slug !== slug));
      apiDeleteBookmark(slug).catch(() => {
        fetchBookmarks();
      });
    },
    [fetchBookmarks],
  );

  const hasCustomBookmarks = bookmarks.some((b) => !b.isDefault);

  return (
    <BookmarksContext.Provider
      value={{ bookmarks, loading, savePosition, addBookmark, removeBookmark, refresh, hasCustomBookmarks }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}
