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
  fontScale: number;
  onFontScaleChange: (scale: number) => void;
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

const FONT_MIN = -3;
const FONT_MAX = 3;

export default function ReaderToolbar({
  prevSura,
  nextSura,
  mode,
  onModeChange,
  lang,
  onLangChange,
  fontScale,
  onFontScaleChange,
  onSettingsOpen,
}: ReaderToolbarProps) {
  const pct = 100 + fontScale * 10;

  return (
    <div className={styles.toolbar}>
      <div className={styles.inner}>
        <div className={styles.navSide}>
          {prevSura ? (
            <Link href={`/quran/${prevSura.number}/`} className={styles.navLink} aria-label={`Previous: ${prevSura.name}`}>
              <Icon name="chevronLeft" size={16} />
              <span className={styles.navLabel}>Sura</span>
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
          <div className={styles.fontStepper}>
            <button
              onClick={() => onFontScaleChange(Math.max(FONT_MIN, fontScale - 1))}
              disabled={fontScale <= FONT_MIN}
              className={styles.fontBtn}
              aria-label="Decrease font size"
            >
              <Icon name="minus" size={14} />
            </button>
            <span className={styles.fontLabel}>T {pct}%</span>
            <button
              onClick={() => onFontScaleChange(Math.min(FONT_MAX, fontScale + 1))}
              disabled={fontScale >= FONT_MAX}
              className={styles.fontBtn}
              aria-label="Increase font size"
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>

        <div className={styles.navSide}>
          <button onClick={onSettingsOpen} className={styles.settingsBtn} aria-label="Settings">
            <Icon name="settings" size={18} />
          </button>
          {nextSura ? (
            <Link href={`/quran/${nextSura.number}/`} className={styles.navLink} aria-label={`Next: ${nextSura.name}`}>
              <span className={styles.navLabel}>Sura</span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : (
            <span className={styles.navPlaceholder} />
          )}
        </div>
      </div>
    </div>
  );
}
