"use client";

import { useRef, useState, useEffect, useCallback, Fragment, useMemo } from "react";
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
import { suras } from "@/data/suras";
import styles from "./quran-reader-client.module.css";

interface Props {
  verses: DisplayVerse[];
  loading: boolean;
  error: string | null;
  retry: () => void;
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

  // Derive chapter info from verses
  const chapters = useMemo(
    () => new Set(verses.map((v) => v.chapterNumber)),
    [verses],
  );
  const isMultiChapter = chapters.size > 1;
  const firstChapter = verses[0]?.chapterNumber ?? 1;

  // Group verses by chapter (preserves order) for continuous mode rendering
  const chapterGroups = useMemo(() => {
    const groups: { chapterNumber: number; bismillah: DisplayVerse | null; verses: DisplayVerse[] }[] = [];
    let current: (typeof groups)[number] | null = null;
    for (const v of verses) {
      if (!current || v.chapterNumber !== current.chapterNumber) {
        current = { chapterNumber: v.chapterNumber, bismillah: null, verses: [] };
        groups.push(current);
      }
      if (v.number === 0) current.bismillah = v;
      else current.verses.push(v);
    }
    return groups;
  }, [verses]);

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

  const [selectedVerse, setSelectedVerse] = useState<{ chapter: number; verse: number } | null>(null);
  const [highlightedSeg, setHighlightedSeg] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerChapterRef = useRef<number>(0);
  const pickerVerseRef = useRef<number>(0);
  const popupExplanationRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Compute which verses have bookmarks — keyed by "chapter-verse" for cross-chapter support
  const bookmarkedVerses = useMemo(
    () =>
      new Set(
        bookmarks
          .filter((b) => b.verseNumber > 0)
          .map((b) => `${b.chapterNumber}-${b.verseNumber}`),
      ),
    [bookmarks],
  );

  const highlightQuery = searchParams.get("highlight") ?? undefined;

