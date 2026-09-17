"use client";

import { useEffect, useRef, useState } from "react";
import {
  TRY_AGAIN_LABEL,
  UNREACHABLE_MESSAGE,
  WARMING_MESSAGE,
} from "@/config/readiness-copy";
import { requestProbe, useApiReadiness } from "@/lib/api-readiness";
import styles from "./api-warmup-notice.module.css";

/**
 * A bookmark ribbon hanging from the app bar that explains a long wait for
 * the API. Gold-wash paper with a swallowtail bottom edge, set in the display
 * face, so it reads as part of the printed volume rather than a toast.
 *
 * Shown only while the readiness store says "warming" or "unreachable", which
 * the store itself delays by a 3 s grace period, so a warm API never shows it.
 * Mounted outside AuthProvider so it works before MSAL initialises and for
 * anonymous readers. Fixed position: it never pushes content. It is not
 * dismissible because it disappears by itself when the API answers. The only
 * motion is a single unfurl from under the bar; the breathing loading rail
 * directly above it carries the "still working" rhythm.
 *
 * The app bar is sticky only within the body box, so on a long page it
 * scrolls away after the first viewport height. While the ribbon is shown it
 * tracks the bar's real bottom edge and clamps at the viewport top, so it
 * hangs from the top edge of the screen once the bar has gone.
 *
 * The wrapper is always rendered as a polite live region so a screen reader
 * announces each message once when it appears.
 */

/** Matches --duration-normal; how long the fade-out runs before the text is removed. */
const FADE_MS = 200;

type Shown = "warming" | "unreachable";

export default function ApiWarmupNotice() {
  const readiness = useApiReadiness();
  const target: Shown | null =
    readiness === "warming" || readiness === "unreachable" ? readiness : null;

  const [shown, setShown] = useState<Shown | null>(null);
  const [leaving, setLeaving] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  // Follow the app bar's bottom edge while shown; clamp at the viewport top.
  useEffect(() => {
    if (!shown) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const layer = layerRef.current;
      if (!layer) return;
      const bar = document.querySelector<HTMLElement>("[data-app-bar]");
      const bottom = bar ? bar.getBoundingClientRect().bottom : 0;
      layer.style.top = `${Math.max(0, Math.round(bottom))}px`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      if (layerRef.current) layerRef.current.style.top = "";
    };
  }, [shown]);

  useEffect(() => {
    if (target) {
      setShown(target);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const timer = setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [target, shown]);

  const state = !shown ? "hidden" : leaving ? "leaving" : "entered";

  return (
    <div ref={layerRef} className={styles.layer} role="status" aria-live="polite">
      {shown && (
        <div className={styles.shadow} data-state={state}>
          <div className={styles.ribbon} data-variant={shown}>
            <span className={styles.text}>
              {shown === "unreachable" ? UNREACHABLE_MESSAGE : WARMING_MESSAGE}
            </span>
            {shown === "unreachable" && (
              <button type="button" className={styles.retry} onClick={requestProbe}>
                {TRY_AGAIN_LABEL}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
