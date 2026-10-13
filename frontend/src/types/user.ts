export interface UserSettingsDto {
  mode: string;
  lang: string;
  fontScale: number;
  showTafseer: boolean;
  /** Ruku rails under chapter cards in the Quran index. */
  showSuraRukuMarks: boolean;
  /** Ruku rails under juz cards in the Quran index. */
  showJuzRukuMarks: boolean;
  /** Id of the recitation Play uses; see `RECITATIONS` in config/recitation.ts. */
  reciter: string;
  /** Whether a recitation runs on past the verse Play was pressed on. */
  continueRecitation: boolean;
  /** The recording's pace multiplied; one of `RECITATION_SPEEDS` in config/recitation.ts. */
  recitationSpeed: number;
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
