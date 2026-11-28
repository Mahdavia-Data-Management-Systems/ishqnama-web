import { describe, expect, it } from "vitest";
import {
  citationsByVerse,
  crumbs,
  eraOf,
  pathAfterSelecting,
  validPath,
  visibleTree,
  type BibliographyPath,
  type MapNode,
} from "@/lib/bibliography-graph";
import type { BibliographyBookDto, BookCitationDto } from "@/types/api";

// al-Baqarah's rukus: id 2 is its first (verses 1-7), id 37 its 36th.
const cite = (chapterNumber: number, verseNumber: number, rukuId: number, reference?: string): BookCitationDto => ({
  chapterNumber,
  verseNumber,
  rukuId,
  reference,
});

const tabari: BibliographyBookDto = {
  bookId: 1,
  title: "جامع البيان",
  author: "الطبري",
  authorDeathYearHijri: 410,
  citationCount: 4,
  citations: [cite(2, 3, 2, "ج ١ ص ٢"), cite(2, 3, 2, "ج ١ ص ٥"), cite(2, 255, 37, "ج ٣"), cite(3, 7, 42)],
};
const tarikh: BibliographyBookDto = {
  bookId: 5,
  title: "تاريخ الرسل والملوك",
  author: "الطبري",
  authorDeathYearHijri: 410,
  citationCount: 1,
  citations: [cite(3, 7, 42)],
};
const qurtubi: BibliographyBookDto = {
  bookId: 2,
  title: "الجامع لأحكام القرآن",
  author: "القرطبي",
  authorDeathYearHijri: 671,
  citationCount: 1,
  citations: [cite(2, 3, 2, "ج ١ ص ١٦٢")],
};
// No author: it sits among its era's authors.
const ibnAbiHatim: BibliographyBookDto = {
  bookId: 3,
  title: "تفسير ابن أبي حاتم",
  authorDeathYearHijri: 427,
  citationCount: 1,
  citations: [cite(2, 255, 37)],
};
// A Mahdavi book with no year belongs after 910.
const insafNama: BibliographyBookDto = {
  bookId: 4,
  title: "انصاف نامہ",
  kind: "mahdavi",
  citationCount: 1,
  citations: [cite(2, 3, 2)],
};
const books = [tabari, tarikh, qurtubi, ibnAbiHatim, insafNama];

const TABARI = { era: "401-600", author: "الطبري" } as const;
const IN_TABARI: BibliographyPath = { ...TABARI, bookId: 1 };

/** Every node showing, in reading order. */
function flat(nodes: readonly MapNode[]): MapNode[] {
  return nodes.flatMap((n) => [n, ...flat(n.children)]);
}
const shown = (path: BibliographyPath, list = books) => flat(visibleTree(list, path));
const ids = (kind: string, path: BibliographyPath) =>
  shown(path)
    .filter((n) => n.kind === kind)
    .map((n) => n.id);
const node = (path: BibliographyPath, id: string) => shown(path).find((n) => n.id === id)!;

describe("eraOf", () => {
  const dying = (authorDeathYearHijri?: number, kind?: string) =>
    eraOf({ bookId: 9, title: "x", citationCount: 0, authorDeathYearHijri, kind });

  it("places a book by its author's death year, each boundary on the earlier side", () => {
    expect([dying(228), dying(400)]).toEqual(["0-400", "0-400"]);
    expect([dying(401), dying(600)]).toEqual(["401-600", "401-600"]);
    expect([dying(601), dying(910)]).toEqual(["601-910", "601-910"]);
    expect([dying(911), dying(1143)]).toEqual(["911-present", "911-present"]);
  });

  it("places an undated Mahdavi book after 910", () => {
    expect(dying(undefined, "mahdavi")).toBe("911-present");
  });

  it("keeps any other undated book apart", () => {
    expect(dying()).toBe("undated");
  });
});

