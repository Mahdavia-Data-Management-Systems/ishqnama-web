"use client";

import { useEffect, useState } from "react";
import { onReady } from "@/lib/api-readiness";
import { getChapterArabic } from "@/lib/lists-api";
import type { ArabicVerseDto } from "@/types/lists";

/**
 * Responses kept for the visit, keyed "chapter:from-to", so the same group's preview and its
 * Read more sheet share one request, and a list reopened in the same visit shows at once.
 * The browser also caches the response itself: the Quran text never changes.
 */
const cache = new Map<string, Promise<ArabicVerseDto[]>>();

function load(chapter: number, from: number, to: number): Promise<ArabicVerseDto[]> {
  const key = `${chapter}:${from}-${to}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = getChapterArabic(chapter, from, to);
    // A failed request must not stay cached, or a cold start would break the group for the visit
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

export interface ArabicVersesState {
  verses: ArabicVerseDto[] | null;
  failed: boolean;
}

/** The Arabic of verses `from` to `to` of `chapter`; retries on the next ready transition after a failure. */
export function useArabicVerses(chapter: number, from: number, to: number): ArabicVersesState {
  const [state, setState] = useState<ArabicVersesState>({ verses: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    let unregister: (() => void) | null = null;
    setState({ verses: null, failed: false });

    const run = () => {
      load(chapter, from, to).then(
        (verses) => {
          if (!cancelled) setState({ verses, failed: false });
        },
        () => {
          if (cancelled) return;
          setState({ verses: null, failed: true });
          unregister = onReady(() => {
            unregister = null;
            run();
          });
        },
      );
    };
    run();

    return () => {
      cancelled = true;
      unregister?.();
    };
  }, [chapter, from, to]);

  return state;
}

/** For tests. */
export function clearArabicVersesCache() {
  cache.clear();
}
