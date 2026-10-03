"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import EmptyState from "@/components/empty-state";
import ListGroupCard from "@/components/lists/list-group-card";
import OwnerAvatar from "@/components/lists/owner-avatar";
import IconButton from "@/components/ui/icon-button";
import { FEATURED_LIST_IDS } from "@/config/featured-lists";
import { LISTS_COPY } from "@/config/lists-copy";
import { UNREACHABLE_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";
import { useLists } from "@/context/lists-context";
import { useSignInGate, useSignInPrompt } from "@/context/sign-in-prompt-context";
import { ApiError } from "@/lib/api-client";
import { onReady, useApiReadiness } from "@/lib/api-readiness";
import { getPublishedList } from "@/lib/lists-api";
import { shareList } from "@/lib/share-list";
import { trackEvent } from "@/lib/telemetry";
import { listEditPath, listOwnerName } from "@/lib/verse-lists";
import type { VerseListDto } from "@/types/lists";
import styles from "./list-view.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; list: VerseListDto }
  | { kind: "missing" }
  | { kind: "failed" };

/**
 * A published list, open to everyone: anonymous readers see it like the rest of the reader and
 * get the sign-in prompt when they favourite it. The owner sees Edit instead of Favourite.
 * Drafts and unknown ids come back as 404 and show "This list isn't available".
 */
export default function ListView() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const { authSettled } = useSignInPrompt();
  const readiness = useApiReadiness();
  const { favoriteFor, addFavorite, removeFavorite } = useLists();
  const gateFavorite = useSignInGate("favorites");
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [favBusy, setFavBusy] = useState(false);

  // Wait for MSAL to settle so a signed-in owner's request carries their token (for isMine)
  useEffect(() => {
    if (!authSettled) return;
    if (!/^[A-Za-z0-9]{12}$/.test(id)) {
      setState({ kind: "missing" });
      return;
    }
    const controller = new AbortController();
    let unregister: (() => void) | null = null;

    const load = () => {
      getPublishedList(id, controller.signal).then(
        (list) => setState({ kind: "loaded", list }),
        (err) => {
          if (controller.signal.aborted) return;
          if (err instanceof ApiError && err.status === 404) {
            setState({ kind: "missing" });
            return;
          }
          setState({ kind: "failed" });
          unregister = onReady(() => {
            unregister = null;
            load();
          });
        },
      );
    };
    load();

    return () => {
      controller.abort();
      unregister?.();
    };
  }, [id, authSettled, isAuthenticated]);

  const list = state.kind === "loaded" ? state.list : null;
  const favorite = list ? favoriteFor(list.id) : undefined;
  const featured = list ? FEATURED_LIST_IDS.includes(list.id) : false;

  const handleShare = useCallback(async () => {
    if (!list) return;
    setShareNote(null);
    const result = await shareList(window.location.origin, list);
    if (result === "shared" || result === "copied") {
      trackEvent("list-shared", { method: result === "shared" ? "native" : "clipboard" });
    }
    if (result === "copied") setShareNote(LISTS_COPY.copiedLink);
    if (result === "failed") setShareNote(LISTS_COPY.shareFailed);
  }, [list]);

  const handleFavorite = () => {
    if (!list || favBusy) return;
    gateFavorite(() => {
      if (favorite) {
        removeFavorite(favorite.id);
        return;
      }
      setFavBusy(true);
      addFavorite(list.id)
        .catch(() => setShareNote(LISTS_COPY.favouriteFailed))
        .finally(() => setFavBusy(false));
    });
  };

  if (state.kind === "missing") {
    return (
      <main className={styles.main}>
        <div className="page-container">
          <EmptyState
            icon="listPlus"
            title={LISTS_COPY.notAvailableTitle}
            body={LISTS_COPY.notAvailableBody}
          />
        </div>
      </main>
    );
  }

  if (!list) {
    const waiting =
      state.kind === "failed" || readiness === "unreachable"
        ? UNREACHABLE_MESSAGE
        : readiness === "warming"
          ? WARMING_MESSAGE
          : LISTS_COPY.loading;
    return (
      <main className={styles.main}>
        <div className={`page-container ${styles.placeholder}`}>
          <div className={styles.spinner} />
          <p className={styles.placeholderText}>{waiting}</p>
        </div>
      </main>
    );
  }

  const owner = listOwnerName(list);

  return (
    <main className={styles.main}>
      <div className="page-container">
        <header className={styles.header}>
          <div className={styles.toolbar}>
            {/* Shown to everyone: the owner learns every reader sees it, others why it has no Favourite */}
            {featured && list.status === "published" && <p className={styles.featuredBadge}>{LISTS_COPY.featured}</p>}
            <IconButton icon="share" label={LISTS_COPY.share} size="sm" onClick={() => void handleShare()} />
            {list.isMine ? (
              <IconButton
                icon="pencil"
                label={LISTS_COPY.edit}
                size="sm"
                onClick={() => router.push(listEditPath(list.id))}
              />
            ) : (
              !featured && (
                <IconButton
                  icon="heart"
                  label={favorite ? LISTS_COPY.favourited : LISTS_COPY.favourite}
                  size="sm"
                  filled={favorite != null}
                  className={favorite ? styles.favourited : undefined}
                  onClick={handleFavorite}
                />
              )
            )}
          </div>
          <div className={styles.intro}>
            <div className={styles.titles}>
              <h1 className={styles.title}>{list.title}</h1>
              {list.description && <p className={styles.description}>{list.description}</p>}
            </div>
            <p className={styles.owner}>
              <OwnerAvatar name={owner} size="md" />
              <span className={styles.ownerText}>
                <span>{LISTS_COPY.compiledBy}</span>
                <strong>{owner}</strong>
              </span>
            </p>
          </div>

          {shareNote && <p className={styles.note} role="status">{shareNote}</p>}
        </header>

        <hr className="hairline-gold" />

        <div className={styles.groups}>
          {list.groups.map((g) => (
            <ListGroupCard key={g.id ?? `${g.chapter}-${g.fromVerse}`} group={g} />
          ))}
        </div>
      </div>
    </main>
  );
}
