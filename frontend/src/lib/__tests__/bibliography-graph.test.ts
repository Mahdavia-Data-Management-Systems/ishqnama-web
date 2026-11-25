import { describe, expect, it } from "vitest";
import {
  bookRadius,
  citationsByVerse,
  crumbs,
  currentChoices,
  pathAfterSelecting,
  validPath,
  visibleGraph,
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
  citationCount: 4,
  citations: [cite(2, 3, 2, "ج ١ ص ٢"), cite(2, 3, 2, "ج ١ ص ٥"), cite(2, 255, 37, "ج ٣"), cite(3, 7, 42)],
};
const qurtubi: BibliographyBookDto = {
  bookId: 2,
  title: "الجامع لأحكام القرآن",
  citationCount: 1,
  citations: [cite(2, 3, 2, "ج ١ ص ١٦٢")],
};
const books = [tabari, qurtubi];

const ids = (kind: string, path: Parameters<typeof visibleGraph>[1]) =>
  visibleGraph(books, path)
    .nodes.filter((n) => n.kind === kind)
    .map((n) => n.id);

describe("bookRadius", () => {
  it("grows with the square root of the count, so area follows the citations", () => {
    expect(bookRadius(400) / bookRadius(100)).toBeCloseTo(2);
  });

  it("never falls under the smallest circle", () => {
    expect(bookRadius(1)).toBe(bookRadius(0));
    expect(bookRadius(1)).toBeGreaterThanOrEqual(12);
  });
});

describe("visibleGraph", () => {
  it("shows only the books at home, none dimmed", () => {
    const graph = visibleGraph(books, {});
    expect(graph.nodes.map((n) => n.id)).toEqual(["book:1", "book:2"]);
    expect(graph.links).toEqual([]);
    expect(graph.nodes.every((n) => !n.dimmed && !n.open)).toBe(true);
  });

  it("opens a book into the chapters that cite it and dims the other books", () => {
    const graph = visibleGraph(books, { bookId: 1 });
    expect(ids("chapter", { bookId: 1 })).toEqual(["chapter:2", "chapter:3"]);
    expect(graph.links).toEqual([
      { source: "book:1", target: "chapter:2", dimmed: false },
      { source: "book:1", target: "chapter:3", dimmed: false },
    ]);
    expect(graph.nodes.find((n) => n.id === "book:1")).toMatchObject({ open: true, dimmed: false });
    expect(graph.nodes.find((n) => n.id === "book:2")).toMatchObject({ open: false, dimmed: true });
  });

  it("opens a chapter into its rukus, by their rank in the chapter", () => {
    const graph = visibleGraph(books, { bookId: 1, chapter: 2 });
    const rukus = graph.nodes.filter((n) => n.kind === "ruku");
    expect(rukus.map((n) => [n.id, n.inner, n.parentId])).toEqual([
      ["ruku:2", "1", "chapter:2"],
      ["ruku:37", "36", "chapter:2"],
    ]);
  });

  it("dims the siblings of an open chapter and an open ruku", () => {
    const graph = visibleGraph(books, { bookId: 1, chapter: 2, rukuId: 2 });
    const dimmed = (id: string) => graph.nodes.find((n) => n.id === id)?.dimmed;
    expect([dimmed("chapter:2"), dimmed("chapter:3")]).toEqual([false, true]);
    expect([dimmed("ruku:2"), dimmed("ruku:37")]).toEqual([false, true]);
    expect(graph.links.find((l) => l.target === "chapter:3")?.dimmed).toBe(true);
  });

  it("opens a ruku into its ayaat, each once", () => {
    expect(ids("verse", { bookId: 1, chapter: 2, rukuId: 2 })).toEqual(["verse:2-3"]);
  });

  it("opens an ayah into every book's citations, dimming those of other books", () => {
    const graph = visibleGraph(books, { bookId: 1, chapter: 2, rukuId: 2, verse: 3 });
    const citations = graph.nodes.filter((n) => n.kind === "citation");
    expect(citations.map((n) => [n.id, n.dimmed])).toEqual([
      ["citation:1:0", false],
      ["citation:1:1", false],
      ["citation:2:0", true],
    ]);
    // Its own are named by their reference, another book's by the book.
    expect(citations.map((n) => n.label)).toEqual(["ج ١ ص ٢", "ج ١ ص ٥", "الجامع لأحكام القرآن"]);
    expect(graph.links.filter((l) => l.source === "verse:2-3").map((l) => l.dimmed)).toEqual([false, false, true]);
  });

  it("shows no branch for a book whose citations did not come", () => {
    const anonymous = books.map((b) => ({ ...b, citations: null }));
    expect(visibleGraph(anonymous, { bookId: 1 }).nodes).toHaveLength(2);
  });
});

describe("citationsByVerse", () => {
  it("gathers a verse's citations across books", () => {
    expect(citationsByVerse(books).get("2-3")?.map((c) => c.book.bookId)).toEqual([1, 1, 2]);
  });
});

describe("validPath", () => {
  it("keeps a path the books can show", () => {
    const path = { bookId: 1, chapter: 2, rukuId: 2, verse: 3 };
    expect(validPath(books, path)).toEqual(path);
  });

  it("cuts the path where it stops matching", () => {
    expect(validPath(books, { bookId: 9, chapter: 2 })).toEqual({});
    expect(validPath(books, { bookId: 2, chapter: 3, rukuId: 42 })).toEqual({ bookId: 2 });
    expect(validPath(books, { bookId: 1, chapter: 2, rukuId: 37, verse: 3 })).toEqual({
      bookId: 1,
      chapter: 2,
      rukuId: 37,
    });
  });

  it("is empty when the citations did not come", () => {
    expect(validPath([{ ...tabari, citations: null }], { bookId: 1 })).toEqual({});
  });
});

describe("pathAfterSelecting", () => {
  const node = (path: Parameters<typeof visibleGraph>[1], id: string) =>
    visibleGraph(books, path).nodes.find((n) => n.id === id)!;

  it("opens a circle and closes it when picked again", () => {
    expect(pathAfterSelecting({}, node({}, "book:1"))).toEqual({ bookId: 1 });
    expect(pathAfterSelecting({ bookId: 1 }, node({ bookId: 1 }, "book:1"))).toEqual({});
  });

  it("swaps to a sibling and drops what was open under the old one", () => {
    const path = { bookId: 1, chapter: 2, rukuId: 2, verse: 3 };
    expect(pathAfterSelecting(path, node(path, "chapter:3"))).toEqual({ bookId: 1, chapter: 3 });
    expect(pathAfterSelecting(path, node(path, "book:2"))).toEqual({ bookId: 2 });
  });

  it("leaves the path alone for a citation", () => {
    const path = { bookId: 1, chapter: 2, rukuId: 2, verse: 3 };
    expect(pathAfterSelecting(path, node(path, "citation:2:0"))).toBe(path);
  });
});

describe("currentChoices and crumbs", () => {
  it("offers the next level down", () => {
    const path = { bookId: 1, chapter: 2 };
    expect(currentChoices(visibleGraph(books, path), path).map((n) => n.id)).toEqual(["ruku:2", "ruku:37"]);
    expect(currentChoices(visibleGraph(books, {}), {}).map((n) => n.id)).toEqual(["book:1", "book:2"]);
  });

  it("trails back to the books", () => {
    const trail = crumbs(books, { bookId: 1, chapter: 2, rukuId: 37 }, "All books");
    expect(trail.map((c) => c.label)).toEqual(["All books", "جامع البيان", "al-Baqarah", "Ruku 36"]);
    expect(trail[2].path).toEqual({ bookId: 1, chapter: 2 });
  });
});
