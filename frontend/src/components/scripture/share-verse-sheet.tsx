"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/ui/icon";
import RukuMark from "@/components/scripture/ruku-mark";
import { suras } from "@/data/suras";
import {
  buildShareText,
  buildShareUrl,
  chapterName,
  shareVerse,
  verseReference,
  type ShareOutcome,
  type ShareTarget,
} from "@/lib/share-verse";
import type { RukuDto } from "@/types/api";
import styles from "./share-verse-sheet.module.css";

type Place = ShareTarget["kind"];

const COPIED_CLOSE_DELAY_MS = 1600;

const WAITING_HINT = "Finding its place in the book";
const COPIED_HINT = "Copied. Paste it wherever you like.";
const FAILED_HINT = "Couldn't share from here. Try again.";

interface ShareVerseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: number;
  verse: number;
  /** The translation as shown in the reader; the Arabic is never shared. */
  translation: string | undefined;
  /** The verse's ruku, which gives its juz and its rank within that juz. Undefined while still loading. */
  ruku: RukuDto | undefined;
}

export default function ShareVerseSheet({
  isOpen,
  onClose,
  chapter,
  verse,
  translation,
  ruku,
}: ShareVerseSheetProps) {
  const headingId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Place | null>(null);
  const [outcome, setOutcome] = useState<{ place: Place; result: ShareOutcome } | null>(null);

  // Reset, lock scroll and move focus only when the sheet opens or closes.
  useEffect(() => {
    if (!isOpen) return;
    setBusy(null);
    setOutcome(null);
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Focus the dialog itself so keyboard users start inside it without a ring on the first option.
    sheetRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (outcome?.result !== "copied") return;
    const t = setTimeout(onClose, COPIED_CLOSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [outcome, onClose]);

  if (!isOpen) return null;

  const sura = suras.find((s) => s.number === chapter);
  const reference = verseReference(chapter, verse);
  const verseLabel = verse > 0 ? `verse ${verse}` : "opening";

  const targetFor = (place: Place): ShareTarget | null => {
    if (place === "chapter") return { kind: "chapter", chapter, verse };
    if (!ruku) return null;
    if (place === "juz") return { kind: "juz", juz: ruku.juzNumber, chapter, verse };
    return { kind: "ruku", juz: ruku.juzNumber, rankInJuz: ruku.rankInJuz, verse };
  };

  const handlePick = async (place: Place) => {
    const target = targetFor(place);
    if (!target || busy) return;
    setBusy(place);
    setOutcome(null);
    const url = buildShareUrl(window.location.origin, target);
    const text = buildShareText({ chapter, verse, translation });
    const result = await shareVerse({ title: reference, text, url });
    setBusy(null);
    if (result === "shared") {
      onClose();
      return;
    }
    if (result === "cancelled") return;
    setOutcome({ place, result });
  };

  const hintFor = (place: Place, ready: boolean, fallback: string) => {
    if (outcome?.place === place) {
      if (outcome.result === "copied") return COPIED_HINT;
      if (outcome.result === "failed") return FAILED_HINT;
    }
    return ready ? fallback : WAITING_HINT;
  };

  const options: { place: Place; title: string; hint: string; ready: boolean; mark: ReactNode }[] = [
    {
      place: "chapter",
      title: "From its chapter",
      ready: true,
      hint: hintFor("chapter", true, `${chapterName(chapter)}, ${verseLabel}`),
      mark: (
        <span className={styles.arabicMark} lang="ar" dir="rtl">
          {sura?.arabicName ?? chapter}
        </span>
      ),
    },
    {
      place: "juz",
      title: "From its juz",
      ready: ruku != null,
      hint: hintFor("juz", ruku != null, ruku ? `Juz ${ruku.juzNumber}, ${verseLabel}` : ""),
      mark: <span className={styles.folioMark}>{ruku?.juzNumber ?? "—"}</span>,
    },
    {
      place: "ruku",
      title: "From its ruku",
      ready: ruku != null,
      hint: hintFor("ruku", ruku != null, ruku ? `Ruku ${ruku.rankInJuz} of juz ${ruku.juzNumber}` : ""),
      mark: ruku ? (
        <span className={styles.rukuMark}>
          <RukuMark rukuId={ruku.rukuId} rankInJuz={ruku.rankInJuz} />
        </span>
      ) : (
        <span className={styles.arabicMark} lang="ar">ع</span>
      ),
    },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={sheetRef}
        tabIndex={-1}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id={headingId} className={styles.heading}>Share verse</h2>
            <p className={styles.reference}>{reference}</p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        <ul className={styles.list}>
          {options.map((o) => {
            const copied = outcome?.place === o.place && outcome.result === "copied";
            return (
              <li key={o.place}>
                <button
                  type="button"
                  className={`${styles.option} ${copied ? styles.optionDone : ""}`}
                  disabled={!o.ready || (busy != null && busy !== o.place)}
                  aria-busy={busy === o.place || undefined}
                  onClick={() => handlePick(o.place)}
                >
                  <span className={styles.mark} aria-hidden="true">{o.mark}</span>
                  <span className={styles.body}>
                    <span className={styles.title}>{o.title}</span>
                    <span className={styles.hint}>{o.hint}</span>
                  </span>
                  <span className={styles.trail} aria-hidden="true">
                    <Icon name={copied ? "check" : "chevronRight"} size={18} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
