"use client";

import { useCallback, useEffect, useState } from "react";
import { getBibliography } from "@/lib/api";
import { onReady } from "@/lib/api-readiness";
import type { BibliographyBookDto } from "@/types/api";

/**
 * Kept for the visit, one per kind of reader: a signed-in reader's response carries the
 * citations, an anonymous one's only the books. The browser also caches each for 30 days.
 */
const cache = new Map<boolean, Promise<BibliographyBookDto[]>>();

function load(signedIn: boolean): Promise<BibliographyBookDto[]> {
  let pending = cache.get(signedIn);
  if (!pending) {
    pending = getBibliography();
    // A failed request must not stay cached, or a cold start would break the page for the visit
    pending.catch(() => cache.delete(signedIn));
    cache.set(signedIn, pending);
  }
  return pending;
}

export interface BibliographyState {
  books: BibliographyBookDto[] | null;
  failed: boolean;
  /** Tries again now; for a failure while the API was already ready, when onReady never fires. */
  retry: () => void;
}

/**
 * Every cited book. Pass `enabled` once sign-in has settled, so a returning reader's request
 * carries their token; it is fetched again when `signedIn` changes. Retries on the next ready
 * transition after a failure.
 */
export function useBibliography(enabled: boolean, signedIn: boolean): BibliographyState {
  const [state, setState] = useState<{ books: BibliographyBookDto[] | null; failed: boolean }>({
    books: null,
    failed: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let unregister: (() => void) | null = null;
    setState((prev) => (prev.failed ? { books: prev.books, failed: false } : prev));

    const run = () => {
      load(signedIn).then(
        (books) => {
          if (!cancelled) setState({ books, failed: false });
        },
        () => {
          if (cancelled) return;
          setState({ books: null, failed: true });
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
  }, [enabled, signedIn, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/** For tests. */
export function clearBibliographyCache() {
  cache.clear();
}