  // Scroll to verse from ?verse= query param
  useEffect(() => {
    const verseParam = searchParams.get("verse");
    if (!verseParam || loading || verses.length === 0) return;
    // For single-chapter, verseParam is just a number; for multi-chapter it could be "chapter-verse"
    const id = verseParam.includes("-")
      ? `verse-${verseParam}`
      : `verse-${firstChapter}-${verseParam}`;
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [searchParams, loading, verses, firstChapter]);

  const handleShare = async (chapterNum: number, verseNum: number, arabicText: string) => {
    const sura = suras.find((s) => s.number === chapterNum);
    const label = sura?.name ?? `Chapter ${chapterNum}`;
    const ref = isMultiChapter ? `${chapterNum}:${verseNum}` : `${verseNum}`;
    const text = `${label} ${ref} — ${arabicText}`;
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

  const handleBookmarkVerse = useCallback((chapterNum: number, verseNum: number) => {
    if (!isAuthenticated) return;
    if (!hasCustomBookmarks) {
      savePosition("nazra", chapterNum, verseNum);
    } else {
      pickerChapterRef.current = chapterNum;
      pickerVerseRef.current = verseNum;
      setPickerOpen(true);
    }
  }, [isAuthenticated, hasCustomBookmarks, savePosition]);

  const handlePickerSelect = useCallback((slug: string) => {
    savePosition(slug, pickerChapterRef.current, pickerVerseRef.current);
  }, [savePosition]);

  // Track previous chapter number for rendering dividers
  let lastChapter = -1;

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
            {verses.map((verse) => {
              const showDivider = isMultiChapter && verse.chapterNumber !== lastChapter;
              if (verse.chapterNumber !== lastChapter) lastChapter = verse.chapterNumber;
              const dividerSura = showDivider
                ? suras.find((s) => s.number === verse.chapterNumber)
                : null;
              const bookmarkKey = `${verse.chapterNumber}-${verse.number}`;

              return (
                <Fragment key={bookmarkKey}>
                  {showDivider && dividerSura && (
                    <div
                      className={styles.chapterDivider}
                      style={
                        verse.chapterNumber !== firstChapter
                          ? { borderTop: "1px solid rgba(0,68,70,0.08)" }
                          : undefined
                      }
                    >
                      <span className={styles.chapterDividerArabic} dir="rtl" lang="ar">
                        {dividerSura.arabicName}
                      </span>
                      <span className={styles.chapterDividerName}>
                        {dividerSura.name}
                      </span>
                    </div>
                  )}
                  {verse.number === 0 ? (
                    <BismillahBlock
                      arabic={verse.arabic}
                      translation={verse.segments?.map((s) => s.text).filter(Boolean).join(" ")}
                      explanation={showTafseer ? verse.segments?.map((s) => s.explanation).filter(Boolean).join(" ") : undefined}
                      lang={lang}
                      fontScale={fontScale}
                    />
                  ) : (
                    <AyahBlock
                      chapterNumber={verse.chapterNumber}
                      number={verse.number}
                      arabic={verse.arabic}
                      segments={verse.segments}
                      showTafseer={showTafseer}
                      activeLang={lang}
                      fontScale={fontScale}
                      isBookmarked={bookmarkedVerses.has(bookmarkKey)}
                      onToggleBookmark={() => handleBookmarkVerse(verse.chapterNumber, verse.number)}
                      onShare={() => handleShare(verse.chapterNumber, verse.number, verse.arabic)}
                      highlightQuery={highlightQuery}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        ) : (
          <div className={styles.continuous}>
            {chapterGroups.map((group, gi) => {
              const dividerSura = isMultiChapter
                ? suras.find((s) => s.number === group.chapterNumber)
                : null;
              return (
                <Fragment key={group.chapterNumber}>
                  {dividerSura && (
                    <div
                      className={styles.chapterDivider}
                      style={
                        gi > 0
                          ? { borderTop: "1px solid rgba(0,68,70,0.08)" }
                          : undefined
                      }
                    >
                      <span className={styles.chapterDividerArabic} dir="rtl" lang="ar">
                        {dividerSura.arabicName}
                      </span>
                      <span className={styles.chapterDividerName}>
                        {dividerSura.name}
                      </span>
                    </div>
                  )}
                  {group.bismillah && (
                    <BismillahBlock
                      arabic={group.bismillah.arabic}
                      lang={lang}
                      fontScale={fontScale}
                      onClick={() => {
                        const cur = selectedVerse;
                        setSelectedVerse(
                          cur?.chapter === group.chapterNumber && cur.verse === 0
                            ? null
                            : { chapter: group.chapterNumber, verse: 0 },
                        );
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
                    {group.verses.map((verse) => (
                      <span
                        key={`${verse.chapterNumber}-${verse.number}`}
                        id={`verse-${verse.chapterNumber}-${verse.number}`}
                        className={`${styles.verseSpan} ${
                          selectedVerse?.chapter === verse.chapterNumber && selectedVerse.verse === verse.number
                            ? styles.verseSelected
                            : ""
                        }`}
                        onClick={() => {
                          const cur = selectedVerse;
                          setSelectedVerse(
                            cur?.chapter === verse.chapterNumber && cur.verse === verse.number
                              ? null
                              : { chapter: verse.chapterNumber, verse: verse.number },
                          );
                          setHighlightedSeg(null);
                        }}
                      >
                        {verse.arabic}
                        <span className={styles.separator}>
                          {verse.chapterNumber === 1 && verse.number === 6 ? "\u00A0" : <>{" "}&#1757;{" "}</>}
                          <span className={styles.separatorNumber}>{localizeNumber(verse.number, lang)}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        <PrevNextNav prev={prev} next={next} />
      </div>

      {mode !== "verse" && selectedVerse != null && (() => {
        const verse = verses.find(
          (v) => v.chapterNumber === selectedVerse.chapter && v.number === selectedVerse.verse,
        );
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
        const popupRef = verse.number === 0
          ? `${selectedVerse.chapter}`
          : `${selectedVerse.chapter}:${verse.number}`;
        const bookmarkKey = `${selectedVerse.chapter}-${verse.number}`;
        return (
          <div className={styles.versePopup}>
            <div className={styles.popupHeader}>
              <span className={styles.popupRef}>{popupRef}</span>
              <div className={styles.popupActions}>
                <IconButton
                  icon={bookmarkedVerses.has(bookmarkKey) ? "bookmarkFilled" : "bookmark"}
                  label="Save to bookmark"
                  size="sm"
                  filled={bookmarkedVerses.has(bookmarkKey)}
                  onClick={() => handleBookmarkVerse(selectedVerse.chapter, verse.number)}
                />
                <IconButton
                  icon="share"
                  label="Share verse"
                  size="sm"
                  onClick={() => handleShare(selectedVerse.chapter, verse.number, verse.arabic)}
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
