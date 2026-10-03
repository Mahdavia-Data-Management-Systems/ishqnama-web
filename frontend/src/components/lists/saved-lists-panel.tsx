"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BookmarkTileSkeleton from "@/components/bookmark-tile-skeleton";
import CreateListDialog from "@/components/lists/create-list-dialog";
import ListRow, { UnavailableListRow } from "@/components/lists/list-row";
import Icon from "@/components/ui/icon";
import { FEATURED_LIST_IDS } from "@/config/featured-lists";
import { LISTS_COPY } from "@/config/lists-copy";
import { useLists } from "@/context/lists-context";
import { onReady, useApiReadiness } from "@/lib/api-readiness";
import { getPublishedSummaries } from "@/lib/lists-api";
import { arrangeSavedLists, idsToFetch, listEditPath } from "@/lib/verse-lists";
import type { VerseListSummaryDto } from "@/types/lists";
import styles from "./saved-lists-panel.module.css";

/** The API answers up to 50 ids per request. */
const BATCH = 50;

async function fetchSummaries(ids: string[], signal: AbortSignal): Promise<VerseListSummaryDto[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  const results = await Promise.all(batches.map((b) => getPublishedSummaries(b, signal)));
  return results.flat();
}

/**
 * The Lists tab of the Library page: My collection (my drafts and published lists, with New list
 * first), Featured (FEATURED_LIST_IDS) and Saved (lists I have favourited). Each list shows
 * in one section only; see arrangeSavedLists.
 */
export default function SavedListsPanel() {
  const router = useRouter();
  const { myLists, favorites, status, createList, removeFavorite } = useLists();
  const readiness = useApiReadiness();
  const [available, setAvailable] = useState<VerseListSummaryDto[] | null>(null);
  const [creating, setCreating] = useState(false);

  const wanted = useMemo(() => idsToFetch(FEATURED_LIST_IDS, favorites), [favorites]);
  const wantedKey = wanted.join(",");

  useEffect(() => {
    const ids = wantedKey ? wantedKey.split(",") : [];
    if (ids.length === 0) {
      setAvailable([]);
      return;
    }
    const controller = new AbortController();
    let unregister: (() => void) | null = null;
    const load = () => {
      fetchSummaries(ids, controller.signal).then(setAvailable, () => {
        if (controller.signal.aborted) return;
        unregister = onReady(() => {
          unregister = null;
          load();
        });
      });
    };
    load();
    return () => {
      controller.abort();
      unregister?.();
    };
  }, [wantedKey]);

  const sections = arrangeSavedLists({
    mine: myLists,
    featuredIds: FEATURED_LIST_IDS,
    favorites,
    available: available ?? [],
  });

  const loadingMine = myLists.length === 0 && (status === "loading" || status === "failed");
  const waitingCaption =
    readiness === "warming" ? LISTS_COPY.listsWarming : readiness === "unreachable" ? LISTS_COPY.listsUnreachable : null;
  const skeletons = (
    <>
      <BookmarkTileSkeleton variant="row" />
      <BookmarkTileSkeleton variant="row" />
    </>
  );

  return (
    <div className={styles.panel}>
      <section aria-labelledby="lists-mine">
        <div className={styles.headingRow}>
          <h3 id="lists-mine" className={styles.heading}>{LISTS_COPY.myCollection}</h3>
          <button type="button" className={styles.newList} onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} />
            {LISTS_COPY.newList}
          </button>
        </div>
        {loadingMine ? (
          <div className={styles.skeletons}>{skeletons}</div>
        ) : sections.mine.length === 0 ? (
          <p className={styles.empty}>{LISTS_COPY.emptyBody}</p>
        ) : (
          <ul className={styles.list}>
            {sections.mine.map((l) => (
              <li key={l.id}>
                <ListRow list={l} mine featured={FEATURED_LIST_IDS.includes(l.id)} />
              </li>
            ))}
          </ul>
        )}
        {loadingMine && waitingCaption && <p className={styles.waiting}>{waitingCaption}</p>}
      </section>

      {(sections.featured.length > 0 || (available == null && FEATURED_LIST_IDS.length > 0)) && (
        <section aria-labelledby="lists-featured">
          <h3 id="lists-featured" className={styles.heading}>{LISTS_COPY.featured}</h3>
          {available == null ? (
            <div className={styles.skeletons}>{skeletons}</div>
          ) : (
            <ul className={styles.list}>
              {sections.featured.map((l) => (
                <li key={l.id}>
                  <ListRow list={l} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {sections.saved.length > 0 && (
        <section aria-labelledby="lists-saved">
          <h3 id="lists-saved" className={styles.heading}>{LISTS_COPY.savedLists}</h3>
          {available == null ? (
            <div className={styles.skeletons}>{skeletons}</div>
          ) : (
            <ul className={styles.list}>
              {sections.saved.map(({ favorite, summary }) => (
                <li key={favorite.id}>
                  {summary ? (
                    <ListRow list={summary} />
                  ) : (
                    <UnavailableListRow title={favorite.title} onRemove={() => removeFavorite(favorite.id)} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <CreateListDialog
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreate={createList}
        onCreated={(list) => router.push(listEditPath(list.id))}
      />
    </div>
  );
}
