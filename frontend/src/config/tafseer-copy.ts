/**
 * Every reader-facing string of the tafseer's takhreej: the books that support a passage.
 * Readers are often unfamiliar with technology, so nothing here names how the page is built;
 * the list of books is simply the "takhreej". Sentence case, under twelve words.
 * `src/config/__tests__/tafseer-copy.test.ts` enforces these rules.
 */
export const TAFSEER_COPY = {
  /** Heading of the sheet that lists a passage's books. */
  takhreej: "Takhreej",
  /** Accessible name of the open-book button at the end of a passage. */
  showTakhreej: "Show takhreej",
  /** Accessible name of the passage quoted at the top of the sheet. */
  passage: "About this passage",
} as const;