describe("visibleTree", () => {
  it("shows the four eras at home, none dimmed or open", () => {
    const eras = visibleTree(books, {});
    expect(eras.map((n) => n.id)).toEqual(["era:0-400", "era:401-600", "era:601-910", "era:911-present"]);
    expect(eras.every((n) => !n.dimmed && !n.open && n.children.length === 0)).toBe(true);
    expect(eras.map((n) => n.label)).toEqual(["Early Works", "Middle Classical", "Late Pre-Mahdavia", "Mahdavia"]);
    expect(eras.map((n) => n.detail)).toEqual([
      "Before 400 hijri · 0 books",
      "401 to 600 hijri · 3 books",
      "601 to 910 hijri · 1 book",
      "911 hijri to present · 1 book",
    ]);
    expect(eras[1].name).toBe("Middle Classical, 401 to 600 hijri, 3 books");
  });

  it("adds an undated era only when a book needs it", () => {
    const stray: BibliographyBookDto = { bookId: 8, title: "x", citationCount: 0 };
    expect(visibleTree([...books, stray], {}).at(-1)?.id).toBe("era:undated");
  });

  it("opens an era into its authors, an authorless book among them, by year", () => {
    const eras = visibleTree(books, { era: "401-600" });
    const era = eras.find((n) => n.open)!;
    expect(era.children.map((n) => [n.id, n.kind])).toEqual([
      ["author:401-600:الطبري", "author"],
      ["book:3", "book"],
    ]);
    expect(era.children[0].detail).toBe("٤١٠ه‍");
    expect(eras.filter((n) => n !== era).every((n) => n.dimmed)).toBe(true);
  });

  it("opens an author into their books", () => {
    expect(ids("book", TABARI)).toEqual(["book:1", "book:5", "book:3"]);
    expect(node(TABARI, "author:401-600:الطبري").children.map((n) => n.id)).toEqual(["book:1", "book:5"]);
    expect(node(TABARI, "book:3").dimmed).toBe(true);
  });

  it("marks a Mahdavi book", () => {
    const book = node({ era: "911-present" }, "book:4");
    expect(book.kind === "book" && book.mahdavi).toBe(true);
  });

  it("opens a book into the chapters that cite it and dims its siblings", () => {
    expect(node(IN_TABARI, "book:1").children.map((n) => n.id)).toEqual(["chapter:2", "chapter:3"]);
    expect(node(IN_TABARI, "book:1")).toMatchObject({ open: true, dimmed: false });
    expect(node(IN_TABARI, "book:5")).toMatchObject({ open: false, dimmed: true });
  });

  it("opens an authorless book straight from the era", () => {
    const path = { era: "401-600", bookId: 3 } as const;
    expect(node(path, "book:3").children.map((n) => n.id)).toEqual(["chapter:2"]);
  });

  it("opens a chapter into its rukus, by their rank in the chapter", () => {
    const chapter = node({ ...IN_TABARI, chapter: 2 }, "chapter:2");
    expect(chapter.children.map((n) => [n.id, n.label])).toEqual([
      ["ruku:2", "Ruku 1"],
      ["ruku:37", "Ruku 36"],
    ]);
  });

  it("dims the siblings of an open chapter and an open ruku", () => {
    const path = { ...IN_TABARI, chapter: 2, rukuId: 2 };
    const dimmed = (id: string) => node(path, id).dimmed;
    expect([dimmed("chapter:2"), dimmed("chapter:3")]).toEqual([false, true]);
    expect([dimmed("ruku:2"), dimmed("ruku:37")]).toEqual([false, true]);
  });

  it("opens a ruku into its ayaat, each once", () => {
    expect(ids("verse", { ...IN_TABARI, chapter: 2, rukuId: 2 })).toEqual(["verse:2-3"]);
  });

  it("opens an ayah into every book's citations, dimming those of other books", () => {
    const citations = node({ ...IN_TABARI, chapter: 2, rukuId: 2, verse: 3 }, "verse:2-3").children;
    expect(citations.map((n) => [n.id, n.dimmed])).toEqual([
      ["citation:1:0", false],
      ["citation:1:1", false],
      ["citation:2:0", true],
      ["citation:4:0", true],
    ]);
    // Its own are named by their reference, another book's by the book.
    expect(citations.map((n) => n.label)).toEqual(["ج ١ ص ٢", "ج ١ ص ٥", "الجامع لأحكام القرآن", "انصاف نامہ"]);
  });

  it("shows eras, authors and books but no further when the citations did not come", () => {
    const anonymous = books.map((b) => ({ ...b, citations: null }));
    expect(shown(validPath(anonymous, IN_TABARI), anonymous).some((n) => n.kind === "chapter")).toBe(false);
    expect(shown(TABARI, anonymous).filter((n) => n.kind === "book")).toHaveLength(3);
  });
});

