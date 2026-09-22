"use client";

import { useEffect, useId, useRef } from "react";
import Icon from "@/components/ui/icon";
import Button from "@/components/ui/button";
import {
  NOT_NOW_LABEL,
  SIGN_IN_COPY,
  SIGN_IN_CREDIT,
  SIGN_IN_LABEL,
  type SignInFeature,
} from "@/config/sign-in-copy";
import styles from "./sign-in-prompt-sheet.module.css";

interface SignInPromptSheetProps {
  isOpen: boolean;
  /** Which feature the reader tried to use; picks the title and body. */
  feature: SignInFeature | null;
  onSignIn: () => void;
  onClose: () => void;
}

/**
 * The one sign-in prompt, rendered by SignInPromptProvider. Stateless: the provider decides
 * when it is open and for which feature. Same form as ShareVerseSheet: a bottom sheet on phones,
 * a centred card from 600 px up.
 */
export default function SignInPromptSheet({ isOpen, feature, onSignIn, onClose }: SignInPromptSheetProps) {
  const headingId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock scroll and move focus only when the sheet opens or closes.
  useEffect(() => {
    if (!isOpen || !feature) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Focus the dialog itself so keyboard users start inside it without a ring on the first button.
    sheetRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [isOpen, feature]);

  useEffect(() => {
    if (!isOpen || !feature) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, feature, onClose]);

  if (!isOpen || !feature) return null;

  const copy = SIGN_IN_COPY[feature];

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="sign-in-backdrop">
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
          <Icon name="close" size={18} />
        </button>

        <div className={styles.markCircle} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ishqnama.svg" alt="" width={32} height={27} className={styles.mark} />
        </div>

        <h2 id={headingId} className={styles.title}>
          {copy.title}
        </h2>
        <p className={styles.body}>{copy.body}</p>

        <div className={styles.actions}>
          <Button variant="primary" size="md" fullWidth onClick={onSignIn}>
            {SIGN_IN_LABEL}
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={onClose}>
            {NOT_NOW_LABEL}
          </Button>
        </div>

        <p className={styles.credit}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/mdms-mark.webp" alt="" width={18} height={18} className={styles.creditMark} aria-hidden="true" />
          <span>{SIGN_IN_CREDIT}</span>
        </p>
      </div>
    </div>
  );
}
