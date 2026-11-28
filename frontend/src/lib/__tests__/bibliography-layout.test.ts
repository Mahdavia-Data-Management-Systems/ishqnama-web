import { describe, expect, it } from "vitest";
import { visibleTree, type MapNode } from "@/lib/bibliography-graph";
import {
  boundsOf,
  bracePath,
  COLUMN_GAP,
  INNER_COLUMN_GAP,
  layoutTree,
  ROW_GAP,
  ROWS_PER_COLUMN,
  type Box,
} from "@/lib/bibliography-layout";
import type { BibliographyBookDto } from "@/types/api";

const book = (bookId: number, author: string, died: number, verses: number[]): BibliographyBookDto => ({
  bookId,
  title: `كتاب ${bookId}`,
  author,
  authorDeathYearHijri: died,
  citationCount: verses.length,
  citations: verses.map((verseNumber) => ({ chapterNumber: 2, verseNumber, rukuId: 2 })),
});

const books = [
  book(1, "الطبري", 410, [1, 2, 3]),
  book(2, "الطبري", 410, [4]),
  book(3, "البيهقي", 458, [5]),
  book(4, "القرطبي", 671, [6]),
];
const path = { era: "401-600", author: "الطبري", bookId: 1, chapter: 2, rukuId: 2 } as const;
const tree = visibleTree(books, path);

// Sizes differ by level and by label, as measured text would.
const sizeOf = (id: string) => ({ width: 60 + (id.length % 5) * 20, height: id.startsWith("era") ? 48 : 32 });
const widestEra = Math.max(...tree.map((era) => sizeOf(era.id).width));
const layout = layoutTree(tree, sizeOf);

function walk(nodes: readonly MapNode[], visit: (node: MapNode) => void) {
  for (const node of nodes) {
    visit(node);
    walk(node.children, visit);
  }
}
const box = (id: string) => layout.boxes.get(id)!;
const middle = (b: Box) => b.y + b.height / 2;

