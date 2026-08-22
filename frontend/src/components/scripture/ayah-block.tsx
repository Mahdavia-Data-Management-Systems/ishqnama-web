"use client";

import IconButton from "@/components/ui/icon-button";
import styles from "./ayah-block.module.css";

export type TranslationLang = "urdu" | "hindi" | "english";

interface AyahBlockProps {
  number: number;
  arabic: string;
  translations: Partial<Record<TranslationLang, string>>;
  activeLang: TranslationLang;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  fontScale?: number;
}

export default function AyahBlock({
  number,
  arabic,
  translations,
  activeLang,
  isBookmarked = false,
  onToggleBookmark,
  fontScale = 0,
}: AyahBlockProps) {
  const arabicSize = 1.75 + fontScale * 0.125;
  const translationSize = 1.5 + fontScale * 0.125;
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
        <IconButton
          icon={isBookmarked ? "bookmarkFilled" : "bookmark"}
          label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
          size="sm"
          filled={isBookmarked}
          onClick={onToggleBookmark}
        />
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
          }}
        >
          {translation}
        </div>
      )}
    </div>
  );
}
