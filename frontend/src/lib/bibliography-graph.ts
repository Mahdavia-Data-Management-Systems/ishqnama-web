import { RUKU_BY_ID } from "@/data/rukus";
import { suras } from "@/data/suras";
import type { BibliographyBookDto, BookCitationDto } from "@/types/api";

/**
 * The bibliography map as plain data: which circles and lines show for the branch the reader
 * has open. Pure, so the canvas scene only draws what this returns.
 *
 * The map opens one branch at a time: a book, then a chapter that cites it, then a ruku of that
 * chapter, then an ayah of that ruku. At each level the siblings of the open circle are dimmed
 * and stay selectable. An open ayah shows every citation on it, from every book; those of other
 * books are dimmed.
 */

/** The open branch. Each level needs the ones before it. */
export interface BibliographyPath {
  bookId?: number;
  chapter?: number;
  rukuId?: number;
  verse?: number;
}

export type MapNodeKind = "book" | "chapter" | "ruku" | "verse" | "citation";

interface MapNodeBase {
  /** Stable across selections, so a circle keeps its place while the branch changes. */
  id: string;
  kind: MapNodeKind;
  radius: number;
  /** Drawn inside the circle: a count or a number. */
  inner: string;
  /** Drawn under the circle. */
  label: string;
  /** Whether `label` is Arabic script (book titles and references), for the font. */
  arabic: boolean;
  /** The reader's name for it in the list of choices, e.g. "al-Baqarah, 12 citations". */
  name: string;
  dimmed: boolean;
  /** On the open branch. */
  open: boolean;
  /** The circle it hangs from; none for a book. */
  parentId?: string;
}

export type MapNode =
  | (MapNodeBase & { kind: "book"; book: BibliographyBookDto })
  | (MapNodeBase & { kind: "chapter"; chapter: number })
  | (MapNodeBase & { kind: "ruku"; rukuId: number })
  | (MapNodeBase & { kind: "verse"; chapter: number; verse: number })
  | (MapNodeBase & { kind: "citation"; book: BibliographyBookDto; citation: BookCitationDto });

export interface MapLink {
  source: string;
  target: string;
  dimmed: boolean;
}

export interface MapGraph {
  nodes: MapNode[];
  links: MapLink[];
}

const MIN_BOOK_RADIUS = 12;
const BOOK_RADIUS_PER_ROOT = 4.2;
const CHILD_RADIUS = { chapter: 15, ruku: 13, verse: 12, citation: 8 } as const;
const LABEL_LIMIT = 28;

/** A book's circle: its area grows with its citations, so the radius grows with their square root. */
export function bookRadius(citationCount: number): number {
  return Math.max(MIN_BOOK_RADIUS, BOOK_RADIUS_PER_ROOT * Math.sqrt(Math.max(0, citationCount)));
}

export function countLabel(count: number): string {
  return count === 1 ? "1 citation" : `${count} citations`;
}

function chapterName(chapter: number): string {
  return suras[chapter - 1]?.name ?? `Chapter ${chapter}`;
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > LABEL_LIMIT ? `${clean.slice(0, LABEL_LIMIT - 1).trimEnd()}…` : clean;
}

export function verseKey(chapter: number, verse: number): string {
  return `${chapter}-${verse}`;
}

export interface VerseCitation {
  book: BibliographyBookDto;
  citation: BookCitationDto;
  /** The citation's position in its book's list, which with the book id names it. */
  index: number;
}

/** Every citation on each verse, across all books, keyed "chapter-verse". */
export function citationsByVerse(books: readonly BibliographyBookDto[]): Map<string, VerseCitation[]> {
  const byVerse = new Map<string, VerseCitation[]>();
  for (const book of books) {
    book.citations?.forEach((citation, index) => {
      const key = verseKey(citation.chapterNumber, citation.verseNumber);
      const list = byVerse.get(key);
      if (list) list.push({ book, citation, index });
      else byVerse.set(key, [{ book, citation, index }]);
    });
  }
  return byVerse;
}

function countBy<T>(items: readonly T[], key: (item: T) => number): [number, number][] {
  const counts = new Map<number, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0] - b[0]);
}

