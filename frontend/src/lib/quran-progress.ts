import { suras } from "@/data/suras";

/** Every verse in the Quran; 6236 with the sura data in this repository. */
export const TOTAL_VERSES = suras.reduce((total, sura) => total + sura.verseCount, 0);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How far through the whole Quran a position is, as a fraction in [0, 1]:
 * every verse of every sura before the chapter, plus the verse number, over the total.
 */
export function quranProgress(chapterNumber: number, verseNumber: number): number {
  const chapterIndex = clamp(Math.floor(chapterNumber), 1, suras.length) - 1;
  const versesBefore = suras
    .slice(0, chapterIndex)
    .reduce((total, sura) => total + sura.verseCount, 0);
  const verse = clamp(Math.floor(verseNumber), 0, suras[chapterIndex].verseCount);
  return clamp((versesBefore + verse) / TOTAL_VERSES, 0, 1);
}
