/**
 * Every reader-facing string of the recitation bar and its play controls. Readers are often
 * unfamiliar with technology, so nothing here says "player", "audio file", "stream", "load",
 * "service" or "server": what the reader hears is a "recitation" or a "recording". Sentence
 * case, under twelve words. `src/config/__tests__/audio-copy.test.ts` enforces these rules.
 */
export const AUDIO_COPY = {
  /** Accessible name of the bar, so a screen reader can jump to it. */
  regionLabel: "Recording",
  /** The play button on a verse, a popup and a list. */
  playRecitation: "Play recitation",
  pause: "Pause",
  resume: "Play",
  previousVerse: "Previous verse",
  nextVerse: "Next verse",
  closeRecording: "Close recording",
  couldNotStart: "This recording couldn't start.",
  tryAgain: "Try again",
  /** The list page's header button: every group in order. */
  playList: "Play",
  /** A group's own button: from this group to the end of the list. */
  playFromGroup: "Play from here",
  bismillah: "Bismillah",
  verse: (n: number) => `Verse ${n}`,
} as const;
