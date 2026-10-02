export type VerseListStatus = "draft" | "published";

/** A run of verses within one chapter. `id` is null for a group the server has not seen yet. */
export interface VerseListGroupDto {
  id: string | null;
  chapter: number;
  fromVerse: number;
  toVerse: number;
  caption: string | null;
}

export interface VerseListDto {
  id: string;
  title: string;
  description: string | null;
  ownerName: string;
  status: VerseListStatus;
  /** True when the signed-in reader made this list. */
  isMine: boolean;
  groups: VerseListGroupDto[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface VerseListSummaryDto {
  id: string;
  title: string;
  description: string | null;
  ownerName: string;
  status: VerseListStatus;
  groupCount: number;
  updatedAt: string;
}

/** Only lists can be favourited today; chapters, rukus and verse ranges will follow. */
export type FavoriteKind = "list";

export interface FavoriteDto {
  id: string;
  kind: FavoriteKind;
  listId: string | null;
  title: string;
  createdAt: string;
}

export interface ArabicVerseDto {
  verseNumber: number;
  arabicText: string;
  hasSajdah: boolean;
}
