"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import BismillahBlock from "@/components/scripture/bismillah-block";
import AyahBlock from "@/components/scripture/ayah-block";
import PrevNextNav from "@/components/scripture/prev-next-nav";
import ReaderToolbar, { type ReadingMode, type TranslationLang } from "@/components/reader-toolbar";
import IconButton from "@/components/ui/icon-button";
import BookmarkPicker from "@/components/bookmark-picker";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useBookmarks } from "@/context/bookmarks-context";
import type { DisplayVerse } from "@/hooks/use-chapter-verses";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import { localizeNumber } from "@/lib/translation-map";
import styles from "./page.module.css";

interface Props {
  verses: DisplayVerse[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  chapterNumber: number;
  chapterName: string;
  lang: TranslationLang;
  onLangChange: (lang: TranslationLang) => void;
  prev: { href: string; name: string } | null;
  next: { href: string; name: string } | null;
}

export default function QuranReaderClient({
  verses,
  loading,
  error,
  retry,
  chapterNumber,
  chapterName,
  lang,
  onLangChange,
  prev,
  next,
}: Props) {
  const isAuthenticated = useIsAuthenticated();
  const searchParams = useSearchParams();
  const {
    mode: persistedMode,
    fontScale: persistedFontScale, showTafseer: persistedShowTafseer,
  } = useReaderSettings();
  const { bookmarks, savePosition, hasCustomBookmarks } = useBookmarks();

  // Local page-level state: query param > persisted setting
  const qMode = searchParams.get("mode");
  const qTafseer = searchParams.get("tafseer");
  const [mode, setMode] = useState<ReadingMode>(
    qMode === "verse" || qMode === "continuous" ? qMode : persistedMode,
  );
  const [fontScale, setFontScale] = useState(persistedFontScale);
  const [showTafseer, setShowTafseer] = useState(
    qTafseer === "true" || qTafseer === "false" ? qTafseer === "true" : persistedShowTafseer,
  );

  // Sync from persisted → local when settings sheet changes (skip if query param override is active)
  useEffect(() => {
    if (!searchParams.get("mode")) setMode(persistedMode);
  }, [persistedMode, searchParams]);
  useEffect(() => { setFontScale(persistedFontScale); }, [persistedFontScale]);
  useEffect(() => {
    if (!searchParams.get("tafseer")) setShowTafseer(persistedShowTafseer);
  }, [persistedShowTafseer, searchParams]);

  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [highlightedSeg, setHighlightedSeg] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerVerseRef = useRef<number>(0);
  const popupExplanationRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Compute which verses have bookmarks pointing to this sura
  const bookmarkedVerses = new Set(
    bookmarks
      .filter((b) => b.chapterNumber === chapterNumber && b.verseNumber > 0)
      .map((b) => b.verseNumber),
  );

  const highlightQuery = searchParams.get("highlight") ?? undefined;

  // Scroll to verse from ?verse= query param
  useEffect(() => {
    const verseParam = searchParams.get("verse");
    if (!verseParam || loading || verses.length === 0) return;
    const el = document.getElementById(`verse-${verseParam}`);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [searchParams, loading, verses]);

  const handleShare = async (verseNum: number, arabicText: string) => {
    const text = `${chapterName} ${verseNum} — ${arabicText}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const handleBookmarkVerse = useCallback((verseNum: number) => {
    if (!isAuthenticated) return;
    if (!hasCustomBookmarks) {
      savePosition("nazra", chapterNumber, verseNum);
    } else {
      pickerVerseRef.current = verseNum;
      setPickerOpen(true);
    }
  }, [isAuthenticated, hasCustomBookmarks, savePosition, chapterNumber]);

  const handlePickerSelect = useCallback((slug: string) => {
    savePosition(slug, chapterNumber, pickerVerseRef.current);
  }, [savePosition, chapterNumber]);

  return (
    <>
      <div className="reader-container">
        {loading ? (
          <div className={styles.placeholder}>
            <div className={styles.spinner} />
            <p className={styles.placeholderText}>Loading verses...</p>
          </div>
        ) : error ? (
          <div className={styles.placeholder}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryButton} onClick={retry}>
              Try again
            </button>
          </div>
        ) : mode === "verse" ? (
          <div className={styles.verses}>
            {verses.map((verse) =>
              verse.number === 0 ? (
                <BismillahBlock
                  key={0}
                  arabic={verse.arabic}
                  translation={verse.segments?.map((s) => s.text).filter(Boolean).join(" ")}
                  explanation={showTafseer ? verse.segments?.map((s) => s.explanation).filter(Boolean).join(" ") : undefined}
                  lang={lang}
                  fontScale={fontScale}
                />
              ) : (
                <AyahBlock
                  key={verse.number}
                  chapterNumber={chapterNumber}
                  number={verse.number}
                  arabic={verse.arabic}
                  segments={verse.segments}
                  showTafseer={showTafseer}
                  activeLang={lang}
                  fontScale={fontScale}
                  isBookmarked={bookmarkedVerses.has(verse.number)}
                  onToggleBookmark={() => handleBookmarkVerse(verse.number)}
                  onShare={() => handleShare(verse.number, verse.arabic)}
                  highlightQuery={highlightQuery}
                />
              ),
            )}
          </div>
        ) : (
          <div className={styles.continuous}>
            {verses[0]?.number === 0 && (
              <BismillahBlock
                arabic={verses[0].arabic}
                lang={lang}
                fontScale={fontScale}
                onClick={() => {
                  setSelectedVerse(selectedVerse === 0 ? null : 0);
                  setHighlightedSeg(null);
                }}
              />
            )}
            <div
              className={styles.continuousArabic}
              dir="rtl"
              lang="ar"
              style={{ fontSize: `${Math.max(1.625, 1.75 * ((FONT_SIZE_STEPS[fontScale] ?? 100) / 100))}rem` }}
            >
              {verses.map((verse) =>
                verse.number === 0 ? null : (
                  <span
                    key={verse.number}
                    id={`verse-${verse.number}`}
                    className={`${styles.verseSpan} ${selectedVerse === verse.number ? styles.verseSelected : ""}`}
                    onClick={() => {
                      setSelectedVerse(selectedVerse === verse.number ? null : verse.number);
                      setHighlightedSeg(null);
                    }}
                  >
                    {verse.arabic}
                    <span className={styles.separator}>
                      {chapterNumber === 1 && verse.number === 6 ? "\u00A0" : <>{" "}&#1757;{" "}</>}
                      <span className={styles.separatorNumber}>{localizeNumber(verse.number, lang)}</span>
                    </span>
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        <PrevNextNav prev={prev} next={next} />
      </div>

      {mode !== "verse" && selectedVerse != null && (() => {
        const verse = verses.find((v) => v.number === selectedVerse);
        if (!verse) return null;
        const translation = verse.segments
          ? verse.segments.map((s) => s.text).filter(Boolean).join(" ")
          : undefined;
        const isRtl = lang === "urdu";
        const langCode = isRtl ? "ur" : lang === "hindi" ? "hi" : "en";
        const scale = (FONT_SIZE_STEPS[fontScale] ?? 100) / 100;
        const translationSize = Math.max(1.1875, 1.5 * scale);
        const tafseerSize = Math.max(1, 1.125 * scale);
        const translationFontFamily =
          lang === "urdu" ? "var(--font-urdu)"
            : lang === "hindi" ? "var(--font-hindi)"
              : "var(--font-display)";
        const hasExplanations = showTafseer && verse.segments?.some((s) => s.explanation);
        return (
          <div className={styles.versePopup}>
            <div className={styles.popupHeader}>
              <span className={styles.popupRef}>{verse.number === 0 ? chapterNumber : `${chapterNumber}:${verse.number}`}</span>
              <div className={styles.popupActions}>
                <IconButton
                  icon={bookmarkedVerses.has(verse.number) ? "bookmarkFilled" : "bookmark"}
                  label="Save to bookmark"
                  size="sm"
                  filled={bookmarkedVerses.has(verse.number)}
                  onClick={() => handleBookmarkVerse(verse.number)}
                />
                <IconButton
                  icon="share"
                  label="Share verse"
                  size="sm"
                  onClick={() => handleShare(verse.number, verse.arabic)}
                />
                <IconButton
                  icon="close"
                  label="Close"
                  size="sm"
                  onClick={() => setSelectedVerse(null)}
                />
              </div>
            </div>
            <hr className="hairline-gold" />
            {translation && (
              <div
                className={styles.popupTranslation}
                dir={isRtl ? "rtl" : "ltr"}
                lang={langCode}
                style={{
                  fontSize: `${translationSize}rem`,
                  fontFamily: translationFontFamily,
                  lineHeight: isRtl ? "var(--leading-urdu)" : undefined,
                }}
              >
                {showTafseer && verse.segments
                  ? verse.segments.map((seg, i) =>
                      seg.text ? (
                        <span
                          key={i}
                          className={`${styles.popupSegSpan} ${highlightedSeg === i ? styles.popupSegHighlight : ""}`}
                          onClick={() => {
                            const next = highlightedSeg === i ? null : i;
                            setHighlightedSeg(next);
                            if (next != null) {
                              popupExplanationRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            }
                          }}
                        >
                          {seg.text}
                          {seg.explanation && <sup className={styles.popupSegRef}>{i + 1}</sup>}
                          {" "}
                        </span>
                      ) : null,
                    )
                  : translation}
              </div>
            )}
            {hasExplanations && (
              <div
                className={styles.popupTafseer}
                dir={isRtl ? "rtl" : "ltr"}
                lang={langCode}
                style={{
                  fontFamily: translationFontFamily,
                  lineHeight: isRtl ? "var(--leading-urdu)" : undefined,
                }}
              >
                {verse.segments!.map((seg, i) =>
                  seg.explanation ? (
                    <div
                      key={i}
                      ref={(el) => { popupExplanationRefs.current[i] = el; }}
                      className={`${styles.popupTafseerItem} ${isRtl ? styles.popupTafseerRtl : ""} ${highlightedSeg === i ? styles.popupSegHighlight : ""}`}
                      style={{ cursor: "pointer", fontSize: `${tafseerSize}rem` }}
                      onClick={() => setHighlightedSeg(highlightedSeg === i ? null : i)}
                    >
                      <sup className={styles.popupSegRef}>{i + 1}</sup>{" "}
                      <span dangerouslySetInnerHTML={{ __html: seg.explanation }} />
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        );
      })()}

      <BookmarkPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        bookmarks={bookmarks}
        onSelect={handlePickerSelect}
      />

      <ReaderToolbar
        prev={prev}
        next={next}
        mode={mode}
        onModeChange={(m) => { setMode(m); setSelectedVerse(null); }}
        lang={lang}
        onLangChange={onLangChange}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
      />
    </>
  );
}
