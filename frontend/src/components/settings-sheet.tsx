"use client";

import { useEffect } from "react";
import Icon from "@/components/ui/icon";
import SegmentedControl from "@/components/ui/segmented-control";
import FontSizeStepper from "@/components/ui/font-size-stepper";
import Switch from "@/components/ui/switch";
import type { ReadingMode, TranslationLang } from "./reader-toolbar";
import styles from "./settings-sheet.module.css";

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
}: SettingsSheetProps) {
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
          <h2 className={styles.title}>Reading settings</h2>
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
            <FontSizeStepper value={fontScale} onChange={onFontScaleChange} min={0} max={5} />
          </div>

          <div className={styles.group}>
            <Switch
              label="Show tafseer"
              checked={showTafseer}
              onChange={onTafseerChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
