"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import SuraHeader from "@/components/scripture/sura-header";
import BismillahBlock from "@/components/scripture/bismillah-block";
import AyahBlock from "@/components/scripture/ayah-block";
import ChapterNav from "@/components/scripture/chapter-nav";
import ReaderToolbar from "@/components/reader-toolbar";
import IconButton from "@/components/ui/icon-button";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useChapterVerses } from "@/hooks/use-chapter-verses";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import { suras } from "@/data/suras";
import { getUserBookmarks, addBookmark, removeBookmark, addHistoryEntry } from "@/lib/user-api";
import styles from "./page.module.css";

export default function SuraReaderClient({ suraNumber }: { suraNumber: number }) {
  const sura = suras.find((s) => s.number === suraNumber);
  const isAuthenticated = useIsAuthenticated();
  const { mode, setMode, lang, setLang, fontScale, setFontScale, showTafseer } = useReaderSettings();
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [highlightedSeg, setHighlightedSeg] = useState<number | null>(null);
  const popupExplanationRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!sura) {
    notFound();
  }

  // Load bookmarks from API
  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    getUserBookmarks(controller.signal)
      .then((bookmarks) => {
        const suraBookmarks = bookmarks
          .filter((b) => b.chapterNumber === suraNumber)
          .map((b) => b.verseNumber);
        setBookmarked(new Set(suraBookmarks));
      })
      .catch(() => { /* keep empty set */ });
    return () => controller.abort();
  }, [isAuthenticated, suraNumber]);

  // Record reading history
  useEffect(() => {
    if (!isAuthenticated) return;
    addHistoryEntry(suraNumber).catch(() => { /* silent */ });
  }, [isAuthenticated, suraNumber]);

  const prevSura = suraNumber > 1 ? suras[suraNumber - 2] : null;
  const nextSura = suraNumber < 114 ? suras[suraNumber] : null;

  const { verses, loading, error, retry } = useChapterVerses(suraNumber, lang);
  const showBismillah = suraNumber !== 9 && suraNumber !== 1;

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

  const toggleBookmark = useCallback((verseNum: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(verseNum)) {
        next.delete(verseNum);
        if (isAuthenticated) removeBookmark(suraNumber, verseNum).catch(() => { /* silent */ });
      } else {
        next.add(verseNum);
        if (isAuthenticated) addBookmark(suraNumber, verseNum).catch(() => { /* silent */ });
      }
      return next;
    });
  }, [isAuthenticated, suraNumber]);

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
            {verses.map((verse) => (
              <AyahBlock
                key={verse.number}
                number={verse.number}
                arabic={verse.arabic}
                segments={verse.segments}
                showTafseer={showTafseer}
                activeLang={lang}
                fontScale={fontScale}
                isBookmarked={bookmarked.has(verse.number)}
                onToggleBookmark={() => toggleBookmark(verse.number)}
                onShare={() => handleShare(verse.number, verse.arabic)}
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
              {verses.map((verse) => (
                <span
                  key={verse.number}
                  className={`${styles.verseSpan} ${selectedVerse === verse.number ? styles.verseSelected : ""}`}
                  onClick={() => {
                    setSelectedVerse(selectedVerse === verse.number ? null : verse.number);
                    setHighlightedSeg(null);
                  }}
                >
                  {verse.arabic}
                  <span className={styles.separator}>
                    {" "}&#1757;{" "}
                    <span className={styles.separatorNumber}>{verse.number}</span>
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
                  icon={bookmarked.has(verse.number) ? "bookmarkFilled" : "bookmark"}
                  label={bookmarked.has(verse.number) ? "Remove bookmark" : "Add bookmark"}
                  size="sm"
                  filled={bookmarked.has(verse.number)}
                  onClick={() => toggleBookmark(verse.number)}
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

      <ReaderToolbar
        prevSura={prevSura ? { number: prevSura.number, name: prevSura.name } : null}
        nextSura={nextSura ? { number: nextSura.number, name: nextSura.name } : null}
        mode={mode}
        onModeChange={setMode}
        lang={lang}
        onLangChange={setLang}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
      />
    </main>
  );
}
