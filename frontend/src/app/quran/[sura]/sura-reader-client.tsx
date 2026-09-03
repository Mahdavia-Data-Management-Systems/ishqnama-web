"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { notFound, useSearchParams } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import SuraHeader from "@/components/scripture/sura-header";
import BismillahBlock from "@/components/scripture/bismillah-block";
import AyahBlock from "@/components/scripture/ayah-block";
import ChapterNav from "@/components/scripture/chapter-nav";
import ReaderToolbar, { type ReadingMode, type TranslationLang } from "@/components/reader-toolbar";
import IconButton from "@/components/ui/icon-button";
import BookmarkPicker from "@/components/bookmark-picker";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useBookmarks } from "@/context/bookmarks-context";
import { useChapterVerses } from "@/hooks/use-chapter-verses";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import { localizeNumber } from "@/lib/translation-map";
import { suras } from "@/data/suras";
import { addHistoryEntry } from "@/lib/user-api";
import styles from "./page.module.css";

export default function SuraReaderClient({ suraNumber }: { suraNumber: number }) {
  const sura = suras.find((s) => s.number === suraNumber);
  const isAuthenticated = useIsAuthenticated();
  const searchParams = useSearchParams();
  const {
    mode: persistedMode, lang: persistedLang,
    fontScale: persistedFontScale, showTafseer: persistedShowTafseer,
  } = useReaderSettings();
  const { bookmarks, savePosition, hasCustomBookmarks } = useBookmarks();

  // Local page-level state: query param > persisted setting
  const qMode = searchParams.get("mode");
  const qLang = searchParams.get("lang");
  const qTafseer = searchParams.get("tafseer");
  const [mode, setMode] = useState<ReadingMode>(
    qMode === "verse" || qMode === "continuous" ? qMode : persistedMode,
  );
  const [lang, setLang] = useState<TranslationLang>(
    qLang === "english" || qLang === "hindi" || qLang === "urdu" ? qLang : persistedLang,
  );
  const [fontScale, setFontScale] = useState(persistedFontScale);
  const [showTafseer, setShowTafseer] = useState(
    qTafseer === "true" || qTafseer === "false" ? qTafseer === "true" : persistedShowTafseer,
  );

  // Sync from persisted → local when settings sheet changes (skip if query param override is active)
  useEffect(() => {
    if (!searchParams.get("mode")) setMode(persistedMode);
  }, [persistedMode, searchParams]);
  useEffect(() => {
    if (!searchParams.get("lang")) setLang(persistedLang);
  }, [persistedLang, searchParams]);
  useEffect(() => { setFontScale(persistedFontScale); }, [persistedFontScale]);
  useEffect(() => {
    if (!searchParams.get("tafseer")) setShowTafseer(persistedShowTafseer);
  }, [persistedShowTafseer, searchParams]);

  // Reset on sura navigation (re-apply query param overrides)
  useEffect(() => {
    const qm = searchParams.get("mode");
    const ql = searchParams.get("lang");
    const qt = searchParams.get("tafseer");
    setMode(qm === "verse" || qm === "continuous" ? qm : persistedMode);
    setLang(ql === "english" || ql === "hindi" || ql === "urdu" ? ql : persistedLang);
    setFontScale(persistedFontScale);
    setShowTafseer(qt === "true" || qt === "false" ? qt === "true" : persistedShowTafseer);
    setSelectedVerse(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suraNumber, searchParams]);

  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [highlightedSeg, setHighlightedSeg] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerVerse, setPickerVerse] = useState<number>(0);
  const popupExplanationRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!sura) {
    notFound();
  }

  // Compute which verses have bookmarks pointing to this sura
  const bookmarkedVerses = new Set(
    bookmarks
      .filter((b) => b.chapterNumber === suraNumber && b.verseNumber > 0)
      .map((b) => b.verseNumber),
  );

  // Record reading history
  useEffect(() => {
    if (!isAuthenticated) return;
    addHistoryEntry(suraNumber).catch(() => { /* silent */ });
  }, [isAuthenticated, suraNumber]);

  const prevSura = suraNumber > 1 ? suras[suraNumber - 2] : null;
  const nextSura = suraNumber < 114 ? suras[suraNumber] : null;

  const { verses, loading, error, retry } = useChapterVerses(suraNumber, lang);
  const showBismillah = suraNumber !== 9;
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
    const text = `${sura.name} ${verseNum} — ${arabicText}`;
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
      savePosition("nazra", suraNumber, verseNum);
    } else {
      setPickerVerse(verseNum);
      setPickerOpen(true);
    }
  }, [isAuthenticated, hasCustomBookmarks, savePosition, suraNumber]);

  const handlePickerSelect = useCallback((slug: string) => {
    savePosition(slug, suraNumber, pickerVerse);
  }, [savePosition, suraNumber, pickerVerse]);

  return (
    <main className={`${styles.main} ornament-mihrab`}>
      <SuraHeader
        number={sura.number}
        name={sura.name}
        arabicName={sura.arabicName}
        urduName={sura.urduName}
        revelationType={sura.revelationType}
        verseCount={sura.verseCount}
      />

      <div className="reader-container">
        {showBismillah && <BismillahBlock />}

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
            {verses.filter((v) => v.number !== 0).map((verse) => (
              <AyahBlock
                key={verse.number}
                chapterNumber={suraNumber}
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
            ))}
          </div>
        ) : (
          <div className={styles.continuous}>
            <div
              className={styles.continuousArabic}
              dir="rtl"
              lang="ar"
              style={{ fontSize: `${Math.max(1.625, 1.75 * ((FONT_SIZE_STEPS[fontScale] ?? 100) / 100))}rem` }}
            >
              {verses.filter((v) => v.number !== 0).map((verse) => (
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
                    {suraNumber === 1 && verse.number === 6 ? "\u00A0" : <>{" "}&#1757;{" "}</>}
                    <span className={styles.separatorNumber}>{localizeNumber(verse.number, lang)}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        <ChapterNav
          prevSura={prevSura ? { number: prevSura.number, name: prevSura.name } : null}
          nextSura={nextSura ? { number: nextSura.number, name: nextSura.name } : null}
        />
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
              <span className={styles.popupRef}>{suraNumber}:{verse.number}</span>
              <div className={styles.popupActions}>
                <IconButton
                  icon={bookmarkedVerses.has(verse.number) ? "bookmarkFilled" : "bookmark"}
                  label={bookmarkedVerses.has(verse.number) ? "Remove bookmark" : "Add bookmark"}
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
        prevSura={prevSura ? { number: prevSura.number, name: prevSura.name } : null}
        nextSura={nextSura ? { number: nextSura.number, name: nextSura.name } : null}
        mode={mode}
        onModeChange={(m) => { setMode(m); setSelectedVerse(null); }}
        lang={lang}
        onLangChange={setLang}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
      />
    </main>
  );
}
