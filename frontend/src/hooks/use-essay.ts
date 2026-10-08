"use client";

import { useCallback, useEffect, useState } from "react";
import { onReady } from "@/lib/api-readiness";
import { getNoorEImaanEssay } from "@/lib/articles-api";
import type { EssayDto } from "@/types/articles";

/**
 * Essays kept for the visit, so going back to one shows it at once. The browser also keeps the
 * response (private, revalidated each visit with a 304 when unchanged).
 */
const cache = new Map<string, Promise<EssayDto>>();

function load(slug: string): Promise<EssayDto> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = getNoorEImaanEssay(slug);
    // A failed request must not stay cached, or a cold start would break the essay for the visit
    pending.catch(() => cache.delete(slug));
    cache.set(slug, pending);
  }
  return pending;
}

export interface EssayState {
  essay: EssayDto | null;
  failed: boolean;
  /** Tries again now; for a failure while the API was already ready, when onReady never fires. */
  retry: () => void;
}

/** The essay at `slug`; retries on the next ready transition after a failure. */
export function useEssay(slug: string): EssayState {
  const [state, setState] = useState<{ slug: string; essay: EssayDto | null; failed: boolean }>({
    slug,
    essay: null,
    failed: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unregister: (() => void) | null = null;
    setState({ slug, essay: null, failed: false });

    const run = () => {
      load(slug).then(
        (essay) => {
          if (!cancelled) setState({ slug, essay, failed: false });
        },
        () => {
          if (cancelled) return;
          setState({ slug, essay: null, failed: true });
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
  }, [slug, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Return essay and failed as null/false when slug has changed (render phase mismatch)
  const essay = state.slug === slug ? state.essay : null;
  const failed = state.slug === slug ? state.failed : false;
  return { essay, failed, retry };
}

/** For tests. */
export function clearEssayCache() {
  cache.clear();
}
