import { suras } from "@/data/suras";

export type JuzQuarter = 1 | 2 | 3;

export interface JuzQuarterStart {
  juz: number;
  quarter: JuzQuarter;
  startChapter: number;
  startVerse: number;
}

/**
 * Where each juz reaches a quarter (1), half (2) and three quarters (3). The
 * divisions never change, so they ship with the app. Taken from the
 * HizbQaurter table in Tanzil's quran-data.js (tanzil.net/res/text/metadata):
 * a juz holds eight hizb quarters, so its quarter points are the starts of
 * its 3rd, 5th and 7th. Each row is the first verse of the new quarter.
 */
export const JUZ_QUARTERS: readonly JuzQuarterStart[] = [
  { juz: 1, quarter: 1, startChapter: 2, startVerse: 47 },
  { juz: 1, quarter: 2, startChapter: 2, startVerse: 79 },
  { juz: 1, quarter: 3, startChapter: 2, startVerse: 110 },
  { juz: 2, quarter: 1, startChapter: 2, startVerse: 177 },
  { juz: 2, quarter: 2, startChapter: 2, startVerse: 203 },
  { juz: 2, quarter: 3, startChapter: 2, startVerse: 232 },
  { juz: 3, quarter: 1, startChapter: 2, startVerse: 274 },
  { juz: 3, quarter: 2, startChapter: 3, startVerse: 19 },
  { juz: 3, quarter: 3, startChapter: 3, startVerse: 55 },
  { juz: 4, quarter: 1, startChapter: 3, startVerse: 126 },
  { juz: 4, quarter: 2, startChapter: 3, startVerse: 165 },
  { juz: 4, quarter: 3, startChapter: 3, startVerse: 199 },
  { juz: 5, quarter: 1, startChapter: 4, startVerse: 57 },
  { juz: 5, quarter: 2, startChapter: 4, startVerse: 87 },
  { juz: 5, quarter: 3, startChapter: 4, startVerse: 114 },
  { juz: 6, quarter: 1, startChapter: 5, startVerse: 3 },
  { juz: 6, quarter: 2, startChapter: 5, startVerse: 28 },
  { juz: 6, quarter: 3, startChapter: 5, startVerse: 54 },
  { juz: 7, quarter: 1, startChapter: 5, startVerse: 114 },
  { juz: 7, quarter: 2, startChapter: 6, startVerse: 36 },
  { juz: 7, quarter: 3, startChapter: 6, startVerse: 73 },
  { juz: 8, quarter: 1, startChapter: 6, startVerse: 141 },
  { juz: 8, quarter: 2, startChapter: 7, startVerse: 0 },
  { juz: 8, quarter: 3, startChapter: 7, startVerse: 44 },
  { juz: 9, quarter: 1, startChapter: 7, startVerse: 138 },
  { juz: 9, quarter: 2, startChapter: 7, startVerse: 164 },
  { juz: 9, quarter: 3, startChapter: 8, startVerse: 0 },
  { juz: 10, quarter: 1, startChapter: 9, startVerse: 1 },
  { juz: 10, quarter: 2, startChapter: 9, startVerse: 34 },
  { juz: 10, quarter: 3, startChapter: 9, startVerse: 63 },
  { juz: 11, quarter: 1, startChapter: 9, startVerse: 124 },
  { juz: 11, quarter: 2, startChapter: 10, startVerse: 31 },
  { juz: 11, quarter: 3, startChapter: 10, startVerse: 71 },
  { juz: 12, quarter: 1, startChapter: 11, startVerse: 45 },
  { juz: 12, quarter: 2, startChapter: 11, startVerse: 84 },
  { juz: 12, quarter: 3, startChapter: 12, startVerse: 18 },
  { juz: 13, quarter: 1, startChapter: 12, startVerse: 96 },
  { juz: 13, quarter: 2, startChapter: 13, startVerse: 19 },
  { juz: 13, quarter: 3, startChapter: 14, startVerse: 10 },
  { juz: 14, quarter: 1, startChapter: 15, startVerse: 94 },
  { juz: 14, quarter: 2, startChapter: 16, startVerse: 45 },
  { juz: 14, quarter: 3, startChapter: 16, startVerse: 87 },
  { juz: 15, quarter: 1, startChapter: 17, startVerse: 49 },
  { juz: 15, quarter: 2, startChapter: 17, startVerse: 98 },
  { juz: 15, quarter: 3, startChapter: 18, startVerse: 29 },
  { juz: 16, quarter: 1, startChapter: 19, startVerse: 21 },
  { juz: 16, quarter: 2, startChapter: 20, startVerse: 0 },
  { juz: 16, quarter: 3, startChapter: 20, startVerse: 74 },
  { juz: 17, quarter: 1, startChapter: 21, startVerse: 51 },
  { juz: 17, quarter: 2, startChapter: 22, startVerse: 0 },
  { juz: 17, quarter: 3, startChapter: 22, startVerse: 39 },
  { juz: 18, quarter: 1, startChapter: 23, startVerse: 75 },
  { juz: 18, quarter: 2, startChapter: 24, startVerse: 21 },
  { juz: 18, quarter: 3, startChapter: 24, startVerse: 53 },
  { juz: 19, quarter: 1, startChapter: 26, startVerse: 1 },
  { juz: 19, quarter: 2, startChapter: 26, startVerse: 111 },
  { juz: 19, quarter: 3, startChapter: 27, startVerse: 1 },
  { juz: 20, quarter: 1, startChapter: 28, startVerse: 12 },
  { juz: 20, quarter: 2, startChapter: 28, startVerse: 51 },
  { juz: 20, quarter: 3, startChapter: 29, startVerse: 1 },
  { juz: 21, quarter: 1, startChapter: 30, startVerse: 31 },
  { juz: 21, quarter: 2, startChapter: 31, startVerse: 22 },
  { juz: 21, quarter: 3, startChapter: 33, startVerse: 1 },
  { juz: 22, quarter: 1, startChapter: 33, startVerse: 60 },
  { juz: 22, quarter: 2, startChapter: 34, startVerse: 24 },
  { juz: 22, quarter: 3, startChapter: 35, startVerse: 15 },
  { juz: 23, quarter: 1, startChapter: 37, startVerse: 22 },
  { juz: 23, quarter: 2, startChapter: 37, startVerse: 145 },
  { juz: 23, quarter: 3, startChapter: 38, startVerse: 52 },
  { juz: 24, quarter: 1, startChapter: 40, startVerse: 1 },
  { juz: 24, quarter: 2, startChapter: 40, startVerse: 41 },
  { juz: 24, quarter: 3, startChapter: 41, startVerse: 9 },
  { juz: 25, quarter: 1, startChapter: 42, startVerse: 27 },
  { juz: 25, quarter: 2, startChapter: 43, startVerse: 24 },
  { juz: 25, quarter: 3, startChapter: 44, startVerse: 17 },
  { juz: 26, quarter: 1, startChapter: 47, startVerse: 10 },
  { juz: 26, quarter: 2, startChapter: 48, startVerse: 18 },
  { juz: 26, quarter: 3, startChapter: 49, startVerse: 14 },
  { juz: 27, quarter: 1, startChapter: 53, startVerse: 26 },
  { juz: 27, quarter: 2, startChapter: 55, startVerse: 1 },
  { juz: 27, quarter: 3, startChapter: 56, startVerse: 75 },
  { juz: 28, quarter: 1, startChapter: 59, startVerse: 11 },
  { juz: 28, quarter: 2, startChapter: 62, startVerse: 1 },
  { juz: 28, quarter: 3, startChapter: 65, startVerse: 1 },
  { juz: 29, quarter: 1, startChapter: 69, startVerse: 1 },
  { juz: 29, quarter: 2, startChapter: 72, startVerse: 1 },
  { juz: 29, quarter: 3, startChapter: 75, startVerse: 1 },
  { juz: 30, quarter: 1, startChapter: 82, startVerse: 1 },
  { juz: 30, quarter: 2, startChapter: 87, startVerse: 1 },
  { juz: 30, quarter: 3, startChapter: 94, startVerse: 1 },
];

/** The verse before a quarter starts, crossing back into the previous chapter at verse 1 */
function verseBefore(chapter: number, verse: number): [number, number] {
  return verse > 1 ? [chapter, verse - 1] : [chapter - 1, suras[chapter - 2].verseCount];
}

/**
 * The quarter mark each verse carries, keyed "chapter-verse". The mark sits at
 * the end of the verse before the quarter starts, at the boundary, where the
 * ruku mark also sits.
 */
export const JUZ_QUARTER_BY_VERSE: ReadonlyMap<string, JuzQuarter> = new Map(
  JUZ_QUARTERS.map((q) => {
    const [c, v] = verseBefore(q.startChapter, q.startVerse);
    return [`${c}-${v}`, q.quarter];
  }),
);