describe("citationsByVerse", () => {
  it("gathers a verse's citations across books", () => {
    expect(citationsByVerse(books).get("2-3")?.map((c) => c.book.bookId)).toEqual([1, 1, 2, 4]);
  });
});

describe("validPath", () => {
  it("keeps a path the books can show", () => {
    const path = { ...IN_TABARI, chapter: 2, rukuId: 2, verse: 3 };
    expect(validPath(books, path)).toEqual(path);
    expect(validPath(books, { era: "401-600", bookId: 3, chapter: 2 })).toEqual({
      era: "401-600",
      bookId: 3,
      chapter: 2,
    });
  });

  it("cuts the path where it stops matching", () => {
    expect(validPath(books, { bookId: 1 })).toEqual({});
    expect(validPath(books, { era: "0-400", author: "الطبري" })).toEqual({});
    expect(validPath(books, { era: "601-910", author: "الطبري" })).toEqual({ era: "601-910" });
    expect(validPath(books, { ...TABARI, bookId: 2 })).toEqual(TABARI);
    expect(validPath(books, { ...IN_TABARI, chapter: 9, rukuId: 42 })).toEqual(IN_TABARI);
    expect(validPath(books, { ...IN_TABARI, chapter: 2, rukuId: 37, verse: 3 })).toEqual({
      ...IN_TABARI,
      chapter: 2,
      rukuId: 37,
    });
  });

  it("stops at the author when the citations did not come", () => {
    expect(validPath([{ ...tabari, citations: null }], IN_TABARI)).toEqual(TABARI);
  });
});

describe("pathAfterSelecting", () => {
  it("opens an era, an author and a book, and closes each when picked again", () => {
    expect(pathAfterSelecting({}, node({}, "era:401-600"))).toEqual({ era: "401-600" });
    expect(pathAfterSelecting({ era: "401-600" }, node({ era: "401-600" }, "era:401-600"))).toEqual({});
    expect(pathAfterSelecting({ era: "401-600" }, node({ era: "401-600" }, "author:401-600:الطبري"))).toEqual(TABARI);
    expect(pathAfterSelecting(TABARI, node(TABARI, "author:401-600:الطبري"))).toEqual({ era: "401-600" });
    expect(pathAfterSelecting(TABARI, node(TABARI, "book:1"))).toEqual(IN_TABARI);
    expect(pathAfterSelecting(IN_TABARI, node(IN_TABARI, "book:1"))).toEqual(TABARI);
  });

  it("opens an authorless book under its era alone", () => {
    expect(pathAfterSelecting(IN_TABARI, node(IN_TABARI, "book:3"))).toEqual({ era: "401-600", bookId: 3 });
  });

  it("swaps to a sibling and drops what was open under the old one", () => {
    const path = { ...IN_TABARI, chapter: 2, rukuId: 2, verse: 3 };
    expect(pathAfterSelecting(path, node(path, "chapter:3"))).toEqual({ ...IN_TABARI, chapter: 3 });
    expect(pathAfterSelecting(path, node(path, "book:5"))).toEqual({ ...TABARI, bookId: 5 });
    expect(pathAfterSelecting(path, node(path, "era:601-910"))).toEqual({ era: "601-910" });
  });

  it("leaves the path alone for a citation", () => {
    const path = { ...IN_TABARI, chapter: 2, rukuId: 2, verse: 3 };
    expect(pathAfterSelecting(path, node(path, "citation:2:0"))).toBe(path);
  });
});

describe("crumbs", () => {
  it("trails back through the author and the era", () => {
    const trail = crumbs(books, { ...IN_TABARI, chapter: 2, rukuId: 37 }, "All eras");
    expect(trail.map((c) => c.label)).toEqual([
      "All eras",
      "Middle Classical",
      "الطبري",
      "جامع البيان",
      "al-Baqarah",
      "Ruku 36",
    ]);
    expect(trail[4].path).toEqual({ ...IN_TABARI, chapter: 2 });
  });

  it("skips the author for a book that has none", () => {
    const trail = crumbs(books, { era: "401-600", bookId: 3 }, "All eras");
    expect(trail.map((c) => c.label)).toEqual(["All eras", "Middle Classical", "تفسير ابن أبي حاتم"]);
  });
});
