/**
 * Every reader-facing string of the bibliography page, under the readiness-copy rules: sentence
 * case, under twelve words, and no technical words (`__tests__/bibliography-copy.test.ts`).
 */
export const BIBLIOGRAPHY_COPY = {
  title: "Bibliography",
  intro: "The books cited in the takhreej of Noor e Imaan",
  hint: "Choose a book to see where it is cited",
  allBooks: "All books",
  trail: "Where you are",
  choices: "Choose from here",
  map: "Map of the books and where they are cited",
  showAll: "Show everything",
  opening: "Opening the bibliography",
  failed: "Couldn't open the bibliography yet",
  otherBook: "From another book",
  openAyah: "Open this ayah",
} as const;
