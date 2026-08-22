"use client";

import Link from "next/link";
import Icon from "@/components/ui/icon";
import SegmentedControl from "@/components/ui/segmented-control";
import styles from "./reader-toolbar.module.css";

export type ReadingMode = "verse" | "continuous";
export type TranslationLang = "urdu" | "hindi" | "english";

interface ReaderToolbarProps {
  prevSura?: { number: number; name: string } | null;
  nextSura?: { number: number; name: string } | null;
  mode: ReadingMode;
  onModeChange: (mode: ReadingMode) => void;
  lang: TranslationLang;
  onLangChange: (lang: TranslationLang) => void;
  onSettingsOpen: () => void;
}

const modeOptions = [
  { label: "Verse by verse", value: "verse" },
  { label: "Continuous", value: "continuous" },
];

const langOptions = [
  { label: "اردو", value: "urdu" },
  { label: "हिन्दी", value: "hindi" },
  { label: "English", value: "english" },
];

export default function ReaderToolbar({
  prevSura,
  nextSura,
  mode,
  onModeChange,
  lang,
  onLangChange,
  onSettingsOpen,
}: ReaderToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.inner}>
        <div className={styles.navSide}>
          {prevSura ? (
            <Link href={`/quran/${prevSura.number}/`} className={styles.navLink} aria-label={`Previous: ${prevSura.name}`}>
              <Icon name="chevronLeft" size={18} />
            </Link>
          ) : (
            <span className={styles.navPlaceholder} />
          )}
        </div>

        <div className={styles.controls}>
          <SegmentedControl
            options={modeOptions}
            value={mode}
            onChange={(v) => onModeChange(v as ReadingMode)}
            size="sm"
          />
          <SegmentedControl
            options={langOptions}
            value={lang}
            onChange={(v) => onLangChange(v as TranslationLang)}
            size="sm"
          />
        </div>

        <div className={styles.navSide}>
          <button onClick={onSettingsOpen} className={styles.navLink} aria-label="Settings">
            <Icon name="settings" size={18} />
          </button>
          {nextSura ? (
            <Link href={`/quran/${nextSura.number}/`} className={styles.navLink} aria-label={`Next: ${nextSura.name}`}>
              <Icon name="chevronRight" size={18} />
            </Link>
          ) : (
            <span className={styles.navPlaceholder} />
          )}
        </div>
      </div>
    </div>
  );
}
