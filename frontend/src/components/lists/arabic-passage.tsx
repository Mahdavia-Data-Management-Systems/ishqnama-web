"use client";

import { useMemo } from "react";
import AyahMarkerContainer from "@/components/scripture/ayah-marker-container";
import JuzQuarterMark from "@/components/scripture/juz-quarter-mark";
import RukuMark from "@/components/scripture/ruku-mark";
import SajdahMark from "@/components/scripture/sajdah-mark";
import { JUZ_QUARTER_BY_VERSE } from "@/data/juz-quarters";
import { RUKU_BY_ID } from "@/data/rukus";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import { useReaderSettings } from "@/context/reader-settings-context";
import { localizeNumber } from "@/lib/translation-map";
import { rukuEndsInChapter } from "@/lib/verse-lists";
import type { ArabicVerseDto } from "@/types/lists";
import styles from "./arabic-passage.module.css";

interface ArabicPassageProps {
  chapter: number;
  verses: readonly ArabicVerseDto[];
}

/**
 * Verses of one chapter printed the way the reader's continuous mode prints them: the Arabic
 * alone, each ayah closed by its numbered marker, with the sajdah underline and the ruku and juz
 * quarter marks the reader shows. Verse numbers follow the reader's chosen language.
 */
export default function ArabicPassage({ chapter, verses }: ArabicPassageProps) {
  const { lang, fontScale } = useReaderSettings();
  const rukuEnds = useMemo(() => rukuEndsInChapter(chapter), [chapter]);
  const scale = (FONT_SIZE_STEPS[fontScale] ?? 100) / 100;

  return (
    <div
      className={styles.passage}
      dir="rtl"
      lang="ar"
      style={{ fontSize: `${Math.max(1.625, 1.75 * scale)}rem` }}
    >
      {verses.map((verse) => {
        const key = `${chapter}-${verse.verseNumber}`;
        const rukuId = rukuEnds.get(verse.verseNumber);
        const ruku = rukuId != null ? RUKU_BY_ID.get(rukuId) : undefined;
        const quarter = JUZ_QUARTER_BY_VERSE.get(key);
        return (
          <span key={key} className={styles.verse}>
            <span className={verse.hasSajdah ? styles.sajdahUnderline : undefined}>{verse.arabicText}</span>
            <span className={styles.separator}>
              {chapter === 1 && verse.verseNumber === 6 ? " " : <>{" "}&#1757;{" "}</>}
              <span className={styles.separatorNumber}>{localizeNumber(verse.verseNumber, lang)}</span>
            </span>
            <AyahMarkerContainer variant="floated">
              {verse.hasSajdah && <SajdahMark />}
              {ruku && (
                <RukuMark
                  rukuId={ruku.rukuId}
                  rankInChapter={ruku.rankInChapter}
                  rankInJuz={ruku.rankInJuz}
                  verseCount={ruku.verseCount}
                  lang={lang}
                  fontScale={fontScale}
                />
              )}
              {quarter && <JuzQuarterMark quarter={quarter} />}
            </AyahMarkerContainer>
          </span>
        );
      })}
    </div>
  );
}
