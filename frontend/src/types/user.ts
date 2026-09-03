export interface UserSettingsDto {
  mode: string;
  lang: string;
  fontScale: number;
  showTafseer: boolean;
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
  chapterNumber: number;
  timestamp: string;
}