describe("layoutTree", () => {
  it("places every shape below the eras at its measured size", () => {
    walk(tree, (node) => {
      if (node.kind !== "era") expect(box(node.id), node.id).toMatchObject(sizeOf(node.id));
    });
  });

  it("draws every era as wide as the widest", () => {
    expect(new Set(tree.map((era) => sizeOf(era.id).width)).size).toBeGreaterThan(1);
    for (const era of tree) {
      expect(box(era.id)).toMatchObject({ width: widestEra, height: sizeOf(era.id).height });
    }
  });

  it("is the same every time", () => {
    expect(layoutTree(tree, sizeOf)).toEqual(layout);
  });

  it("puts each group a column to the left of the shape it hangs from", () => {
    walk(tree, (node) => {
      for (const child of node.children) {
        expect(box(child.id).x + box(child.id).width, child.id).toBeLessThanOrEqual(box(node.id).x - COLUMN_GAP);
      }
    });
  });

  it("lines a short group up on its right edge, top to bottom, without touching", () => {
    const groups = [tree];
    walk(tree, (node) => node.children.length > 0 && groups.push(node.children));
    for (const group of groups) {
      const placed = group.map((node) => box(node.id));
      expect(new Set(placed.map((b) => b.x + b.width)).size).toBe(1);
      for (let i = 1; i < placed.length; i++) {
        expect(placed[i].y).toBeGreaterThanOrEqual(placed[i - 1].y + placed[i - 1].height + ROW_GAP);
      }
    }
  });

  it("sets a shape level with the group it opens into", () => {
    walk(tree, (node) => {
      if (node.children.length === 0) return;
      const group = boundsOf(layout, node.children.map((child) => child.id));
      expect(middle(group)).toBeCloseTo(middle(box(node.id)));
    });
  });

  it("keeps shapes of different branches apart", () => {
    const placed = [...layout.boxes.values()];
    for (const a of placed) {
      for (const b of placed) {
        if (a === b) continue;
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it("draws one brace for each open shape", () => {
    const open: string[] = [];
    walk(tree, (node) => node.children.length > 0 && open.push(node.id));
    expect(layout.braces.map((b) => b.parentId).sort()).toEqual(open.sort());
  });

  it("bounds every shape", () => {
    const { x, y, width, height } = layout.bounds;
    for (const b of layout.boxes.values()) {
      expect(b.x).toBeGreaterThanOrEqual(x);
      expect(b.y).toBeGreaterThanOrEqual(y);
      expect(b.x + b.width).toBeLessThanOrEqual(x + width);
      expect(b.y + b.height).toBeLessThanOrEqual(y + height);
    }
  });

  it("gives an empty map nothing to draw", () => {
    expect(layoutTree([], sizeOf)).toMatchObject({ braces: [], bounds: { width: 0, height: 0 } });
  });
});

describe("a long group", () => {
  // Twenty authors in one era, the fourteenth open: columns of 8, 8 and 4.
  const many = Array.from({ length: 20 }, (_, i) => book(i + 1, `مؤلف ${String(i).padStart(2, "0")}`, 401 + i, [1, 2]));
  const open = { era: "401-600", author: "مؤلف 13" } as const;
  const longTree = visibleTree(many, open);
  const long = layoutTree(longTree, sizeOf);
  const authors = longTree.find((node) => node.open)!.children;
  const placed = authors.map((node) => long.boxes.get(node.id)!);
  const columns = [placed.slice(0, 8), placed.slice(8, 16), placed.slice(16)];

  it("is set in columns of eight, each on its own right edge", () => {
    expect(authors).toHaveLength(20);
    expect(ROWS_PER_COLUMN).toBe(8);
    for (const column of columns) {
      expect(new Set(column.map((b) => b.x + b.width)).size).toBe(1);
      for (let i = 1; i < column.length; i++) {
        expect(column[i].y).toBeGreaterThanOrEqual(column[i - 1].y + column[i - 1].height + ROW_GAP);
      }
    }
  });

  it("fills its columns from the right, starting each on one top line", () => {
    expect(new Set(columns.map((column) => column[0].y)).size).toBe(1);
    for (let c = 1; c < columns.length; c++) {
      const nearerLeft = Math.min(...columns[c - 1].map((b) => b.x));
      const right = columns[c][0].x + columns[c][0].width;
      expect(right).toBeLessThanOrEqual(nearerLeft - INNER_COLUMN_GAP);
    }
  });

  it("keeps every shape clear of every other", () => {
    const all = [...long.boxes.values()];
    for (const a of all) {
      for (const b of all) {
        if (a === b) continue;
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it("opens a shape of an inner column to the left of the whole group", () => {
    const opened = authors.find((node) => node.open)!;
    expect(authors.indexOf(opened)).toBeGreaterThanOrEqual(8);
    const groupLeft = Math.min(...placed.map((b) => b.x));
    for (const child of opened.children) {
      const b = long.boxes.get(child.id)!;
      expect(b.x + b.width).toBeLessThanOrEqual(groupLeft - COLUMN_GAP);
    }
    // Its brace stands in the gap between the two groups: its point is left of the whole group.
    const brace = long.braces.find((b) => b.parentId === opened.id)!;
    const xs = [...brace.d.matchAll(/(-?[\d.]+),/g)].map((m) => Number(m[1]));
    expect(Math.max(...xs)).toBeLessThan(groupLeft);
  });
});

describe("boundsOf", () => {
  it("surrounds the shapes named, and the whole map when none is placed", () => {
    const era = box("era:401-600");
    expect(boundsOf(layout, ["era:401-600"])).toEqual(era);
    expect(boundsOf(layout, ["nothing"])).toEqual(layout.bounds);
  });
});

describe("bracePath", () => {
  const parent: Box = { x: 200, y: 80, width: 100, height: 40 };
  const children: Box[] = [
    { x: 44, y: 0, width: 100, height: 40 },
    { x: 84, y: 80, width: 60, height: 40 },
    { x: 44, y: 160, width: 100, height: 40 },
  ];

  it("spans the first to the last of the group and points at the shape's middle", () => {
    const d = bracePath(parent, children);
    // The spine is at 172, midway between the group (right edge 144) and the shape (left edge 200).
    expect(d.startsWith(`M 162,${middle(children[0])}`)).toBe(true);
    expect(d.endsWith(`162,${middle(children[2])}`)).toBe(true);
    expect(d).toContain(`182,${middle(parent)}`);
    expect(d.match(/Q/g)).toHaveLength(4);
  });

  it("ties a group of one to its shape with a straight line", () => {
    const d = bracePath(parent, [children[1]]);
    expect(d).toBe("M 162,100 L 182,100");
  });

  it("keeps its point between the curls when the shape is off to one side", () => {
    const d = bracePath({ ...parent, y: 400 }, children);
    expect(d).toContain("182,160");
  });
});
