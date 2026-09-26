export interface UserSettingsDto {
  mode: string;
  lang: string;
  fontScale: number;
  showTafseer: boolean;
  /** Ruku rails under chapter cards in the Quran index. */
  showSuraRukuMarks: boolean;
  /** Ruku rails under juz cards in the Quran index. */
  showJuzRukuMarks: boolean;
}

export interface UserBookmarkDto {
  slug: string;
  title: string;
  icon: string;
  chapterNumber: number;
  verseNumber: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserHistoryDto {
  title: string;
  url: string;
  timestamp: string;
}