/**
 * Drops the parts of a path the books cannot show: an unknown book, a chapter the book does not
 * cite, and so on down. Keeps a stale path (after a refetch, say) from pointing at nothing.
 */
export function validPath(books: readonly BibliographyBookDto[], path: BibliographyPath): BibliographyPath {
  const book = books.find((b) => b.bookId === path.bookId);
  const citations = book?.citations;
  if (!book || !citations) return {};
  const valid: BibliographyPath = { bookId: book.bookId };

  if (path.chapter == null || !citations.some((c) => c.chapterNumber === path.chapter)) return valid;
  valid.chapter = path.chapter;

  const inChapter = citations.filter((c) => c.chapterNumber === path.chapter);
  if (path.rukuId == null || !inChapter.some((c) => c.rukuId === path.rukuId)) return valid;
  valid.rukuId = path.rukuId;

  const inRuku = inChapter.filter((c) => c.rukuId === path.rukuId);
  if (path.verse == null || !inRuku.some((c) => c.verseNumber === path.verse)) return valid;
  valid.verse = path.verse;
  return valid;
}

/** The circles and lines for the open branch. Give it a path from `validPath`. */
export function visibleGraph(
  books: readonly BibliographyBookDto[],
  path: BibliographyPath,
  byVerse: Map<string, VerseCitation[]> = citationsByVerse(books),
): MapGraph {
  const nodes: MapNode[] = [];
  const links: MapLink[] = [];
  const selected = books.find((b) => b.bookId === path.bookId);

  for (const book of books) {
    nodes.push({
      id: `book:${book.bookId}`,
      kind: "book",
      book,
      radius: bookRadius(book.citationCount),
      inner: String(book.citationCount),
      label: book.title,
      arabic: true,
      name: `${book.title}, ${countLabel(book.citationCount)}`,
      dimmed: selected != null && book !== selected,
      open: book === selected,
    });
  }

  const citations = selected?.citations;
  if (!selected || !citations) return { nodes, links };
  const bookId = `book:${selected.bookId}`;

  for (const [chapter, count] of countBy(citations, (c) => c.chapterNumber)) {
    const id = `chapter:${chapter}`;
    nodes.push({
      id,
      kind: "chapter",
      chapter,
      radius: CHILD_RADIUS.chapter,
      inner: String(chapter),
      label: chapterName(chapter),
      arabic: false,
      name: `${chapterName(chapter)}, ${countLabel(count)}`,
      // Once one is open its siblings step back, so the branch reads clearly over them.
      dimmed: path.chapter != null && chapter !== path.chapter,
      open: chapter === path.chapter,
      parentId: bookId,
    });
    links.push({ source: bookId, target: id, dimmed: path.chapter != null && chapter !== path.chapter });
  }

  if (path.chapter == null) return { nodes, links };
  const chapterId = `chapter:${path.chapter}`;
  const inChapter = citations.filter((c) => c.chapterNumber === path.chapter);

  for (const [rukuId, count] of countBy(inChapter, (c) => c.rukuId)) {
    const id = `ruku:${rukuId}`;
    const rank = RUKU_BY_ID.get(rukuId)?.rankInChapter ?? rukuId;
    nodes.push({
      id,
      kind: "ruku",
      rukuId,
      radius: CHILD_RADIUS.ruku,
      inner: String(rank),
      label: `Ruku ${rank}`,
      arabic: false,
      name: `Ruku ${rank}, ${countLabel(count)}`,
      dimmed: path.rukuId != null && rukuId !== path.rukuId,
      open: rukuId === path.rukuId,
      parentId: chapterId,
    });
    links.push({ source: chapterId, target: id, dimmed: path.rukuId != null && rukuId !== path.rukuId });
  }

  if (path.rukuId == null) return { nodes, links };
  const rukuNodeId = `ruku:${path.rukuId}`;
  const inRuku = inChapter.filter((c) => c.rukuId === path.rukuId);

  for (const [verse, count] of countBy(inRuku, (c) => c.verseNumber)) {
    const id = `verse:${verseKey(path.chapter, verse)}`;
    nodes.push({
      id,
      kind: "verse",
      chapter: path.chapter,
      verse,
      radius: CHILD_RADIUS.verse,
      inner: String(verse),
      label: `Ayah ${verse}`,
      arabic: false,
      name: `Ayah ${verse}, ${countLabel(count)}`,
      dimmed: path.verse != null && verse !== path.verse,
      open: verse === path.verse,
      parentId: rukuNodeId,
    });
    links.push({ source: rukuNodeId, target: id, dimmed: path.verse != null && verse !== path.verse });
  }

  if (path.verse == null) return { nodes, links };
  const verseNodeId = `verse:${verseKey(path.chapter, path.verse)}`;
  const onVerse = byVerse.get(verseKey(path.chapter, path.verse)) ?? [];
  // The open book's own citations first, so they lead the list of choices.
  const ordered = [...onVerse.filter((c) => c.book === selected), ...onVerse.filter((c) => c.book !== selected)];

  for (const { book, citation, index } of ordered) {
    const own = book === selected;
    const id = `citation:${book.bookId}:${index}`;
    const reference = citation.reference?.trim();
    nodes.push({
      id,
      kind: "citation",
      book,
      citation,
      radius: CHILD_RADIUS.citation,
      inner: "",
      // Another book's citation is named by its book, since the reference alone would not say whose it is.
      label: shorten(own ? reference || book.title : book.title),
      arabic: true,
      name: reference ? `${book.title}, ${reference}` : book.title,
      dimmed: !own,
      open: false,
      parentId: verseNodeId,
    });
    links.push({ source: verseNodeId, target: id, dimmed: !own });
  }

  return { nodes, links };
}

