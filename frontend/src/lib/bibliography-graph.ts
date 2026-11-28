import { BIBLIOGRAPHY_COPY } from "@/config/bibliography-copy";
import { RUKU_BY_ID } from "@/data/rukus";
import { suras } from "@/data/suras";
import { year } from "@/lib/tafseer-takhreej";
import type { BibliographyBookDto, BookCitationDto } from "@/types/api";

/**
 * The bibliography map as plain data: the tree that shows for the branch the reader has open.
 * Pure, so the map only measures, places and draws what this returns.
 *
 * The map opens one branch at a time: an era, then an author who died in it, then one of their
 * books, then a chapter that cites it, then a ruku of that chapter, then an ayah of that ruku.
 * At each level the siblings of the open one are dimmed and stay selectable. An open ayah shows
 * every citation on it, from every book; those of other books are dimmed.
 */

/** A span of hijri years a book falls in by its author's death; "undated" when nothing places it. */
export type EraId = "0-400" | "401-600" | "601-910" | "911-present" | "undated";

/**
 * The eras in order, each with the last year it holds, its name and its years in words. The
 * last one is open-ended.
 */
const ERAS: readonly { id: EraId; to: number; label: string; years: string }[] = [
  { id: "0-400", to: 400, label: BIBLIOGRAPHY_COPY.eraEarly, years: BIBLIOGRAPHY_COPY.eraEarlyYears },
  { id: "401-600", to: 600, label: BIBLIOGRAPHY_COPY.eraMiddle, years: BIBLIOGRAPHY_COPY.eraMiddleYears },
  { id: "601-910", to: 910, label: BIBLIOGRAPHY_COPY.eraLate, years: BIBLIOGRAPHY_COPY.eraLateYears },
  { id: "911-present", to: Infinity, label: BIBLIOGRAPHY_COPY.eraPresent, years: BIBLIOGRAPHY_COPY.eraPresentYears },
];
const UNDATED = { id: "undated", label: BIBLIOGRAPHY_COPY.eraUndated, years: "" } as const;

/** The open branch. Each level needs the ones before it, except that a book may have no author. */
export interface BibliographyPath {
  era?: EraId;
  author?: string;
  bookId?: number;
  chapter?: number;
  rukuId?: number;
  verse?: number;
}

export type MapNodeKind = "era" | "author" | "book" | "chapter" | "ruku" | "verse" | "citation";

interface MapNodeBase {
  /** Stable across selections, so a shape keeps its identity while the branch changes. */
  id: string;
  kind: MapNodeKind;
  label: string;
  /** A smaller second line: a count, an author's year, or an era's years and count. Empty when there is none. */
  detail: string;
  /** Whether `label` is Arabic script (authors, book titles and references), for the font. */
  arabic: boolean;
  /** The whole of it for a screen reader, e.g. "al-Baqarah, 12 citations". */
  name: string;
  dimmed: boolean;
  /** On the open branch. */
  open: boolean;
  /** What it opens into; empty unless it is open. */
  children: MapNode[];
}

export type MapNode =
  | (MapNodeBase & { kind: "era"; era: EraId })
  | (MapNodeBase & { kind: "author"; era: EraId; author: string })
  | (MapNodeBase & { kind: "book"; era: EraId; book: BibliographyBookDto; mahdavi: boolean })
  | (MapNodeBase & { kind: "chapter"; chapter: number })
  | (MapNodeBase & { kind: "ruku"; rukuId: number })
  | (MapNodeBase & { kind: "verse"; chapter: number; verse: number })
  | (MapNodeBase & { kind: "citation"; book: BibliographyBookDto; citation: BookCitationDto });

const LABEL_LIMIT = 28;

/**
 * The era a book belongs to: by its author's death year, or after 910 for a Mahdavi book with
 * no year, since Hazrat Imam Mahdi ahs departed in 910 hijri and every Mahdavi book was written
 * after.
 */
export function eraOf(book: BibliographyBookDto): EraId {
  const died = book.authorDeathYearHijri;
  if (died != null) return ERAS.find((era) => died <= era.to)!.id;
  return book.kind === "mahdavi" ? "911-present" : "undated";
}

export function countLabel(count: number): string {
  return count === 1 ? "1 citation" : `${count} citations`;
}

function booksLabel(count: number): string {
  return count === 1 ? "1 book" : `${count} books`;
}

function eraLabel(era: EraId): string {
  return ERAS.find((e) => e.id === era)?.label ?? UNDATED.label;
}

function chapterName(chapter: number): string {
  return suras[chapter - 1]?.name ?? `Chapter ${chapter}`;
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > LABEL_LIMIT ? `${clean.slice(0, LABEL_LIMIT - 1).trimEnd()}…` : clean;
}

