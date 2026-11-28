import type { MapNode } from "@/lib/bibliography-graph";

/**
 * Where each shape of the bibliography map sits, and the braces between them. Pure: the same
 * tree and sizes always give the same picture, so nothing moves unless the reader opens or
 * closes a branch.
 *
 * The map reads right to left, like the names in it. Only one shape is open at each level, so
 * the map is a row of groups: the eras on the right, then the open era's group to their left,
 * then the group of the open shape in that one, and so on. Each group is held by a brace whose
 * point faces the shape it hangs from, and is level with that shape.
 *
 * A group of more than `ROWS_PER_COLUMN` is set in columns of that many, filled top to bottom
 * and then leftward, so a long group stays about a screen tall. A column's shapes share their
 * right edge. Every other shape is as wide as its text; the eras alone share one width.
 */

export interface Size {
  width: number;
  height: number;
}

/** A rectangle in map units, `x` and `y` at its top left. */
export interface Box extends Size {
  x: number;
  y: number;
}

export interface Brace {
  /** The open shape this brace gathers a group for. */
  parentId: string;
  /** SVG path data in map units. */
  d: string;
}

export interface TreeLayout {
  boxes: Map<string, Box>;
  braces: Brace[];
  /** The rectangle around every shape. */
  bounds: Box;
}

/** The most shapes stacked in one column of a group. */
export const ROWS_PER_COLUMN = 8;
/** Room between two groups, where the brace is drawn. */
export const COLUMN_GAP = 56;
/** Room between two columns of one group. */
export const INNER_COLUMN_GAP = 12;
/** Room between two shapes of a column. */
export const ROW_GAP = 10;
/** How far a brace's curls and point reach from its spine. */
const BRACE_REACH = 10;

const EMPTY: Box = { x: 0, y: 0, width: 0, height: 0 };

const middle = (box: Box) => box.y + box.height / 2;
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * The brace between a shape and its group to the left: a spine midway between the two, curling
 * out to the first and last of the group's nearest column, with its point facing the shape's
 * middle. A group of one, or one whose middles all but coincide, gets a short tie instead.
 * `parent` is where the brace's point looks: its left edge and its middle are what matter.
 */
export function bracePath(parent: Box, children: readonly Box[]): string {
  const right = Math.max(...children.map((c) => c.x + c.width));
  const spine = (right + parent.x) / 2;
  const top = middle(children[0]);
  const bottom = middle(children[children.length - 1]);
  const reach = Math.min(BRACE_REACH, (bottom - top) / 4);

  if (reach < 1) {
    return `M ${round(spine - BRACE_REACH)},${round(top)} L ${round(spine + BRACE_REACH)},${round(middle(parent))}`;
  }

  // The point stays between the curls even if the shape is not level with the group's middle.
  const point = Math.min(Math.max(middle(parent), top + 2 * reach), bottom - 2 * reach);
  const [s, r] = [round(spine), round(reach)];
  const [t, p, b] = [round(top), round(point), round(bottom)];
  return [
    `M ${round(s - r)},${t}`,
    `Q ${s},${t} ${s},${round(t + r)}`,
    `L ${s},${round(p - r)}`,
    `Q ${s},${p} ${round(s + r)},${p}`,
    `Q ${s},${p} ${s},${round(p + r)}`,
    `L ${s},${round(b - r)}`,
    `Q ${s},${b} ${round(s - r)},${b}`,
  ].join(" ");
}

/**
 * Places the eras and the open branch under them. `sizeOf` gives each shape's measured size; a
 * shape not measured yet takes no room.
 */
export function layoutTree(eras: readonly MapNode[], sizeOf: (id: string) => Size | undefined): TreeLayout {
  const boxes = new Map<string, Box>();
  const braces: Brace[] = [];
  const size = (id: string) => sizeOf(id) ?? { width: 0, height: 0 };

  // The eras end at x = 0 around y = 0; every later group is placed from the one before it.
  let group: readonly MapNode[] = eras;
  let rightEdge = 0;
  let centre = 0;
  let parent: MapNode | undefined;

  while (group.length > 0) {
    const columns: MapNode[][] = [];
    for (let i = 0; i < group.length; i += ROWS_PER_COLUMN) columns.push(group.slice(i, i + ROWS_PER_COLUMN));

    const heights = columns.map(
      (column) => column.reduce((sum, node) => sum + size(node.id).height, 0) + ROW_GAP * (column.length - 1),
    );
    // Columns hang from one top line, the tallest of them level with the shape the group is for.
    const top = centre - Math.max(...heights) / 2;

    let columnRight = rightEdge;
    for (const column of columns) {
      const width = Math.max(...column.map((node) => size(node.id).width));
      let y = top;
      for (const node of column) {
        const { width: natural, height: h } = size(node.id);
        // The eras are one set of spans, so they are drawn as wide as the widest of them.
        const w = node.kind === "era" ? width : natural;
        boxes.set(node.id, { x: columnRight - w, y, width: w, height: h });
        y += h + ROW_GAP;
      }
      columnRight -= width + INNER_COLUMN_GAP;
    }
    const leftEdge = columnRight + INNER_COLUMN_GAP;

    if (parent) {
      // The brace stands in the gap between the two groups, whichever column its shape is in.
      const from = boxes.get(parent.id)!;
      braces.push({
        parentId: parent.id,
        d: bracePath({ ...from, x: rightEdge + COLUMN_GAP }, columns[0].map((node) => boxes.get(node.id)!)),
      });
    }

    parent = group.find((node) => node.children.length > 0);
    if (!parent) break;
    group = parent.children;
    rightEdge = leftEdge - COLUMN_GAP;
    centre = middle(boxes.get(parent.id)!);
  }

  if (boxes.size === 0) return { boxes, braces, bounds: EMPTY };
  return { boxes, braces, bounds: boundsOf({ boxes }, [...boxes.keys()]) };
}

/** The rectangle around some of the shapes; the whole map's when none of them is placed. */
export function boundsOf(layout: Pick<TreeLayout, "boxes"> & { bounds?: Box }, ids: readonly string[]): Box {
  const placed = ids.map((id) => layout.boxes.get(id)).filter((box): box is Box => box != null);
  if (placed.length === 0) return layout.bounds ?? EMPTY;
  const left = Math.min(...placed.map((b) => b.x));
  const top = Math.min(...placed.map((b) => b.y));
  return {
    x: left,
    y: top,
    width: Math.max(...placed.map((b) => b.x + b.width)) - left,
    height: Math.max(...placed.map((b) => b.y + b.height)) - top,
  };
}
