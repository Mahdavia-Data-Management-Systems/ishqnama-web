"use client";

import { useEffect } from "react";

/**
 * Keeps the verse being read on screen. When the ref changes it finds `#verse-<c>-<v>` on the
 * page and scrolls it to the centre, but only if it is outside the viewport: a reader who has
 * scrolled ahead is not pulled back every few seconds. Used by the Quran reader and the list
 * page; a page that lacks the verse simply does nothing.
 */
export function useFollowReading(current: { chapter: number; verse: number } | null | undefined): void {
  const chapter = current?.chapter;
  const verse = current?.verse;
  useEffect(() => {
    if (chapter == null || verse == null) return;
    const el = document.getElementById(`verse-${chapter}-${verse}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (inView) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }, [chapter, verse]);
}