/** A book's author, or none when the name is missing or blank. */
function authorOf(book: BibliographyBookDto): string | undefined {
  return book.author?.trim() || undefined;
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
 * Drops the parts of a path the books cannot show: an era with no such author, a book that is
 * not that author's, a chapter the book does not cite, and so on down. Keeps a stale path (after
 * a refetch, say) from pointing at nothing. A book whose citations did not come cannot be open.
 */
export function validPath(books: readonly BibliographyBookDto[], path: BibliographyPath): BibliographyPath {
  if (path.era == null) return {};
  const inEra = books.filter((b) => eraOf(b) === path.era);
  if (inEra.length === 0) return {};
  const valid: BibliographyPath = { era: path.era };

  if (path.author != null) {
    if (!inEra.some((b) => authorOf(b) === path.author)) return valid;
    valid.author = path.author;
  }

  const book = inEra.find((b) => b.bookId === path.bookId && authorOf(b) === valid.author);
  const citations = book?.citations;
  if (!book || !citations) return valid;
  valid.bookId = book.bookId;

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

/** What an open book shows: the chapters that cite it, and under the open one its rukus, and so on. */
function chapterNodes(
  selected: BibliographyBookDto,
  path: BibliographyPath,
  byVerse: Map<string, VerseCitation[]>,
): MapNode[] {
  const citations = selected.citations ?? [];

  return countBy(citations, (c) => c.chapterNumber).map(([chapter, count]): MapNode => {
    const open = chapter === path.chapter;
    const inChapter = citations.filter((c) => c.chapterNumber === chapter);

    const rukus = countBy(inChapter, (c) => c.rukuId).map(([rukuId, rukuCount]): MapNode => {
      const rukuOpen = rukuId === path.rukuId;
      const rank = RUKU_BY_ID.get(rukuId)?.rankInChapter ?? rukuId;
      const inRuku = inChapter.filter((c) => c.rukuId === rukuId);

      const verses = countBy(inRuku, (c) => c.verseNumber).map(([verse, verseCount]): MapNode => {
        const verseOpen = verse === path.verse;
        const onVerse = byVerse.get(verseKey(chapter, verse)) ?? [];
        // The open book's own citations first, so they lead the group.
        const ordered = [...onVerse.filter((c) => c.book === selected), ...onVerse.filter((c) => c.book !== selected)];

        return {
          id: `verse:${verseKey(chapter, verse)}`,
          kind: "verse",
          chapter,
          verse,
          label: `Ayah ${verse}`,
          detail: countLabel(verseCount),
          arabic: false,
          name: `Ayah ${verse}, ${countLabel(verseCount)}`,
          dimmed: path.verse != null && !verseOpen,
          open: verseOpen,
          children: !verseOpen ? [] : ordered.map(({ book, citation, index }): MapNode => {
            const own = book === selected;
            const reference = citation.reference?.trim();
            return {
              id: `citation:${book.bookId}:${index}`,
              kind: "citation",
              book,
              citation,
              // Another book's citation is named by its book, since the reference alone would not say whose it is.
              label: shorten(own ? reference || book.title : book.title),
              detail: "",
              arabic: true,
              name: reference ? `${book.title}, ${reference}` : book.title,
              dimmed: !own,
              open: false,
              children: [],
            };
          }),
        };
      });

      return {
        id: `ruku:${rukuId}`,
        kind: "ruku",
        rukuId,
        label: `Ruku ${rank}`,
        detail: countLabel(rukuCount),
        arabic: false,
        name: `Ruku ${rank}, ${countLabel(rukuCount)}`,
        dimmed: path.rukuId != null && !rukuOpen,
        open: rukuOpen,
        children: rukuOpen ? verses : [],
      };
    });

    return {
      id: `chapter:${chapter}`,
      kind: "chapter",
      chapter,
      label: chapterName(chapter),
      detail: countLabel(count),
      arabic: false,
      name: `${chapterName(chapter)}, ${countLabel(count)}`,
      // Once one is open its siblings step back, so the branch reads clearly over them.
      dimmed: path.chapter != null && !open,
      open,
      children: open ? rukus : [],
    };
  });
}

/**
 * The eras, and under the open one its branch. Give it a path from `validPath`. An era with no
 * books still shows, so the four spans are always there; the undated one only when a book needs it.
 */
export function visibleTree(
  books: readonly BibliographyBookDto[],
  path: BibliographyPath,
  byVerse: Map<string, VerseCitation[]> = citationsByVerse(books),
): MapNode[] {
  const bookNode = (book: BibliographyBookDto, era: EraId, anyOpen: boolean): MapNode => {
    const open = book.bookId === path.bookId;
    return {
      id: `book:${book.bookId}`,
      kind: "book",
      era,
      book,
      mahdavi: book.kind === "mahdavi",
      label: book.title,
      detail: countLabel(book.citationCount),
      arabic: true,
      name: `${book.title}, ${countLabel(book.citationCount)}`,
      dimmed: anyOpen && !open,
      open,
      children: open ? chapterNodes(book, path, byVerse) : [],
    };
  };

  /** An era's authors, and the books with no author among them, oldest first. */
  const authorLevel = (era: EraId, inEra: BibliographyBookDto[]): MapNode[] => {
    const groups = new Map<string, BibliographyBookDto[]>();
    const entries: { died: number; name: string; books: BibliographyBookDto[]; author?: string }[] = [];
    for (const book of inEra) {
      const author = authorOf(book);
      const died = book.authorDeathYearHijri ?? Infinity;
      if (author == null) {
        entries.push({ died, name: book.title, books: [book] });
      } else if (groups.has(author)) {
        groups.get(author)!.push(book);
      } else {
        const list = [book];
        groups.set(author, list);
        entries.push({ died, name: author, books: list, author });
      }
    }
    entries.sort((a, b) => a.died - b.died || a.name.localeCompare(b.name, "ar"));

    // Either an author or an authorless book is open at this level, never both.
    const anyOpen = path.author != null || path.bookId != null;
    return entries.map(({ died, books: theirs, author }): MapNode => {
      if (author == null) return bookNode(theirs[0], era, anyOpen);
      const open = author === path.author;
      return {
        id: `author:${era}:${author}`,
        kind: "author",
        era,
        author,
        label: author,
        detail: Number.isFinite(died) ? year(died) : "",
        arabic: true,
        name: `${author}, ${booksLabel(theirs.length)}`,
        dimmed: anyOpen && !open,
        open,
        children: open ? theirs.map((book) => bookNode(book, era, path.bookId != null)) : [],
      };
    });
  };

  const byEra = new Map<EraId, BibliographyBookDto[]>();
  for (const book of books) {
    const era = eraOf(book);
    const list = byEra.get(era);
    if (list) list.push(book);
    else byEra.set(era, [book]);
  }

  const shown = byEra.has("undated") ? [...ERAS, UNDATED] : ERAS;
  return shown.map(({ id, label, years }): MapNode => {
    const inEra = byEra.get(id) ?? [];
    const open = id === path.era;
    // Under the name: the era's years, then how many books it holds.
    const facts = [years, booksLabel(inEra.length)].filter(Boolean);
    return {
      id: `era:${id}`,
      kind: "era",
      era: id,
      label,
      detail: facts.join(" · "),
      arabic: false,
      name: [label, ...facts].join(", "),
      dimmed: path.era != null && !open,
      open,
      children: open ? authorLevel(id, inEra) : [],
    };
  });
}

/** The path after the reader picks a shape: opens it, or closes it when it was already open. */
export function pathAfterSelecting(path: BibliographyPath, node: MapNode): BibliographyPath {
  switch (node.kind) {
    case "era":
      return path.era === node.era ? {} : { era: node.era };
    case "author":
      return path.era === node.era && path.author === node.author
        ? { era: node.era }
        : { era: node.era, author: node.author };
    case "book": {
      const author = authorOf(node.book);
      const above: BibliographyPath = author == null ? { era: node.era } : { era: node.era, author };
      return path.bookId === node.book.bookId ? above : { ...above, bookId: node.book.bookId };
    }
    case "chapter": {
      const { chapter: _chapter, rukuId: _rukuId, verse: _verse, ...book } = path;
      return path.chapter === node.chapter ? book : { ...book, chapter: node.chapter };
    }
    case "ruku": {
      const { rukuId: _rukuId, verse: _verse, ...chapter } = path;
      return path.rukuId === node.rukuId ? chapter : { ...chapter, rukuId: node.rukuId };
    }
    case "verse": {
      const { verse: _verse, ...ruku } = path;
      return path.verse === node.verse ? ruku : { ...ruku, verse: node.verse };
    }
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

/** The open branch as a trail back to the eras. `home` is the first crumb's label. */
export function crumbs(books: readonly BibliographyBookDto[], path: BibliographyPath, home: string): Crumb[] {
  const trail: Crumb[] = [{ label: home, arabic: false, path: {} }];
  if (path.era == null) return trail;
  let here: BibliographyPath = { era: path.era };
  trail.push({ label: eraLabel(path.era), arabic: false, path: here });

  if (path.author != null) {
    here = { ...here, author: path.author };
    trail.push({ label: path.author, arabic: true, path: here });
  }

  const book = books.find((b) => b.bookId === path.bookId);
  if (!book) return trail;
  here = { ...here, bookId: book.bookId };
  trail.push({ label: book.title, arabic: true, path: here });

  if (path.chapter == null) return trail;
  here = { ...here, chapter: path.chapter };
  trail.push({ label: chapterName(path.chapter), arabic: false, path: here });

  if (path.rukuId == null) return trail;
  const rank = RUKU_BY_ID.get(path.rukuId)?.rankInChapter ?? path.rukuId;
  here = { ...here, rukuId: path.rukuId };
  trail.push({ label: `Ruku ${rank}`, arabic: false, path: here });

  if (path.verse == null) return trail;
  trail.push({ label: `Ayah ${path.verse}`, arabic: false, path });
  return trail;
}
