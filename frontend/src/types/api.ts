export interface ChapterDto {
  chapterNumber: number;
  arabicName: string;
  transliteratedName: string;
  revelationType: string;
  verseCount: number;
  translatedName?: string;
}

export interface ChapterTranslationDto {
  languageCode: string;
  translatedName: string;
}

export interface ChapterDetailDto {
  chapterNumber: number;
  arabicName: string;
  transliteratedName: string;
  revelationType: string;
  verseCount: number;
  revelationOrder?: number;
  translations: ChapterTranslationDto[];
}

export interface TranslationSegmentDto {
  translationId: number;
  segmentIndex: number;
  translationText?: string;
  explanation?: string;
  /** The sources of the passages marked in `explanation`; absent for anonymous readers. */
  takhreej?: TakhreejBlockDto[] | null;
}

/** The books cited for one marked passage: `ordinal` matches its `<ins data-takhreej="n">` anchor. */
export interface TakhreejBlockDto {
  ordinal: number;
  citations: CitationDto[];
}

export interface CitationDto {
  title: string;
  author?: string | null;
  authorDeathYearHijri?: number | null;
  /** Where in the book, as printed: a page, a chapter, a hadith number. */
  reference?: string | null;
  note?: string | null;
  /** The reference's own address on the internet, when there is one. */
  url?: string | null;
}

/** One book the tafseer cites. `citations` is absent for anonymous readers, who get the counts only. */
export interface BibliographyBookDto {
  bookId: number;
  title: string;
  author?: string | null;
  authorDeathYearHijri?: number | null;
  kind?: string | null;
  citationCount: number;
  citations?: BookCitationDto[] | null;
}

/** One place a book is cited: the verse whose tafseer cites it, and what it points at. */
export interface BookCitationDto {
  chapterNumber: number;
  verseNumber: number;
  rukuId: number;
  reference?: string | null;
  note?: string | null;
  url?: string | null;
}

export interface VerseDto {
  chapterNumber: number;
  verseNumber: number;
  arabicText: string;
  juzNumber: number;
  rukuId: number;
  hasSajdah: boolean;
  translations?: TranslationSegmentDto[];
}

export interface TranslationDto {
  translationId: number;
  languageCode: string;
  scriptCode: string;
  bookName: string;
  translator: string;
  description?: string;
  bookNameInScript?: string;
  translatorInScript?: string;
  descriptionInScript?: string;
}

export interface JuzDto {
  juzNumber: number;
  arabicName: string;
  transliteratedName: string;
  startChapter?: number;
  startVerse?: number;
  endChapter?: number;
  endVerse?: number;
}

export interface RukuDto {
  rukuId: number;
  chapterNumber: number;
  juzNumber: number;
  rankInChapter: number;
  rankInJuz: number;
  verseCount: number;
}

export interface SearchResultDto {
  chapterNumber: number;
  chapterName: string;
  verseNumber: number;
  arabicText: string;
  translationText?: string;
  explanation?: string;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
