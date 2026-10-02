"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import SectionHeading from "@/components/navigation/section-heading";
import Tabs from "@/components/ui/tabs";
import EmptyState from "@/components/empty-state";
import BookmarkTile from "@/components/bookmark-tile";
import BookmarkTileSkeleton from "@/components/bookmark-tile-skeleton";
import SavedListsPanel from "@/components/lists/saved-lists-panel";
import { BOOKMARKS_UNREACHABLE_MESSAGE, BOOKMARKS_WARMING_MESSAGE } from "@/config/readiness-copy";
import { useBookmarks } from "@/context/bookmarks-context";
import { useApiReadiness } from "@/lib/api-readiness";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";
import { getUserHistory } from "@/lib/user-api";
import type { UserHistoryDto } from "@/types/user";
import styles from "./page.module.css";

/**
 * Two sections, each with its own tabs: bookmarks first (a rail; room for more tabs later), then
 * the reader's lists and reading history below it. The bookmarks section is left out entirely
 * until the reader has saved a bookmark of their own.
 */
const placeTabs = [{ label: "Bookmarks", value: "bookmarks" }];

const libraryTabs = [
  { label: "Lists", value: "lists" },
  { label: "History", value: "history" },
];

export default function LibraryPage() {
  const [placeTab, setPlaceTab] = useState("bookmarks");
  const [tab, setTab] = useState("lists");
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const { bookmarks, status, removeBookmark } = useBookmarks();
  const readiness = useApiReadiness();
  const [bookmarkRail, setBookmarkRail] = useState<HTMLUListElement | null>(null);
  useDragToScroll(bookmarkRail);

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
    history: {
      icon: "clock",
      title: "No reading history",
      body: "Your recently read chapters will appear here.",
    },
  };

  const customBookmarks = bookmarks.filter((b) => !b.isDefault);
  // While they load, the skeletons hold the section's place; once loaded, none means no section
  const showBookmarks = showBookmarkSkeletons || customBookmarks.length > 0;

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="Your collection" title="Library" />

        {showBookmarks && (
          <section className={styles.section}>
            <Tabs
              options={placeTabs}
              value={placeTab}
              onChange={setPlaceTab}
              label="Bookmarks"
              panelClassName={styles.content}
            >
              <ul ref={setBookmarkRail} className={styles.rail}>
                {showBookmarkSkeletons && (
                  <>
                    <li className={styles.railItem}><BookmarkTileSkeleton /></li>
                    <li className={styles.railItem}><BookmarkTileSkeleton /></li>
                  </>
                )}
                {customBookmarks.map((b) => (
                  <li key={b.slug} className={styles.railItem}>
                    <BookmarkTile bookmark={b} onDelete={removeBookmark} />
                  </li>
                ))}
              </ul>
              {showBookmarkSkeletons && waitingCaption && (
                <p className={styles.waitingCaption}>{waitingCaption}</p>
              )}
            </Tabs>
          </section>
        )}

        <section className={styles.section}>
          <Tabs
            options={libraryTabs}
            value={tab}
            onChange={setTab}
            label="Lists and history"
            panelClassName={styles.content}
          >
            {tab === "lists" ? (
              <SavedListsPanel />
            ) : loading ? (
              <>
                <div className={styles.skeletonList}>
                  <BookmarkTileSkeleton variant="row" />
                  <BookmarkTileSkeleton variant="row" />
                  <BookmarkTileSkeleton variant="row" />
                </div>
                {waitingCaption && <p className={styles.waitingCaption}>{waitingCaption}</p>}
              </>
            ) : history.length === 0 ? (
              <EmptyState
                icon={emptyConfig.history.icon}
                title={emptyConfig.history.title}
                body={emptyConfig.history.body}
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
          </Tabs>
        </section>
      </div>
    </main>
  );
}
