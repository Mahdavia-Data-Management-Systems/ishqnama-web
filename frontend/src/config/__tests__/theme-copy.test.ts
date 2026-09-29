import { describe, expect, it } from "vitest";
import { THEME_MENU_LABEL, THEME_OPTIONS } from "@/config/theme-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
const BANNED = /(system|theme|\bapi\b|server|service|\bmode\b)/i;

const allStrings = [THEME_MENU_LABEL, ...THEME_OPTIONS.map((o) => o.label)];

describe("theme copy", () => {
  it("offers light, dark and match my device, in that order", () => {
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual(["light", "dark", "system"]);
  });

  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string short and in sentence case", () => {
    for (const s of allStrings) {
      expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
      expect(s[0], s).toBe(s[0].toUpperCase());
      for (const word of s.split(/\s+/).slice(1)) expect(word, s).toBe(word.toLowerCase());
    }
  });
});
