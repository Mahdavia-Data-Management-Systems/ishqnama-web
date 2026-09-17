"use client";

import { useEffect } from "react";
import Icon from "@/components/ui/icon";
import SegmentedControl from "@/components/ui/segmented-control";
import Switch from "@/components/ui/switch";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import {
  SETTINGS_LOADING_MESSAGE,
  SETTINGS_UNREACHABLE_MESSAGE,
  SETTINGS_WARMING_MESSAGE,
} from "@/config/readiness-copy";
import type { ReadingMode, TranslationLang } from "./reader-toolbar";
import styles from "./settings-sheet.module.css";

/** Why a change may not be saved yet; null when nothing needs saying. */
export type SettingsSyncStatus = "warming" | "unreachable" | "loading" | null;

const SYNC_MESSAGES: Record<Exclude<SettingsSyncStatus, null>, string> = {
  warming: SETTINGS_WARMING_MESSAGE,
  unreachable: SETTINGS_UNREACHABLE_MESSAGE,
  loading: SETTINGS_LOADING_MESSAGE,
};

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ReadingMode;
  onModeChange: (mode: ReadingMode) => void;
  lang: TranslationLang;
  onLangChange: (lang: TranslationLang) => void;
  fontScale: number;
  onFontScaleChange: (scale: number) => void;
  showTafseer: boolean;
  onTafseerChange: (show: boolean) => void;
  syncStatus?: SettingsSyncStatus;
}

const modeOptions = [
  { label: "Verse by verse", value: "verse" },
  { label: "Continuous", value: "continuous" },
];

const langOptions = [
  { label: "English", value: "english" },
  { label: "हिन्दी", value: "hindi" },
  { label: "اردو", value: "urdu" },
];

export default function SettingsSheet({
  isOpen,
  onClose,
  mode,
  onModeChange,
  lang,
  onLangChange,
  fontScale,
  onFontScaleChange,
  showTafseer,
  onTafseerChange,
  syncStatus = null,
}: SettingsSheetProps) {
  const FONT_MIN = 0;
  const FONT_MAX = FONT_SIZE_STEPS.length - 1;
  const pct = FONT_SIZE_STEPS[fontScale] ?? 100;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headingGroup}>
            <h2 className={styles.title}>Reading settings</h2>
            {syncStatus && (
              <p className={styles.syncStatus} role="status">
                {SYNC_MESSAGES[syncStatus]}
              </p>
            )}
          </div>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.group}>
            <label className={styles.label}>Reading mode</label>
            <SegmentedControl
              options={modeOptions}
              value={mode}
              onChange={(v) => onModeChange(v as ReadingMode)}
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>Translation language</label>
            <SegmentedControl
              options={langOptions}
              value={lang}
              onChange={(v) => onLangChange(v as TranslationLang)}
            />
          </div>

          <div className={styles.group}>
            <label className={styles.label}>Text size</label>
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

          <div className={styles.group}>
            <Switch
              label="Show tafseer"
              checked={showTafseer}
              onChange={onTafseerChange}
            />
          </div>

          <p className={styles.hint}>
            Saved to your account when signed in.
          </p>
        </div>
      </div>
    </div>
  );
}
