import { describe, expect, it } from "vitest";
import {
  NOT_NOW_LABEL,
  SIGN_IN_COPY,
  SIGN_IN_CREDIT,
  SIGN_IN_LABEL,
} from "@/config/sign-in-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
const BANNED = /(service|\bapi\b|server|account|log in|authenticat|session)/i;

const allStrings: string[] = [
  ...Object.values(SIGN_IN_COPY).flatMap((c) => [c.title, c.body]),
  SIGN_IN_LABEL,
  NOT_NOW_LABEL,
  SIGN_IN_CREDIT,
];

describe("sign-in copy", () => {
  it("covers every feature with a title and a body", () => {
    for (const feature of ["settings", "saved", "bookmark", "search"] as const) {
      expect(SIGN_IN_COPY[feature].title.length).toBeGreaterThan(0);
      expect(SIGN_IN_COPY[feature].body.length).toBeGreaterThan(0);
    }
  });

  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string under twelve words", () => {
    for (const s of allStrings) expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
  });

  it("is written in sentence case", () => {
    const properNouns = ["Noor", "Imaan", "Mahdavia", "Data", "Management", "System"];
    for (const s of allStrings) {
      expect(s[0], s).toBe(s[0].toUpperCase());
      expect(s, s).not.toBe(s.toUpperCase());

      const words = s.trim().split(/\s+/);
      for (const word of words.slice(1)) {
        const bare = word.replace(/[^\p{L}]/gu, "");
        if (!bare) continue;
        if (bare[0] === bare[0].toUpperCase() && bare[0] !== bare[0].toLowerCase()) {
          expect(properNouns, `${word} in "${s}"`).toContain(bare);
        }
      }
    }
  });
});
