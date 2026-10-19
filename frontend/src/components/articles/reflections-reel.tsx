"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";
import { useWheelToHorizontal } from "@/lib/use-wheel-to-horizontal";
import { ReflectionPlayerProvider } from "./reflection-player-context";
import styles from "./reflections-reel.module.css";

/** Above this width the reel runs sideways; at it and below, the phone bottom nav is on screen and the reel runs down. */
const WIDE_QUERY = "(min-width: 641px)";

// Guarded for test environments without matchMedia: there the reel counts as wide.
function subscribeWide(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isWide(): boolean {
  return typeof window.matchMedia !== "function" || window.matchMedia(WIDE_QUERY).matches;
}

/**
 * The list of an essay's recordings. On a wide screen it is a horizontal rail like the Library's:
 * fixed-width cards running sideways, snapping to each, swiped by touch and dragged or wheeled by
 * a mouse (the wheel goes back to the page at either end, so the page never feels stuck). On a
 * phone the cards simply stack in the page's own scroll. Nothing scrolls inside a card. The two
 * mouse helpers are only attached while the rail runs sideways, since they read the pointer's x.
 */
export default function ReflectionsReel({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLOListElement | null>(null);
  const wide = useSyncExternalStore(subscribeWide, isWide, () => true);
  useDragToScroll(wide ? el : null);
  useWheelToHorizontal(wide ? el : null);

  return (
    /* A scroll container on a wide screen, so it is focusable there and the keyboard can page
       through it. The provider keeps one recording open across the cards. */
    <ReflectionPlayerProvider>
      <ol ref={setEl} className={styles.reel} tabIndex={wide ? 0 : undefined}>
        {children}
      </ol>
    </ReflectionPlayerProvider>
  );
}
