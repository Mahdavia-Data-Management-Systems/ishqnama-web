"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/icon";
import { isReaderRoute } from "@/lib/reader-route";
import styles from "./back-to-top.module.css";

interface BackToTopProps {
  /** How far the page must scroll before the button shows, in viewport heights. */
  afterViewports?: number;
}

/**
 * A round button in the bottom left corner that scrolls the page back to the top, shown once the
 * reader has scrolled a screen down. Drop it into any page. It sits above whatever bar runs along
 * the bottom edge: the ReaderToolbar on reader routes, the bottom nav on phones elsewhere.
 */
export default function BackToTop({ afterViewports = 1 }: BackToTopProps) {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      setShown(window.scrollY > window.innerHeight * afterViewports);
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
  }, [afterViewports]);

  const scrollToTop = () => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${shown ? styles.shown : ""}`}
      data-clears={isReaderRoute(pathname) ? "toolbar" : "bottom-nav"}
      aria-label="Back to top"
      // Out of the tab order while hidden, so keyboard readers never land on an invisible button
      tabIndex={shown ? undefined : -1}
      aria-hidden={shown ? undefined : true}
      onClick={scrollToTop}
    >
      <Icon name="chevronUp" size={20} />
    </button>
  );
}
