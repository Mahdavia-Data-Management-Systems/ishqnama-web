import { shareVerse, type ShareOutcome } from "@/lib/share-verse";
import { listViewPath } from "@/lib/verse-lists";
import type { VerseListDto } from "@/types/lists";

/** The message a shared list travels with: its title, then its description on a line of its own. */
export function buildListShareText(list: Pick<VerseListDto, "title" | "description">): string {
  return list.description ? `${list.title}\n${list.description}` : list.title;
}

/** Shares a published list's link through the system share sheet, or copies it. */
export function shareList(
  origin: string,
  list: Pick<VerseListDto, "id" | "title" | "description">,
): Promise<ShareOutcome> {
  return shareVerse({
    title: list.title,
    text: buildListShareText(list),
    url: `${origin}${listViewPath(list.id)}`,
  });
}
