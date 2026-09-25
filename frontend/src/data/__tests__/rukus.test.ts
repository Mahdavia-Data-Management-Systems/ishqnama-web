import { describe, expect, it } from "vitest";
import { suras } from "@/data/suras";
import {
  RUKUS,
  RUKU_BY_ID,
  RUKU_COUNTS_BY_SURA,
  RUKU_RANGES_BY_JUZ,
  rukusInChapter,
  rukusInJuz,
} from "@/data/rukus";

describe("static ruku data", () => {
  it("has all 556 rukus covering all 6236 verses", () => {
    expect(RUKUS).toHaveLength(556);
    expect(RUKUS.reduce((sum, r) => sum + r.verseCount, 0)).toBe(6236);
  });

  it("numbers rukus 1..N within every chapter", () => {
    for (let ch = 1; ch <= 114; ch++) {
      const ranks = rukusInChapter(ch).map((r) => r.rankInChapter);
      expect(ranks).toEqual(Array.from({ length: RUKU_COUNTS_BY_SURA[ch] }, (_, i) => i + 1));
    }
  });

  it("numbers rukus contiguously within every juz", () => {
    for (let juz = 1; juz <= 30; juz++) {
      const { min, max } = RUKU_RANGES_BY_JUZ[juz];
      const ranks = rukusInJuz(juz).map((r) => r.rankInJuz);
      expect(ranks).toEqual(Array.from({ length: max - min + 1 }, (_, i) => min + i));
    }
  });

  it("matches each chapter's verse count", () => {
    for (const sura of suras) {
      const total = rukusInChapter(sura.number).reduce((sum, r) => sum + r.verseCount, 0);
      expect(total, `chapter ${sura.number}`).toBe(sura.verseCount);
    }
  });

  it("looks rukus up by id", () => {
    expect(RUKU_BY_ID.get(1)).toMatchObject({ chapterNumber: 1, juzNumber: 1, rankInJuz: 0 });
    expect(RUKU_BY_ID.get(556)).toMatchObject({ chapterNumber: 114, juzNumber: 30 });
  });
});