/** The circles the reader can choose from next: the children of the deepest open circle, or the books. */
export function currentChoices(graph: MapGraph, path: BibliographyPath): MapNode[] {
  const kind: MapNodeKind =
    path.verse != null ? "citation"
    : path.rukuId != null ? "verse"
    : path.chapter != null ? "ruku"
    : path.bookId != null ? "chapter"
    : "book";
  return graph.nodes.filter((n) => n.kind === kind);
}

/** The path after the reader picks a circle: opens it, or closes it when it was already open. */
export function pathAfterSelecting(path: BibliographyPath, node: MapNode): BibliographyPath {
  switch (node.kind) {
    case "book":
      return path.bookId === node.book.bookId ? {} : { bookId: node.book.bookId };
    case "chapter":
      return path.chapter === node.chapter
        ? { bookId: path.bookId }
        : { bookId: path.bookId, chapter: node.chapter };
    case "ruku":
      return path.rukuId === node.rukuId
        ? { bookId: path.bookId, chapter: path.chapter }
        : { bookId: path.bookId, chapter: path.chapter, rukuId: node.rukuId };
    case "verse":
      return path.verse === node.verse
        ? { bookId: path.bookId, chapter: path.chapter, rukuId: path.rukuId }
        : { ...path, verse: node.verse };
    case "citation":
      return path;
  }
}

export interface Crumb {
  label: string;
  /** Whether the label is Arabic script. */
  arabic: boolean;
  /** The path this crumb returns to. */
  path: BibliographyPath;
}

/** The open branch as a trail back to the books. `home` is the first crumb's label. */
export function crumbs(books: readonly BibliographyBookDto[], path: BibliographyPath, home: string): Crumb[] {
  const trail: Crumb[] = [{ label: home, arabic: false, path: {} }];
  const book = books.find((b) => b.bookId === path.bookId);
  if (!book) return trail;
  trail.push({ label: book.title, arabic: true, path: { bookId: book.bookId } });

  if (path.chapter == null) return trail;
  trail.push({
    label: chapterName(path.chapter),
    arabic: false,
    path: { bookId: book.bookId, chapter: path.chapter },
  });

  if (path.rukuId == null) return trail;
  const rank = RUKU_BY_ID.get(path.rukuId)?.rankInChapter ?? path.rukuId;
  trail.push({
    label: `Ruku ${rank}`,
    arabic: false,
    path: { bookId: book.bookId, chapter: path.chapter, rukuId: path.rukuId },
  });

  if (path.verse == null) return trail;
  trail.push({ label: `Ayah ${path.verse}`, arabic: false, path });
  return trail;
}
