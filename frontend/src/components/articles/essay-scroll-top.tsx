"use client";

import { useEffect } from "react";

/**
 * Puts an essay's page at its top when the essay is opened, so the head and the tabs under it are
 * in view. Next.js only scrolls on navigation when the new page's top is out of view, which leaves
 * a link from a scrolled list (Articles) opening the essay part-way down. Mounted by the essay
 * layout, so it runs once when an essay opens and not again when the reader moves between its
 * Article and Reflections tabs.
 */
export default function EssayScrollTop() {
  useEffect(() => {
    // Instant, not smooth: <html> is smooth by default and the reader should land already at the top.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return null;
}
