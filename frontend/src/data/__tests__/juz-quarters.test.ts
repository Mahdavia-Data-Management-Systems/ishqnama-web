import { describe, expect, it } from "vitest";
import { suras } from "@/data/suras";
import { JUZ } from "@/data/juz";
import { JUZ_QUARTERS, JUZ_QUARTER_BY_RUKU, JUZ_QUARTER_BY_VERSE } from "@/data/juz-quarters";
import { RUKUS } from "@/data/rukus";

const order = (chapter: number, verse: number) => chapter * 1000 + verse;

describe("static juz quarter data", () => {
  it("has quarters 1, 2 and 3 for each of the 30 ajza", () => {
    expect(JUZ_QUARTERS).toHaveLength(90);
    JUZ_QUARTERS.forEach((q, i) => {
      expect(q.juz).toBe(Math.floor(i / 3) + 1);
      expect(q.precedingQuarter).toBe((i % 3) + 1);
    });
  });

  it("starts at real verses, in reading order, inside their juz", () => {
    let prev = 0;
    for (const q of JUZ_QUARTERS) {
      expect(q.startVerse).toBeGreaterThanOrEqual(1);
      expect(q.startVerse).toBeLessThanOrEqual(suras[q.startChapter - 1].verseCount);

      const at = order(q.startChapter, q.startVerse);
      expect(at).toBeGreaterThan(prev);
      prev = at;

      const juz = JUZ[q.juz - 1];
      expect(at).toBeGreaterThan(order(juz.startChapter!, juz.startVerse!));
      expect(at).toBeLessThanOrEqual(order(juz.endChapter!, juz.endVerse!));
    }
  });

  it("hangs each mark on the verse before its quarter starts", () => {
    expect(JUZ_QUARTER_BY_VERSE.size).toBe(90);
    // Juz 1: quarters start at 2:47, 2:79 and 2:110
    expect(JUZ_QUARTER_BY_VERSE.get("2-46")).toBe(1);
    expect(JUZ_QUARTER_BY_VERSE.get("2-78")).toBe(2);
    expect(JUZ_QUARTER_BY_VERSE.get("2-109")).toBe(3);
    // Juz 8's half opens al-A'raf, so it closes al-An'am
    expect(JUZ_QUARTER_BY_VERSE.get("6-165")).toBe(2);
    expect(JUZ_QUARTER_BY_VERSE.has("7-0")).toBe(false);
  });

  it("places each mark in, or at the end of, exactly one ruku", () => {
    expect(JUZ_QUARTER_BY_RUKU.size).toBe(90);
    const counts = [...JUZ_QUARTER_BY_RUKU.values()].reduce(
      (n, { quarter }) => ({ ...n, [quarter]: (n[quarter] ?? 0) + 1 }),
      {} as Record<number, number>,
    );
    expect(counts).toEqual({ 1: 30, 2: 30, 3: 30 });
  });

  it("puts a mark after a ruku only when it ends on the ruku's last verse", () => {
    const rukuOf = (chapter: number, rank: number) =>
      RUKUS.find((r) => r.chapterNumber === chapter && r.rankInChapter === rank)!.rukuId;
    // 2:46 ends al-Baqarah's ruku 5 (2:40-46)
    expect(JUZ_QUARTER_BY_RUKU.get(rukuOf(2, 5))).toEqual({ quarter: 1, after: true });
    // 2:78 falls inside ruku 9 (2:72-82)
    expect(JUZ_QUARTER_BY_RUKU.get(rukuOf(2, 9))).toEqual({ quarter: 2, after: false });
    // 6:165 closes al-An'am's last ruku
    expect(JUZ_QUARTER_BY_RUKU.get(rukuOf(6, 20))).toEqual({ quarter: 2, after: true });
  });
});
