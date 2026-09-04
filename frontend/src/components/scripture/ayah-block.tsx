"use client";

import { useRef, useState } from "react";
import IconButton from "@/components/ui/icon-button";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import type { DisplaySegment } from "@/hooks/use-chapter-verses";
import { localizeNumber } from "@/lib/translation-map";
import styles from "./ayah-block.module.css";

export type TranslationLang = "urdu" | "hindi" | "english";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={styles.searchHighlight}>{part}</mark>
    ) : (
      part
    ),
  );
}

function highlightHtml(html: string, query: string) {
  const escaped = escapeRegExp(query);
  const matchRegex = new RegExp(escaped, "gi");
  return html.replace(/(<[^>]*>)|([^<]+)/g, (segment, tag, text) => {
    if (tag) return tag;
    return text.replace(
      matchRegex,
      (m: string) => `<mark class="${styles.searchHighlight}">${m}</mark>`,
    );
  });
}

interface AyahBlockProps {
  chapterNumber: number;
  number: number;
  arabic: string;
  translations?: Partial<Record<TranslationLang, string>>;
  segments?: DisplaySegment[];
  showTafseer?: boolean;
  activeLang: TranslationLang;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onShare?: () => void;
  fontScale?: number;
  highlightQuery?: string;
}

export default function AyahBlock({
  chapterNumber,
  number,
  arabic,
  translations,
  segments,
  showTafseer = false,
  activeLang,
  isBookmarked = false,
  onToggleBookmark,
  onShare,
  fontScale = 1,
  highlightQuery,
}: AyahBlockProps) {
  const [highlightedSeg, setHighlightedSeg] = useState<number | null>(null);
  const explanationRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scale = (FONT_SIZE_STEPS[fontScale] ?? 100) / 100;
  const arabicSize = Math.max(1.625, 1.75 * scale);
  const translationSize = Math.max(1.1875, 1.5 * scale);
  const tafseerSize = Math.max(1, 1.125 * scale);

  // Derive translation text: prefer segments, fall back to static translations map
  const translation = segments
    ? segments.map((s) => s.text).filter(Boolean).join(" ")
    : translations?.[activeLang];

  const translationFontFamily =
    activeLang === "urdu"
      ? "var(--font-urdu)"
      : activeLang === "hindi"
        ? "var(--font-hindi)"
        : "var(--font-display)";

  const isRtl = activeLang === "urdu";
  const langCode = activeLang === "urdu" ? "ur" : activeLang === "hindi" ? "hi" : "en";

  const hasExplanations = showTafseer && segments?.some((s) => s.explanation);

  return (
    <div id={`verse-${chapterNumber}-${number}`} className={styles.block}>
      <div className={styles.meta}>
        <div className={styles.actions}>
          <IconButton
            icon="share"
            label="Share verse"
            size="sm"
            onClick={onShare}
          />
          <IconButton
            icon={isBookmarked ? "bookmarkFilled" : "bookmark"}
            label="Save to bookmark"
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
        <span className={styles.separator}>
          {chapterNumber === 1 && number === 6 ? "\u00A0" : <>{" "}&#1757;{" "}</>}
          <span className={styles.separatorNumber}>{localizeNumber(number, activeLang)}</span>
        </span>
      </div>

      <hr className="hairline-gold" />

      {translation && (
        <div
          className={styles.translation}
          dir={isRtl ? "rtl" : "ltr"}
          lang={langCode}
          style={{
            fontSize: `${translationSize}rem`,
            fontFamily: translationFontFamily,
            lineHeight: activeLang === "urdu" ? "var(--leading-urdu)" : undefined,
          }}
        >
          {showTafseer && segments
            ? segments.map((seg, i) =>
                seg.text ? (
                  <span
                    key={i}
                    className={`${styles.segSpan} ${highlightedSeg === i ? styles.segHighlight : ""}`}
                    onClick={() => {
                      const next = highlightedSeg === i ? null : i;
                      setHighlightedSeg(next);
                      if (next != null) {
                        explanationRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }
                    }}
                  >
                    {highlightQuery ? highlightText(seg.text, highlightQuery) : seg.text}
                    {seg.explanation && <sup className={styles.segRef}>{i + 1}</sup>}
                    {" "}
                  </span>
                ) : null,
              )
            : highlightQuery ? highlightText(String(translation), highlightQuery) : translation}
        </div>
      )}

      {hasExplanations && (
        <div
          className={styles.tafseerSection}
          dir={isRtl ? "rtl" : "ltr"}
          lang={langCode}
          style={{
            fontFamily: translationFontFamily,
            lineHeight: activeLang === "urdu" ? "var(--leading-urdu)" : undefined,
          }}
        >
          {segments!.map((seg, i) =>
            seg.explanation ? (
              <div
                key={i}
                ref={(el) => { explanationRefs.current[i] = el; }}
                className={`${styles.tafseer} ${isRtl ? styles.tafseerRtl : ""} ${highlightedSeg === i ? styles.segHighlight : ""}`}
                style={{ cursor: "pointer", fontSize: `${tafseerSize}rem` }}
                onClick={() => setHighlightedSeg(highlightedSeg === i ? null : i)}
              >
                <sup className={styles.segRef}>{i + 1}</sup>{" "}
                <span dangerouslySetInnerHTML={{ __html: highlightQuery ? highlightHtml(seg.explanation, highlightQuery) : seg.explanation }} />
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
