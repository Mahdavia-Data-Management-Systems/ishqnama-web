import { describe, expect, it } from "vitest";
import { PODCAST_COPY } from "@/config/podcast-copy";

// The same rule as the recitation bar: readers unfamiliar with technology never read "player",
// "stream", "audio file" or "load"; what they hear is a "discussion" or a "recording".
const BANNED = /(service|\bapi\b|server|session|player|stream|audio file|\bload|buffer|download|podcast)/i;

const allStrings: string[] = Object.values(PODCAST_COPY).map((v) => (typeof v === "function" ? v("Hamza") : v));

describe("podcast copy", () => {
  it("names every control and state the bubble shows", () => {
    for (const key of ["regionLabel", "listen", "pause", "resume", "close", "couldNotStart", "tryAgain", "seek"] as const) {
      expect(PODCAST_COPY[key].length, key).toBeGreaterThan(0);
    }
    expect(PODCAST_COPY.speaking("Zoya")).toContain("Zoya");
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
    }
  });
});
