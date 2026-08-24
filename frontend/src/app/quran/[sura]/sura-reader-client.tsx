"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import SuraHeader from "@/components/scripture/sura-header";
import BismillahBlock from "@/components/scripture/bismillah-block";
import AyahBlock from "@/components/scripture/ayah-block";
import ChapterNav from "@/components/scripture/chapter-nav";
import ReaderToolbar from "@/components/reader-toolbar";
import { useReaderSettings } from "@/context/reader-settings-context";
import { suras } from "@/data/suras";
import { fatihaVerses } from "@/data/sample-verses";
import styles from "./page.module.css";

export default function SuraReaderClient({ suraNumber }: { suraNumber: number }) {
  const sura = suras.find((s) => s.number === suraNumber);
  const { mode, setMode, lang, setLang, fontScale, setFontScale } = useReaderSettings();
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());

  if (!sura) {
    notFound();
  }

  const prevSura = suraNumber > 1 ? suras[suraNumber - 2] : null;
  const nextSura = suraNumber < 114 ? suras[suraNumber] : null;

  const verses = suraNumber === 1 ? fatihaVerses : [];
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

  const toggleBookmark = (verseNum: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(verseNum)) next.delete(verseNum);
      else next.add(verseNum);
      return next;
    });
  };

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

        {mode === "verse" ? (
          <div className={styles.verses}>
            {verses.length > 0 ? (
              verses.map((verse) => (
                <AyahBlock
                  key={verse.number}
                  number={verse.number}
                  arabic={verse.arabic}
                  translations={verse.translations}
                  activeLang={lang}
                  fontScale={fontScale}
                  isBookmarked={bookmarked.has(verse.number)}
                  onToggleBookmark={() => toggleBookmark(verse.number)}
                  onShare={() => handleShare(verse.number, verse.arabic)}
                />
              ))
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.placeholderText}>
                  Verse data for {sura.name} will be loaded from the API.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.continuous}>
            {verses.length > 0 ? (
              <div className={styles.continuousArabic} dir="rtl" lang="ar">
                {verses.map((verse) => (
                  <span key={verse.number}>
                    {verse.arabic}
                    <span className={styles.separator}> &#1757; </span>
                  </span>
                ))}
              </div>
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.placeholderText}>
                  Continuous mode for {sura.name} will be available with the API.
                </p>
              </div>
            )}
          </div>
        )}

        <ChapterNav
          prevSura={prevSura ? { number: prevSura.number, name: prevSura.name } : null}
          nextSura={nextSura ? { number: nextSura.number, name: nextSura.name } : null}
        />
      </div>

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
