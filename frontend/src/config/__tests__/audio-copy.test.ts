import { describe, expect, it } from "vitest";
import { AUDIO_COPY } from "@/config/audio-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
// The thing in the dock is a "recording", never a "player", "embed" or "iframe".
const BANNED = /(service|\bapi\b|server|session|embed|iframe|\bload|autoplay|player|spotify link)/i;

const allStrings: string[] = Object.values(AUDIO_COPY);

describe("audio copy", () => {
  it("names the region, the close action, the failure and the way out", () => {
    expect(AUDIO_COPY.regionLabel.length).toBeGreaterThan(0);
    expect(AUDIO_COPY.closeRecording.length).toBeGreaterThan(0);
    expect(AUDIO_COPY.couldNotStart.length).toBeGreaterThan(0);
    expect(AUDIO_COPY.openInSpotify).toMatch(/Spotify/);
    expect(AUDIO_COPY.play.length).toBeGreaterThan(0);
    expect(AUDIO_COPY.pause.length).toBeGreaterThan(0);
  });

  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string under twelve words", () => {
    for (const s of allStrings) expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
  });

  it("is written in sentence case", () => {
    const properNouns = ["Spotify", "Noor", "Imaan"];
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
