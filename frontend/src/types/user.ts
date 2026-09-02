export interface UserSettingsDto {
  mode: string;
  lang: string;
  fontScale: number;
  showTafseer: boolean;
}

export interface UserBookmarkDto {
  chapterNumber: number;
  verseNumber: number;
  createdAt: string;
}

export interface UserFavoriteDto {
  chapterNumber: number;
  verseNumber: number;
  createdAt: string;
}

export interface UserHistoryDto {
  chapterNumber: number;
  timestamp: string;
}
