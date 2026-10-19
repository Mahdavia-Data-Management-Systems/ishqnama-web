"use client";

import { useEffect, useId, useRef } from "react";
import Icon from "@/components/ui/icon";
import { lockPageScroll } from "@/lib/page-scroll-lock";
import styles from "./reflection-description-dialog.module.css";

interface ReflectionDescriptionDialogProps {
  isOpen: boolean;
  /** The recording's caption, as the heading. */
  title: string;
  description: string;
  onClose: () => void;
}

/**
 * The whole of a recording's description, for a card that could only show its first lines. A
 * modal over the page: the page stops scrolling behind it, Escape or the backdrop closes it, and
 * focus starts on Close so a keyboard reader can leave at once. The opener returns focus to
 * itself when the dialog closes.
 */
export default function ReflectionDescriptionDialog({ isOpen, title, description, onClose }: ReflectionDescriptionDialogProps) {
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unlockScroll = lockPageScroll();
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id={headingId} className={styles.heading}>
            {title}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <p className={styles.body}>{description}</p>
      </div>
    </div>
  );
}
