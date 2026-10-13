/**
 * Every reader-facing string of the recitation bar and its play controls. Readers are often
 * unfamiliar with technology, so nothing here says "player", "audio file", "stream", "load",
 * "service" or "server": what the reader hears is a "recitation" or a "recording". Sentence
 * case, under twelve words. `src/config/__tests__/audio-copy.test.ts` enforces these rules.
 */
export const AUDIO_COPY = {
  bismillah: "Bismillah",
  verse: (n: number) => `Verse ${n}`,
} as const;
