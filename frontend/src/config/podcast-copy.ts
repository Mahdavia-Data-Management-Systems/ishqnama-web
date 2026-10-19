/**
 * Every reader-facing string of the mascots' discussion bubble. The same rule as the recitation
 * bar: nothing says "player", "stream", "audio file", "load" or "podcast"; what the reader hears
 * is a "discussion" or a "recording". Sentence case, under twelve words.
 * `src/config/__tests__/podcast-copy.test.ts` enforces these rules.
 */
export const PODCAST_COPY = {
  /** Accessible name of the bubble, so a screen reader can jump to it. */
  regionLabel: "Discussion",
  /** The wordmark in the bubble's brand row, beside the logo. */
  brand: "Ishqnama | Reflections",
  /** The button on a page that opens the bubble and starts the recording. */
  listen: "Listen to the discussion",
  pause: "Pause",
  resume: "Play",
  close: "Close discussion",
  couldNotStart: "This recording couldn't start.",
  tryAgain: "Try again",
  /** The seek slider's accessible name. */
  seek: "Where in the recording",
  /** Read to a screen reader when the speaker changes. */
  speaking: (name: string) => `${name} is speaking`,
  /** The caption before the first word. */
  opening: "Hamza and Zoya are about to begin",
  /** The lab page when the episode cannot be fetched. */
  unavailable: "This discussion isn't available.",
  /** On a recording's card when its description is cut short; opens the whole of it. */
  readMore: "Read more",
} as const;
