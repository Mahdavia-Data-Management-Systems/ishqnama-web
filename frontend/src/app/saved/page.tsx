"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import SectionHeading from "@/components/navigation/section-heading";
import SegmentedControl from "@/components/ui/segmented-control";
import EmptyState from "@/components/empty-state";
import { getUserBookmarks, getUserFavorites, getUserHistory } from "@/lib/user-api";
import { suras } from "@/data/suras";
import type { UserBookmarkDto, UserFavoriteDto, UserHistoryDto } from "@/types/user";
import styles from "./page.module.css";

const tabOptions = [
  { label: "Bookmarks", value: "bookmarks" },
  { label: "Favourites", value: "favourites" },
  { label: "History", value: "history" },
];

function getSuraName(chapterNumber: number): string {
  return suras.find((s) => s.number === chapterNumber)?.name ?? `Sura ${chapterNumber}`;
}

export default function SavedPage() {
  const [tab, setTab] = useState("bookmarks");
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();

  const [bookmarks, setBookmarks] = useState<UserBookmarkDto[]>([]);
  const [favorites, setFavorites] = useState<UserFavoriteDto[]>([]);
  const [history, setHistory] = useState<UserHistoryDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    setLoading(true);

    const fetchData = async () => {
      try {
        if (tab === "bookmarks") {
          setBookmarks(await getUserBookmarks(controller.signal));
        } else if (tab === "favourites") {
          setFavorites(await getUserFavorites(controller.signal));
        } else {
          setHistory(await getUserHistory(controller.signal));
        }
      } catch {
        // Failed to load — keep existing state
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [isAuthenticated, tab]);

  const emptyConfig = {
    bookmarks: {
      icon: "bookmark",
      title: "No bookmarks yet",
      body: "Bookmark verses while reading to find them here.",
    },
    favourites: {
      icon: "heart",
      title: "No favourites yet",
      body: "Mark your favourite verses to build a personal collection.",
    },
    history: {
      icon: "clock",
      title: "No reading history",
      body: "Your recently read chapters will appear here.",
    },
  };

  const config = emptyConfig[tab as keyof typeof emptyConfig];

  const hasItems =
    (tab === "bookmarks" && bookmarks.length > 0) ||
    (tab === "favourites" && favorites.length > 0) ||
    (tab === "history" && history.length > 0);

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="Your library" title="Saved" />

        <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />

        <div className={styles.content}>
          {loading ? (
            <p className={styles.loadingText}>Loading...</p>
          ) : !hasItems ? (
            <EmptyState
              icon={config.icon}
              title={config.title}
              body={config.body}
              action={{ label: "Start reading", onClick: () => router.push("/quran/") }}
            />
          ) : tab === "bookmarks" ? (
            <ul className={styles.list}>
              {bookmarks.map((b) => (
                <li key={`${b.chapterNumber}:${b.verseNumber}`} className={styles.item}>
                  <button
                    className={styles.itemButton}
                    onClick={() => router.push(`/quran/${b.chapterNumber}/`)}
                  >
                    <span className={styles.itemTitle}>
                      {getSuraName(b.chapterNumber)} — Verse {b.verseNumber}
                    </span>
                    <span className={styles.itemMeta}>{b.chapterNumber}:{b.verseNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : tab === "favourites" ? (
            <ul className={styles.list}>
              {favorites.map((f) => (
                <li key={`${f.chapterNumber}:${f.verseNumber}`} className={styles.item}>
                  <button
                    className={styles.itemButton}
                    onClick={() => router.push(`/quran/${f.chapterNumber}/`)}
                  >
                    <span className={styles.itemTitle}>
                      {getSuraName(f.chapterNumber)} — Verse {f.verseNumber}
                    </span>
                    <span className={styles.itemMeta}>{f.chapterNumber}:{f.verseNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={styles.list}>
              {history.map((h, i) => (
                <li key={`${h.chapterNumber}-${h.timestamp}-${i}`} className={styles.item}>
                  <button
                    className={styles.itemButton}
                    onClick={() => router.push(`/quran/${h.chapterNumber}/`)}
                  >
                    <span className={styles.itemTitle}>{getSuraName(h.chapterNumber)}</span>
                    <span className={styles.itemMeta}>
                      {new Date(h.timestamp).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
