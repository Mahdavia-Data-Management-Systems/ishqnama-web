"use client";

import IconButton from "@/components/ui/icon-button";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import styles from "./ayah-block.module.css";

export type TranslationLang = "urdu" | "hindi" | "english";

interface AyahBlockProps {
  number: number;
  arabic: string;
  translations: Partial<Record<TranslationLang, string>>;
  activeLang: TranslationLang;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onShare?: () => void;
  fontScale?: number;
}

export default function AyahBlock({
  number,
  arabic,
  translations,
  activeLang,
  isBookmarked = false,
  onToggleBookmark,
  onShare,
  fontScale = 1,
}: AyahBlockProps) {
  const scale = (FONT_SIZE_STEPS[fontScale] ?? 100) / 100;
  const arabicSize = Math.max(1.625, 1.75 * scale);
  const translationSize = Math.max(1.1875, 1.5 * scale);
  const translation = translations[activeLang];

  const translationFontFamily =
    activeLang === "urdu"
      ? "var(--font-urdu)"
      : activeLang === "hindi"
        ? "var(--font-hindi)"
        : "var(--font-display)";

  const isRtl = activeLang === "urdu";

  return (
    <div className={styles.block}>
      <div className={styles.meta}>
        <span className={styles.number}>{number}</span>
        <div className={styles.actions}>
          <IconButton
            icon="share"
            label="Share verse"
            size="sm"
            onClick={onShare}
          />
          <IconButton
            icon={isBookmarked ? "bookmarkFilled" : "bookmark"}
            label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
            size="sm"
            filled={isBookmarked}
            onClick={onToggleBookmark}
          />
        </div>
      </div>

      <div
        className={styles.arabic}
        dir="rtl"
        lang="ar"
        style={{ fontSize: `${arabicSize}rem` }}
      >
        {arabic}
        <span className={styles.separator}> &#1757; </span>
      </div>

      <hr className="hairline-gold" />

      {translation && (
        <div
          className={styles.translation}
          dir={isRtl ? "rtl" : "ltr"}
          lang={activeLang === "urdu" ? "ur" : activeLang === "hindi" ? "hi" : "en"}
          style={{
            fontSize: `${translationSize}rem`,
            fontFamily: translationFontFamily,
            lineHeight: activeLang === "urdu" ? "var(--leading-urdu)" : undefined,
          }}
        >
          {translation}
        </div>
      )}
    </div>
  );
}
