import { suras } from "@/data/suras";

/**
 * The quarter of a juz, 1-3, where 1 is the first quarter and 3 is the last quarter.
 */
export type JuzQuarter = 1 | 2 | 3;

export interface JuzQuarterStart {
  juz: number;
  precedingQuarter: JuzQuarter;
  startChapter: number;
  startVerse: number;
}

/**
 * The start of each quarter of each juz, in order starting from 2nd quarter of Juz 1. 
 * 2nd Quarter of Juz 1 starts at 2:47, 3rd quarter of Juz 1 starts at 2:79, and so on. 
 * The quarter mark is rendered on the verse before the quarter starts, at the boundary, where the ruku mark also sits.
 * 
 */
export const JUZ_QUARTERS: readonly JuzQuarterStart[] = [
  { juz: 1, precedingQuarter: 1, startChapter: 2, startVerse: 47 },
  { juz: 1, precedingQuarter: 2, startChapter: 2, startVerse: 79 },
  { juz: 1, precedingQuarter: 3, startChapter: 2, startVerse: 110 },
  { juz: 2, precedingQuarter: 1, startChapter: 2, startVerse: 177 },
  { juz: 2, precedingQuarter: 2, startChapter: 2, startVerse: 203 },
  { juz: 2, precedingQuarter: 3, startChapter: 2, startVerse: 232 },
  { juz: 3, precedingQuarter: 1, startChapter: 2, startVerse: 274 },
  { juz: 3, precedingQuarter: 2, startChapter: 3, startVerse: 19 },
  { juz: 3, precedingQuarter: 3, startChapter: 3, startVerse: 55 },
  { juz: 4, precedingQuarter: 1, startChapter: 3, startVerse: 126 },
  { juz: 4, precedingQuarter: 2, startChapter: 3, startVerse: 165 },
  { juz: 4, precedingQuarter: 3, startChapter: 3, startVerse: 199 },
  { juz: 5, precedingQuarter: 1, startChapter: 4, startVerse: 57 },
  { juz: 5, precedingQuarter: 2, startChapter: 4, startVerse: 87 },
  { juz: 5, precedingQuarter: 3, startChapter: 4, startVerse: 114 },
  { juz: 6, precedingQuarter: 1, startChapter: 5, startVerse: 3 },
  { juz: 6, precedingQuarter: 2, startChapter: 5, startVerse: 28 },
  { juz: 6, precedingQuarter: 3, startChapter: 5, startVerse: 54 },
  { juz: 7, precedingQuarter: 1, startChapter: 5, startVerse: 114 },
  { juz: 7, precedingQuarter: 2, startChapter: 6, startVerse: 36 },
  { juz: 7, precedingQuarter: 3, startChapter: 6, startVerse: 73 },
  { juz: 8, precedingQuarter: 1, startChapter: 6, startVerse: 141 },
  { juz: 8, precedingQuarter: 2, startChapter: 7, startVerse: 1 },
  { juz: 8, precedingQuarter: 3, startChapter: 7, startVerse: 44 },
  { juz: 9, precedingQuarter: 1, startChapter: 7, startVerse: 138 },
  { juz: 9, precedingQuarter: 2, startChapter: 7, startVerse: 164 },
  { juz: 9, precedingQuarter: 3, startChapter: 8, startVerse: 1 },
  { juz: 10, precedingQuarter: 1, startChapter: 9, startVerse: 1 },
  { juz: 10, precedingQuarter: 2, startChapter: 9, startVerse: 34 },
  { juz: 10, precedingQuarter: 3, startChapter: 9, startVerse: 63 },
  { juz: 11, precedingQuarter: 1, startChapter: 9, startVerse: 124 },
  { juz: 11, precedingQuarter: 2, startChapter: 10, startVerse: 31 },
  { juz: 11, precedingQuarter: 3, startChapter: 10, startVerse: 71 },
  { juz: 12, precedingQuarter: 1, startChapter: 11, startVerse: 45 },
  { juz: 12, precedingQuarter: 2, startChapter: 11, startVerse: 84 },
  { juz: 12, precedingQuarter: 3, startChapter: 12, startVerse: 18 },
  { juz: 13, precedingQuarter: 1, startChapter: 12, startVerse: 96 },
  { juz: 13, precedingQuarter: 2, startChapter: 13, startVerse: 19 },
  { juz: 13, precedingQuarter: 3, startChapter: 14, startVerse: 10 },
  { juz: 14, precedingQuarter: 1, startChapter: 15, startVerse: 94 },
  { juz: 14, precedingQuarter: 2, startChapter: 16, startVerse: 45 },
  { juz: 14, precedingQuarter: 3, startChapter: 16, startVerse: 87 },
  { juz: 15, precedingQuarter: 1, startChapter: 17, startVerse: 49 },
  { juz: 15, precedingQuarter: 2, startChapter: 17, startVerse: 98 },
  { juz: 15, precedingQuarter: 3, startChapter: 18, startVerse: 29 },
  { juz: 16, precedingQuarter: 1, startChapter: 19, startVerse: 21 },
  { juz: 16, precedingQuarter: 2, startChapter: 20, startVerse: 1 },
  { juz: 16, precedingQuarter: 3, startChapter: 20, startVerse: 74 },
  { juz: 17, precedingQuarter: 1, startChapter: 21, startVerse: 51 },
  { juz: 17, precedingQuarter: 2, startChapter: 22, startVerse: 1 },
  { juz: 17, precedingQuarter: 3, startChapter: 22, startVerse: 39 },
  { juz: 18, precedingQuarter: 1, startChapter: 23, startVerse: 74 },
  { juz: 18, precedingQuarter: 2, startChapter: 24, startVerse: 21 },
  { juz: 18, precedingQuarter: 3, startChapter: 24, startVerse: 51 },
  { juz: 19, precedingQuarter: 1, startChapter: 26, startVerse: 1 },
  { juz: 19, precedingQuarter: 2, startChapter: 26, startVerse: 117 },
  { juz: 19, precedingQuarter: 3, startChapter: 27, startVerse: 7 },
  { juz: 20, precedingQuarter: 1, startChapter: 28, startVerse: 14 },
  { juz: 20, precedingQuarter: 2, startChapter: 28, startVerse: 53 },
  { juz: 20, precedingQuarter: 3, startChapter: 29, startVerse: 1 },
  { juz: 21, precedingQuarter: 1, startChapter: 30, startVerse: 28 },
  { juz: 21, precedingQuarter: 2, startChapter: 31, startVerse: 15 },
  { juz: 21, precedingQuarter: 3, startChapter: 32, startVerse: 27 },
  { juz: 22, precedingQuarter: 1, startChapter: 33, startVerse: 63 },
  { juz: 22, precedingQuarter: 2, startChapter: 34, startVerse: 31 },
  { juz: 22, precedingQuarter: 3, startChapter: 35, startVerse: 15 },
  { juz: 23, precedingQuarter: 1, startChapter: 37, startVerse: 24 },
  { juz: 23, precedingQuarter: 2, startChapter: 37, startVerse: 145 },
  { juz: 23, precedingQuarter: 3, startChapter: 38, startVerse: 52 },
  { juz: 24, precedingQuarter: 1, startChapter: 40, startVerse: 1 },
  { juz: 24, precedingQuarter: 2, startChapter: 40, startVerse: 41 },
  { juz: 24, precedingQuarter: 3, startChapter: 41, startVerse: 6 },
  { juz: 25, precedingQuarter: 1, startChapter: 42, startVerse: 30 },
  { juz: 25, precedingQuarter: 2, startChapter: 43, startVerse: 26 },
  { juz: 25, precedingQuarter: 3, startChapter: 44, startVerse: 23 },
  { juz: 26, precedingQuarter: 1, startChapter: 47, startVerse: 36 },
  { juz: 26, precedingQuarter: 2, startChapter: 48, startVerse: 18 },
  { juz: 26, precedingQuarter: 3, startChapter: 49, startVerse: 11 },
  { juz: 27, precedingQuarter: 1, startChapter: 53, startVerse: 31 },
  { juz: 27, precedingQuarter: 2, startChapter: 55, startVerse: 56 },
  { juz: 27, precedingQuarter: 3, startChapter: 56, startVerse: 75 },
  { juz: 28, precedingQuarter: 1, startChapter: 59, startVerse: 11 },
  { juz: 28, precedingQuarter: 2, startChapter: 62, startVerse: 1 },
  { juz: 28, precedingQuarter: 3, startChapter: 64, startVerse: 11 },
  { juz: 29, precedingQuarter: 1, startChapter: 69, startVerse: 1 },
  { juz: 29, precedingQuarter: 2, startChapter: 72, startVerse: 1 },
  { juz: 29, precedingQuarter: 3, startChapter: 75, startVerse: 1 },
  { juz: 30, precedingQuarter: 1, startChapter: 83, startVerse: 1 },
  { juz: 30, precedingQuarter: 2, startChapter: 89, startVerse: 1 },
  { juz: 30, precedingQuarter: 3, startChapter: 98, startVerse: 1 },
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
    return [`${c}-${v}`, q.precedingQuarter];
  }),
);
