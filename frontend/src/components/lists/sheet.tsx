"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Icon from "@/components/ui/icon";
import styles from "./sheet.module.css";

interface SheetProps {
  onClose: () => void;
  title: string;
  /** A line under the heading, e.g. the verse reference. */
  subtitle?: string;
  /** "tall" fills most of the screen and scrolls its body, for a whole group of verses. */
  size?: "compact" | "tall";
  children: ReactNode;
}

/**
 * The bottom sheet used by the list pages (a centred dialog from 600 px up), like the reader's
 * share sheet: locks page scroll while open, closes on Escape or a tap outside, and moves focus
 * into itself, returning it on close. Render it only while open.
 */
export default function Sheet({ onClose, title, subtitle, size = "compact", children }: SheetProps) {
  const headingId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={sheetRef}
        tabIndex={-1}
        className={`${styles.sheet} ${size === "tall" ? styles.tall : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headings}>
            <h2 id={headingId} className={styles.heading}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
