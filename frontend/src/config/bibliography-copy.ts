/**
 * Every reader-facing string of the bibliography page, under the readiness-copy rules: sentence
 * case, under twelve words, and no technical words (`__tests__/bibliography-copy.test.ts`).
 */
export const BIBLIOGRAPHY_COPY = {
  title: "Bibliography",
  intro: "The books cited in the takhreej of Noor e Imaan",
  hint: "Choose an era to see its authors and their books",
  allEras: "All eras",
  eraEarly: "Early Works",
  eraEarlyYears: "Before 400 hijri",
  eraMiddle: "Middle Classical",
  eraMiddleYears: "401 to 600 hijri",
  eraLate: "Late Pre-Mahdavia",
  eraLateYears: "601 to 910 hijri",
  eraPresent: "Mahdavia",
  eraPresentYears: "911 hijri to present",
  eraUndated: "Year not recorded",
  trail: "Where you are",
  map: "Books by era and author, and where they are cited",
  showAll: "Show everything",
  opening: "Opening the bibliography",
  failed: "Couldn't open the bibliography yet",
  otherBook: "From another book",
  openAyah: "Open this ayah",
} as const;
