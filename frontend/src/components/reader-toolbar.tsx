"use client";

import Link from "next/link";
import { useSignInGate } from "@/context/sign-in-prompt-context";
import Icon from "@/components/ui/icon";
import SegmentedControl from "@/components/ui/segmented-control";
import { useReaderSettings } from "@/context/reader-settings-context";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import styles from "./reader-toolbar.module.css";

export type ReadingMode = "verse" | "continuous";
export type TranslationLang = "urdu" | "hindi" | "english";

interface ReaderToolbarProps {
  prev?: { href: string; name: string } | null;
  next?: { href: string; name: string } | null;
  /** The mode, language and settings controls belong to the Quran reader; the essay page leaves them out. */
  mode?: ReadingMode;
  onModeChange?: (mode: ReadingMode) => void;
  lang?: TranslationLang;
  onLangChange?: (lang: TranslationLang) => void;
  showSettings?: boolean;
  /** Right to left, as the essays read: next on the left, previous on the right. */
  rtl?: boolean;
  fontScale: number;
  onFontScaleChange: (scale: number) => void;
}

const modeOptions = [
  { label: "Verse by verse", value: "verse", icon: <Icon name="listBullet" size={14} />, ariaLabel: "Verse by verse" },
  { label: "Continuous", value: "continuous", icon: <Icon name="alignLeft" size={14} />, ariaLabel: "Continuous reading" },
];

const langOptions = [
  { label: "English", value: "english", shortLabel: "En", ariaLabel: "English" },
  { label: "हिन्दी", value: "hindi", shortLabel: "हि", ariaLabel: "हिन्दी" },
  { label: "اردو", value: "urdu", shortLabel: "ار", ariaLabel: "اردو" },
];

const FONT_MIN = 0;
const FONT_MAX = FONT_SIZE_STEPS.length - 1;

export default function ReaderToolbar({
  prev,
  next,
  mode,
  onModeChange,
  lang,
  onLangChange,
  showSettings = true,
  rtl = false,
  fontScale,
  onFontScaleChange,
}: ReaderToolbarProps) {
  const { openSettings } = useReaderSettings();
  const gateSettings = useSignInGate("settings");
  const pct = FONT_SIZE_STEPS[fontScale] ?? 100;

  const prevLink = prev && { ...prev, label: `Previous: ${prev.name}` };
  const nextLink = next && { ...next, label: `Next: ${next.name}` };
  const left = rtl ? nextLink : prevLink;
  const right = rtl ? prevLink : nextLink;

  return (
    <div className={`${styles.toolbar} ornament-paper-tint`}>
      <div className={styles.inner}>
        <div className={styles.navSide}>
          {left ? (
            <Link href={left.href} className={styles.navLink} aria-label={left.label}>
              <Icon name="chevronLeft" size={16} />
            </Link>
          ) : (
            <span className={styles.navPlaceholder} />
          )}
        </div>

        <div className={styles.controls}>
          {mode && onModeChange && (
            <SegmentedControl
              options={modeOptions}
              value={mode}
              onChange={(v) => onModeChange(v as ReadingMode)}
              size="sm"
            />
          )}
          {lang && onLangChange && (
            <SegmentedControl
              options={langOptions}
              value={lang}
              onChange={(v) => onLangChange(v as TranslationLang)}
              size="sm"
            />
          )}
          {/* Alone in the bar, it stays and keeps its label on the narrowest phones */}
          <div className={`${styles.fontStepper} ${mode || lang ? "" : styles.fontStepperAlone}`}>
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
          {/* Settings persist for signed-in readers; anonymous readers get the sign-in prompt. */}
          {showSettings && (
            <button onClick={() => gateSettings(() => openSettings("reader"))} className={styles.settingsBtn} aria-label="Settings">
              <Icon name="settings" size={18} />
            </button>
          )}
          {right ? (
            <Link href={right.href} className={styles.navLink} aria-label={right.label}>
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
