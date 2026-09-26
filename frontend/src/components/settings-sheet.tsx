"use client";

import { useEffect, useId, useState } from "react";
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

/** A collapsible group of preferences in the sheet. */
export type SettingsSection = "general" | "reader";

const SYNC_MESSAGES: Record<Exclude<SettingsSyncStatus, null>, string> = {
  warming: SETTINGS_WARMING_MESSAGE,
  unreachable: SETTINGS_UNREACHABLE_MESSAGE,
  loading: SETTINGS_LOADING_MESSAGE,
};

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The section shown expanded when the sheet opens; the rest start collapsed. */
  expandedSection?: SettingsSection | null;
  showSuraRukuMarks: boolean;
  onSuraRukuMarksChange: (show: boolean) => void;
  showJuzRukuMarks: boolean;
  onJuzRukuMarksChange: (show: boolean) => void;
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
  expandedSection = null,
  showSuraRukuMarks,
  onSuraRukuMarksChange,
  showJuzRukuMarks,
  onJuzRukuMarksChange,
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

  // One section open at a time. Each open of the sheet starts from the requested section.
  const [openSection, setOpenSection] = useState<SettingsSection | null>(expandedSection);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setOpenSection(expandedSection);
  }
  const sectionProps = (section: SettingsSection) => ({
    expanded: openSection === section,
    onToggle: () => setOpenSection((current) => (current === section ? null : section)),
  });

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
            <h2 className={styles.title}>Settings</h2>
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
          <SettingsSectionPanel title="General settings" {...sectionProps("general")}>
            <SettingsGroup title="Show ruku marks in Quran index">
              <Switch
                label="For sura"
                checked={showSuraRukuMarks}
                onChange={onSuraRukuMarksChange}
                className={styles.switchRow}
              />
              <Switch
                label="For juz"
                checked={showJuzRukuMarks}
                onChange={onJuzRukuMarksChange}
                className={styles.switchRow}
              />
            </SettingsGroup>
          </SettingsSectionPanel>

          <SettingsSectionPanel title="Reader settings" {...sectionProps("reader")}>

            <div className={`${styles.group} ${styles.inlineGroup}`}>
              <label className={styles.label}>Reading mode</label>
              <SegmentedControl
                options={modeOptions}
                value={mode}
                onChange={(v) => onModeChange(v as ReadingMode)}
              />
            </div>

            <div className={`${styles.group} ${styles.inlineGroup}`}>
              <label className={styles.label}>Translation language</label>
              <SegmentedControl
                options={langOptions}
                value={lang}
                onChange={(v) => onLangChange(v as TranslationLang)}
              />
            </div>

            <div className={`${styles.group} ${styles.inlineGroup}`}>
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
                className={styles.switchRow}
              />
            </div>
          </SettingsSectionPanel>

          <p className={styles.hint}>
            Saved to your account when signed in.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * A collapsible section of the sheet ("General settings", "Reader settings"). The sheet owns
 * which one is expanded, so opening one collapses the others.
 */
function SettingsSectionPanel({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = useId();

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionHeading}>
        <button
          type="button"
          className={styles.sectionToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{title}</span>
          <span className={styles.sectionChevron} data-expanded={expanded}>
            <Icon name="chevronDown" size={18} />
          </span>
        </button>
      </h3>
      <div id={panelId} className={styles.sectionPanel} hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

/**
 * A titled group of related settings inside a section, such as "Show ruku marks in Quran
 * index" with its "For sura" and "For juz" switches. It is one row of the section, so the
 * hairline between rows separates it from its neighbours.
 */
function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const titleId = useId();

  return (
    <div role="group" aria-labelledby={titleId} className={`${styles.group} ${styles.titledGroup}`}>
      <span id={titleId} className={styles.groupTitle}>
        {title}
      </span>
      {children}
    </div>
  );
}
