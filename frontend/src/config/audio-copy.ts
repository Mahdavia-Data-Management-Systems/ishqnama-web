/**
 * Every user-facing string of the recording dock and playable links.
 *
 * Readers are often unfamiliar with technology, so nothing here says "service", "API",
 * "server", "player", "embed" or "iframe": what the reader hears is a "recording". Each string
 * is sentence case and under twelve words. `src/config/__tests__/audio-copy.test.ts` enforces
 * these rules.
 */
export const AUDIO_COPY = {
  /** Accessible name of the dock, so a screen reader can jump to it. */
  regionLabel: "Recording",
  /** The close button's accessible name. */
  closeRecording: "Close recording",
  /** Shown in the dock when Spotify could not be reached. */
  couldNotStart: "This recording couldn't start.",
  /** The link offered under the failure line. */
  openInSpotify: "Open it in Spotify",
  /** Accessible names for a playable link's two states. */
  play: "Play",
  pause: "Pause",
} as const;
