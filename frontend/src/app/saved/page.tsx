"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import SectionHeading from "@/components/navigation/section-heading";
import SegmentedControl from "@/components/ui/segmented-control";
import EmptyState from "@/components/empty-state";
import BookmarkTile from "@/components/bookmark-tile";
import AddBookmarkTile from "@/components/add-bookmark-tile";
import CreateBookmarkDialog from "@/components/create-bookmark-dialog";
import BookmarkTileSkeleton from "@/components/bookmark-tile-skeleton";
import { BOOKMARKS_UNREACHABLE_MESSAGE, BOOKMARKS_WARMING_MESSAGE } from "@/config/readiness-copy";
import { useBookmarks } from "@/context/bookmarks-context";
import { useApiReadiness } from "@/lib/api-readiness";
import { getUserHistory } from "@/lib/user-api";
import type { UserHistoryDto } from "@/types/user";
import styles from "./page.module.css";

const tabOptions = [
  { label: "Bookmarks", value: "bookmarks" },
  { label: "History", value: "history" },
];

export default function SavedPage() {
  const [tab, setTab] = useState("bookmarks");
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const { bookmarks, status, addBookmark, removeBookmark } = useBookmarks();
  const readiness = useApiReadiness();
  const [dialogOpen, setDialogOpen] = useState(false);

  const showBookmarkSkeletons = bookmarks.length === 0 && (status === "loading" || status === "failed");
  const waitingCaption =
    readiness === "warming"
      ? BOOKMARKS_WARMING_MESSAGE
      : readiness === "unreachable"
        ? BOOKMARKS_UNREACHABLE_MESSAGE
        : null;

  const [history, setHistory] = useState<UserHistoryDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (tab !== "history") return;

    const controller = new AbortController();
    setLoading(true);

    const fetchData = async () => {
      try {
        setHistory(await getUserHistory(controller.signal));
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
    history: {
      icon: "clock",
      title: "No reading history",
      body: "Your recently read chapters will appear here.",
    },
  };

  const config = emptyConfig[tab as keyof typeof emptyConfig];

  const customBookmarks = bookmarks.filter((b) => !b.isDefault);

  const hasItems =
    (tab === "bookmarks" && bookmarks.length > 0) ||
    (tab === "history" && history.length > 0);

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="Your library" title="Saved" />

        <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />

        <div className={styles.content}>
          {tab === "bookmarks" ? (
            <>
              <div className={styles.bookmarkGrid}>
                {showBookmarkSkeletons && (
                  <>
                    <BookmarkTileSkeleton />
                    <BookmarkTileSkeleton />
                  </>
                )}
                {customBookmarks.map((b) => (
                  <BookmarkTile key={b.slug} bookmark={b} onDelete={removeBookmark} />
                ))}
                <AddBookmarkTile onClick={() => setDialogOpen(true)} />
              </div>
              {showBookmarkSkeletons && waitingCaption && (
                <p className={styles.waitingCaption}>{waitingCaption}</p>
              )}
              <CreateBookmarkDialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onCreate={(title, icon) => addBookmark(title, icon)}
              />
            </>
          ) : loading ? (
            <>
              <div className={styles.skeletonList}>
                <BookmarkTileSkeleton variant="row" />
                <BookmarkTileSkeleton variant="row" />
                <BookmarkTileSkeleton variant="row" />
              </div>
              {waitingCaption && <p className={styles.waitingCaption}>{waitingCaption}</p>}
            </>
          ) : !hasItems ? (
            <EmptyState
              icon={config.icon}
              title={config.title}
              body={config.body}
              action={{ label: "Start reading", onClick: () => router.push("/quran/") }}
            />
          ) : (
            <ul className={styles.list}>
              {history.map((h, i) => (
                <li key={`${h.url}-${h.timestamp}-${i}`} className={styles.item}>
                  <button
                    className={styles.itemButton}
                    onClick={() => router.push(h.url)}
                  >
                    <span className={styles.itemTitle}>{h.title}</span>
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
