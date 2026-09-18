import { describe, expect, it } from "vitest";
import { quranProgress, TOTAL_VERSES } from "@/lib/quran-progress";

describe("quranProgress", () => {
  it("counts 6236 verses", () => {
    expect(TOTAL_VERSES).toBe(6236);
  });

  it("is one verse in at 1:1", () => {
    expect(quranProgress(1, 1)).toBeCloseTo(1 / 6236, 10);
  });

  it("carries al-Fatihah's seven verses into 2:1", () => {
    expect(quranProgress(2, 1)).toBeCloseTo(8 / 6236, 10);
  });

  it("is complete at 114:6", () => {
    expect(quranProgress(114, 6)).toBe(1);
  });

  it("clamps a verse past the end of its chapter", () => {
    expect(quranProgress(2, 9999)).toBeCloseTo((7 + 286) / 6236, 10);
  });

  it("clamps chapters outside 1..114 and verses below 0", () => {
    expect(quranProgress(0, 0)).toBe(0);
    expect(quranProgress(-3, -3)).toBe(0);
    expect(quranProgress(200, 999)).toBe(1);
  });
});
