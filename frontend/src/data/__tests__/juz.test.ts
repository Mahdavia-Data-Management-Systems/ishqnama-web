import { describe, expect, it } from "vitest";
import { suras } from "@/data/suras";
import { JUZ, JUZ_BY_NUMBER } from "@/data/juz";

describe("static juz data", () => {
  it("has all 30 ajza numbered 1..30", () => {
    expect(JUZ.map((j) => j.juzNumber)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(JUZ_BY_NUMBER.get(30)?.transliteratedName).toBe("‘Amma");
  });

  it("covers the Quran end to end with no gaps", () => {
    expect(JUZ[0]).toMatchObject({ startChapter: 1, startVerse: 0 });
    expect(JUZ[29]).toMatchObject({ endChapter: 114, endVerse: suras[113].verseCount });

    for (let i = 1; i < JUZ.length; i++) {
      const prev = JUZ[i - 1];
      const cur = JUZ[i];
      const prevChapterEnd = prev.endVerse === suras[prev.endChapter! - 1].verseCount;
      if (prevChapterEnd) {
        // The next juz opens a new chapter at its bismillah (0) or first verse.
        expect(cur.startChapter).toBe(prev.endChapter! + 1);
        expect([0, 1]).toContain(cur.startVerse);
      } else {
        expect(cur.startChapter).toBe(prev.endChapter);
        expect(cur.startVerse).toBe(prev.endVerse! + 1);
      }
    }
  });
});
