"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppBarBottom } from "@/lib/app-bar-offset";
import styles from "./essay-sticky-bar.module.css";

interface EssayStickyBarProps {
  className?: string;
  /** The essay's Urdu title, shown small in the middle of the row once the page title has scrolled under it. */
  title: string;
  /** The id of the page's own title, whose position decides when the small one shows. */
  titleId: string;
  /** The row's left and right ends. */
  start: ReactNode;
  end: ReactNode;
}

/**
 * A row pinned under the app bar while the essay scrolls. Its top follows the bar's real bottom
 * edge, since the bar scrolls away on long pages; the stylesheet's top is the fallback before
 * the first measurement.
 */
export default function EssayStickyBar({ className = "", title, titleId, start, end }: EssayStickyBarProps) {
  const barBottom = useAppBarBottom();
  const ref = useRef<HTMLDivElement>(null);
  const [titleShown, setTitleShown] = useState(false);

  // Show the small title once the page title's last line has gone under the bottom of this row.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const heading = document.getElementById(titleId);
      const row = ref.current;
      if (!heading || !row) return;
      setTitleShown(heading.getBoundingClientRect().bottom <= row.getBoundingClientRect().bottom);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [titleId]);

  return (
    <div ref={ref} className={className} style={{ top: barBottom !== null ? `${barBottom}px` : undefined }}>
      {start}
      {/* The page's <h1> already names the essay, so this copy is for the eye only */}
      <p
        className={`${styles.title} ${titleShown ? styles.shown : ""}`}
        lang="ur"
        dir="rtl"
        aria-hidden="true"
        data-shown={titleShown || undefined}
      >
        {title}
      </p>
      {end}
    </div>
  );
}
