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
