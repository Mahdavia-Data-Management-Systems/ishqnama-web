"use client";

import { useEffect, useRef, useState } from "react";
import { usePendingRequestCount } from "@/lib/pending-requests";
import styles from "./global-loading-indicator.module.css";

/**
 * Lights up the hairline between the app bar and the page while API requests
 * are in flight. Purely a viewport-edge cue: it is position: fixed, takes no
 * layout space and never announces itself, so the inline loaders on each page
 * remain the spoken/explanatory loading state.
 *
 * Timing rules, all aimed at never flickering:
 *  - nothing is painted unless requests have been pending for SHOW_DELAY_MS;
 *  - once shown it stays for at least MIN_VISIBLE_MS;
 *  - after the last request settles it lingers LINGER_MS before fading, which
 *    bridges the reader's chained calls (verse pages, then rukus);
 *  - a request that starts during the linger or the fade brings it straight
 *    back without a fresh delay.
 */

const SHOW_DELAY_MS = 10;
const MIN_VISIBLE_MS = 600;
const LINGER_MS = 150;
/** Matches --duration-normal; how long the opacity fade-out runs before the element is hidden. */
const FADE_MS = 200;

type Phase = "hidden" | "visible" | "fading";

export default function GlobalLoadingIndicator() {
  const pending = usePendingRequestCount() > 0;
  const [phase, setPhase] = useState<Phase>("hidden");
  const shownAtRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (pending) {
      if (phase === "hidden") {
        timer = setTimeout(() => {
          shownAtRef.current = Date.now();
          setPhase("visible");
        }, SHOW_DELAY_MS);
      } else if (phase === "fading") {
        setPhase("visible");
      }
    } else if (phase === "visible") {
      const elapsed = Date.now() - shownAtRef.current;
      timer = setTimeout(
        () => setPhase("fading"),
        Math.max(LINGER_MS, MIN_VISIBLE_MS - elapsed),
      );
    } else if (phase === "fading") {
      timer = setTimeout(() => setPhase("hidden"), FADE_MS);
    }

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [pending, phase]);

  return (
    <div className={styles.rail} data-state={phase} aria-hidden="true">
      <span className={styles.gleam} />
      <span className={styles.still} />
    </div>
  );
}
