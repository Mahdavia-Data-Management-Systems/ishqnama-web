import { describe, expect, it } from "vitest";
import { TAFSEER_COPY } from "@/config/tafseer-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
const BANNED = /(service|\bapi\b|server|session|html|\btag|popup|modal|dialog|\bload|database|citation data)/i;

const allStrings: string[] = Object.values(TAFSEER_COPY);

describe("tafseer copy", () => {
  it("names the sheet, its button and the quoted passage", () => {
    expect(TAFSEER_COPY.takhreej).toBe("Takhreej");
    expect(TAFSEER_COPY.showTakhreej).toBe("Show takhreej");
    for (const key of ["takhreej", "showTakhreej", "passage"] as const) {
      expect(TAFSEER_COPY[key].length, key).toBeGreaterThan(0);
    }
  });

  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string under twelve words", () => {
    for (const s of allStrings) expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
  });

  it("is written in sentence case", () => {
    for (const s of allStrings) {
      expect(s[0], s).toBe(s[0].toUpperCase());
      expect(s, s).not.toBe(s.toUpperCase());
      for (const word of s.trim().split(/\s+/).slice(1)) {
        const bare = word.replace(/[^\p{L}]/gu, "");
        if (!bare) continue;
        expect(bare[0] === bare[0].toUpperCase() && bare[0] !== bare[0].toLowerCase(), `${word} in "${s}"`).toBe(false);
      }
    }
  });
});
