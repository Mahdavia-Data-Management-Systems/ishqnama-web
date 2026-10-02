import { rukusInChapter } from "@/data/rukus";
import { suras } from "@/data/suras";
import { chapterName } from "@/lib/share-verse";
import type { FavoriteDto, VerseListGroupDto, VerseListSummaryDto } from "@/types/lists";

/** Verses a group shows on the list page before "Read more" opens the rest. */
export const GROUP_PREVIEW_VERSES = 10;

/** Same limits the API enforces in VerseListService. */
export const LIST_LIMITS = {
  title: 100,
  description: 1000,
  caption: 300,
  groups: 200,
} as const;

/** The page a list's link opens. */
export function listViewPath(id: string): string {
  return `/lists/view/?id=${encodeURIComponent(id)}`;
}

export function listEditPath(id: string): string {
  return `/lists/edit/?id=${encodeURIComponent(id)}`;
}

export function verseCountOf(chapter: number): number {
  return suras.find((s) => s.number === chapter)?.verseCount ?? 0;
}

/** True when the group is a range of verses inside its one chapter. */
export function isValidGroup(group: Pick<VerseListGroupDto, "chapter" | "fromVerse" | "toVerse">): boolean {
  const count = verseCountOf(group.chapter);
  return (
    count > 0 &&
    Number.isInteger(group.fromVerse) &&
    Number.isInteger(group.toVerse) &&
    group.fromVerse >= 1 &&
    group.fromVerse <= group.toVerse &&
    group.toVerse <= count
  );
}

/** "al-Baqarah 2:255–257", or "al-Fātiḥah 1:5" for a single verse. */
export function groupReference(group: Pick<VerseListGroupDto, "chapter" | "fromVerse" | "toVerse">): string {
  const range =
    group.fromVerse === group.toVerse ? `${group.fromVerse}` : `${group.fromVerse}–${group.toVerse}`;
  return `${chapterName(group.chapter)} ${group.chapter}:${range}`;
}

/** The reader page for the group's passage, scrolled to its first verse. */
export function groupReaderPath(group: Pick<VerseListGroupDto, "chapter" | "fromVerse">): string {
  return `/quran/${group.chapter}/?verse=${group.fromVerse}`;
}

/**
 * Whether a group's header carries ﷽. Sura at-Tawbah (9) opens without the bismillah, so a group
 * starting at its first ayah leaves it off; every other group shows it.
 */
export function showsBismillah(group: Pick<VerseListGroupDto, "chapter" | "fromVerse">): boolean {
  return !(group.chapter === 9 && group.fromVerse === 1);
}

/** Verse numbers in `chapter` that close a ruku, where the reader prints the ruku mark. */
export function rukuEndsInChapter(chapter: number): Map<number, number> {
  const ends = new Map<number, number>();
  let verse = 0;
  for (const ruku of rukusInChapter(chapter)) {
    verse += ruku.verseCount;
    ends.set(verse, ruku.rukuId);
  }
  return ends;
}

/** Up to two initials for an owner's avatar: "Noor Mahdi" → "NM". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

export interface FavoriteRow {
  favorite: FavoriteDto;
  /** Null when the list has since been unpublished or deleted. */
  summary: VerseListSummaryDto | null;
}

export interface SavedListsSections {
  mine: VerseListSummaryDto[];
  featured: VerseListSummaryDto[];
  others: FavoriteRow[];
}

/**
 * Puts each list in exactly one section of the Saved page's Lists tab. My own lists stay in My
 * collection even when featured; a featured list I have also favourited shows only under
 * Featured. `available` holds the published summaries fetched for featured and favourite ids.
 */
export function arrangeSavedLists({
  mine,
  featuredIds,
  favorites,
  available,
}: {
  mine: readonly VerseListSummaryDto[];
  featuredIds: readonly string[];
  favorites: readonly FavoriteDto[];
  available: readonly VerseListSummaryDto[];
}): SavedListsSections {
  const mineIds = new Set(mine.map((l) => l.id));
  const byId = new Map(available.map((l) => [l.id, l]));

  const featured = featuredIds
    .filter((id, i) => !mineIds.has(id) && featuredIds.indexOf(id) === i)
    .map((id) => byId.get(id))
    .filter((l): l is VerseListSummaryDto => l != null);
  const featuredShown = new Set(featured.map((l) => l.id));

  const others = favorites
    .filter((f) => f.kind === "list" && f.listId != null)
    .filter((f) => !mineIds.has(f.listId!) && !featuredShown.has(f.listId!))
    .map((favorite) => ({ favorite, summary: byId.get(favorite.listId!) ?? null }));

  return { mine: [...mine], featured, others };
}

/** The ids whose published summaries the Lists tab needs: featured first, then favourites. */
export function idsToFetch(featuredIds: readonly string[], favorites: readonly FavoriteDto[]): string[] {
  const ids = [...featuredIds, ...favorites.map((f) => f.listId).filter((id): id is string => id != null)];
  return [...new Set(ids)];
}
