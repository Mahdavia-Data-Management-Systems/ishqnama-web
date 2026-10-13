import { describe, expect, it } from "vitest";
import { AUDIO_COPY } from "@/config/audio-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
// What the reader hears is a "recitation" or a "recording", never a "player" or a "stream".
const BANNED = /(service|\bapi\b|server|session|player|stream|audio file|\bload|buffer|download)/i;

const allStrings: string[] = Object.values(AUDIO_COPY).map((v) => (typeof v === "function" ? v(7) : v));

describe("audio copy", () => {
  it("names every control and state the bar shows", () => {
    for (const key of [
      "regionLabel", "playRecitation", "pause", "resume", "previousVerse", "nextVerse",
      "closeRecording", "couldNotStart", "tryAgain", "playList", "playFromGroup", "bismillah",
    ] as const) {
      expect(AUDIO_COPY[key].length, key).toBeGreaterThan(0);
    }
    expect(AUDIO_COPY.verse(255)).toBe("Verse 255");
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
