import { describe, expect, it } from "vitest";
import { BIBLIOGRAPHY_COPY } from "@/config/bibliography-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
const BANNED = /(service|\bapi\b|server|session|canvas|\bgraph|\bnode|popup|modal|dialog|\bload|database|citation data)/i;

const allStrings: string[] = Object.values(BIBLIOGRAPHY_COPY);

describe("bibliography copy", () => {
  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string under twelve words", () => {
    for (const s of allStrings) expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
  });

  it("is written in sentence case", () => {
    const properNouns = ["Noor", "Imaan"];
    for (const s of allStrings) {
      expect(s[0], s).toBe(s[0].toUpperCase());
      expect(s, s).not.toBe(s.toUpperCase());
      for (const word of s.trim().split(/\s+/).slice(1)) {
        const bare = word.replace(/[^\p{L}]/gu, "");
        if (!bare) continue;
        if (bare[0] === bare[0].toUpperCase() && bare[0] !== bare[0].toLowerCase()) {
          expect(properNouns, `${word} in "${s}"`).toContain(bare);
        }
      }
    }
  });
});
