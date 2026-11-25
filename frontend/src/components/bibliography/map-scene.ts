import ForceGraph, { type NodeObject } from "force-graph";
import type { MapGraph, MapLink, MapNode } from "@/lib/bibliography-graph";

/**
 * The bibliography's map on a canvas, drawn with force-graph (MIT). This is the only file that
 * touches the library, and it is imported on demand, so the library is in no other page's code.
 * It draws what `visibleGraph()` returns and reports taps; it decides nothing itself.
 */

type SceneNode = MapNode & NodeObject;
type SceneLink = { source: string | SceneNode; target: string | SceneNode; dimmed: boolean };

export interface MapSceneOptions {
  onSelect: (node: MapNode) => void;
  /** Work each layout out before drawing it and move the view without easing. */
  reducedMotion: boolean;
}

export interface MapScene {
  /** Shows a graph; circles already on the map start from where they are. */
  update(graph: MapGraph): void;
  /** Brings the open branch into view, or everything when nothing is open. */
  fit(): void;
  resize(width: number, height: number): void;
  /** Reads the theme's colours again and redraws. */
  refreshColours(): void;
  destroy(): void;
}

interface Colours {
  page: string;
  card: string;
  gold: string;
  goldWash: string;
  goldLabel: string;
  teal: string;
  fill: string;
  onFill: string;
  text: string;
  textMuted: string;
  line: string;
  fontBody: string;
  fontArabic: string;
}

const DEPTH = { book: 0, chapter: 1, ruku: 2, verse: 3, citation: 4 } as const;
const DIMMED_ALPHA = 0.32;
const FIT_PADDING = 56;
const FIT_MS = 400;
const FIT_DELAY_MS = 220;
/** A small branch is not blown up to fill the screen. */
const MAX_FIT_ZOOM = 3;
const GRAVITY = 0.06;
/** The gap a line crosses between two circles. */
const LINK_ROOM = 34;
/** The books are laid out before the first frame, so the map opens at rest. */
const FIRST_LAYOUT_TICKS = 260;
/** A change is partly worked out before it is drawn, then the circles ease the rest of the way. */
const CHANGE_LAYOUT_TICKS = 25;
/** How long the circles may keep moving after a change. */
const REST_MS = 500;
const COLLIDE_PASSES = 4;
/** Passes that guarantee nothing overlaps once the layout has stopped. */
const FINAL_PASSES = 300;
const COLLIDE_PADDING = 10;
/** Room under a circle for its label, so labels of neighbours do not run together. */
const LABEL_ROOM = 8;

function readColours(): Colours {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    page: token("--surface-page"),
    card: token("--surface-card"),
    gold: token("--gold"),
    goldWash: token("--gold-wash"),
    goldLabel: token("--gold-label"),
    teal: token("--teal-primary"),
    fill: token("--fill-primary"),
    onFill: token("--text-on-dark"),
    text: token("--text-primary"),
    textMuted: token("--text-tertiary"),
    line: token("--tint-ink-20"),
    fontBody: token("--font-body") || "sans-serif",
    fontArabic: token("--font-naskh") || "serif",
  };
}

/** Pulls the books gently towards the middle, so they gather into one cluster. */
function gravity() {
  let nodes: SceneNode[] = [];
  const force = (alpha: number) => {
    for (const node of nodes) {
      if (node.kind !== "book") continue;
      node.vx = (node.vx ?? 0) - (node.x ?? 0) * GRAVITY * alpha;
      node.vy = (node.vy ?? 0) - (node.y ?? 0) * GRAVITY * alpha;
    }
  };
  force.initialize = (all: SceneNode[]) => {
    nodes = all;
  };
  return force;
}

/** How far apart two circles' centres must be: no overlap, and room for the label under each. */
const roomBetween = (a: SceneNode, b: SceneNode) => a.radius + b.radius + COLLIDE_PADDING + LABEL_ROOM;

/**
 * Moves overlapping circles apart, each by half the overlap (a held circle stays and the other
 * moves the whole way). Returns whether any pair overlapped. A plain pair loop: the map never
 * holds more than a few hundred circles.
 */
function pushApart(nodes: SceneNode[]): boolean {
  let overlapped = false;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = (b.x ?? 0) - (a.x ?? 0) || 0.01;
      const dy = (b.y ?? 0) - (a.y ?? 0) || 0.01;
      const distance = Math.hypot(dx, dy);
      const gap = roomBetween(a, b) - distance;
      if (gap <= 0.01) continue;
      overlapped = true;
      const aHeld = a.fx != null;
      const bHeld = b.fx != null;
      if (aHeld && bHeld) continue;
      const shareA = aHeld ? 0 : bHeld ? 1 : 0.5;
      const ux = dx / distance;
      const uy = dy / distance;
      a.x = (a.x ?? 0) - ux * gap * shareA;
      a.y = (a.y ?? 0) - uy * gap * shareA;
      b.x = (b.x ?? 0) + ux * gap * (1 - shareA);
      b.y = (b.y ?? 0) + uy * gap * (1 - shareA);
    }
  }
  return overlapped;
}

/**
 * Keeps circles from overlapping while the layout runs. It moves positions rather than nudging
 * speeds, and passes over them a few times a tick, so overlaps are gone within a few frames
 * instead of being bounced out slowly.
 */
function collide() {
  let nodes: SceneNode[] = [];
  const force = () => {
    for (let pass = 0; pass < COLLIDE_PASSES; pass++) if (!pushApart(nodes)) break;
  };
  force.initialize = (all: SceneNode[]) => {
    nodes = all;
  };
  return force;
}

export function createMapScene(container: HTMLElement, options: MapSceneOptions): MapScene {
  let colours = readColours();
  let destroyed = false;
  let fitTimer: ReturnType<typeof setTimeout> | null = null;
  /** The circles on the map by id. The library keeps each one's position on the object itself. */
  const nodesById = new Map<string, SceneNode>();
  let current: SceneNode[] = [];

  const insideFont = (node: SceneNode) => `${node.radius * 0.3}px ${colours.fontArabic}`;

  /** Whether a book's title is short enough to sit inside its circle. */
  const titleInside = (node: SceneNode, ctx: CanvasRenderingContext2D) => {
    if (node.kind !== "book" || node.radius < 26) return false;
    ctx.font = insideFont(node);
    return ctx.measureText(node.label).width <= node.radius * 1.7;
  };

  const paintLabel = (node: SceneNode, ctx: CanvasRenderingContext2D) => {
    if (!node.label) return;
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = node.radius;
    ctx.save();
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.globalAlpha = node.dimmed ? DIMMED_ALPHA + 0.1 : 1;

    if (titleInside(node, ctx)) {
      ctx.textBaseline = "middle";
      ctx.fillStyle = node.open ? colours.onFill : colours.text;
      ctx.fillText(node.label, x, y - r * 0.26);
    } else {
      const size = node.kind === "book" ? Math.max(6, Math.min(12, r * 0.42)) : 6.5;
      ctx.font = `${size}px ${node.arabic ? colours.fontArabic : colours.fontBody}`;
      ctx.textBaseline = "top";
      ctx.lineWidth = size * 0.35;
      ctx.strokeStyle = colours.page;
      ctx.strokeText(node.label, x, y + r + 2.5);
      ctx.fillStyle = node.dimmed ? colours.textMuted : colours.text;
      ctx.fillText(node.label, x, y + r + 2.5);
    }
    ctx.restore();
  };

  /**
   * Labels are drawn after every circle, each over a thin outline in the page colour, so one
   * stays readable where it crosses a line or another label.
   */
  const paintLabels = (ctx: CanvasRenderingContext2D) => {
    for (const node of current) paintLabel(node, ctx);
  };

  const paintNode = (node: SceneNode, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = node.radius;
    const isBook = node.kind === "book";
    const isCitation = node.kind === "citation";

    ctx.save();
    // Hide the line ends under the circle, also for a dimmed one.
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = colours.page;
    ctx.fill();

    if (node.dimmed) ctx.globalAlpha = DIMMED_ALPHA;

    const accent = isBook || isCitation ? colours.gold : colours.teal;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.open ? colours.fill : isBook ? colours.goldWash : isCitation ? colours.gold : colours.card;
    ctx.fill();
    ctx.lineWidth = node.open ? 2.5 : isBook && node.book.kind === "mahdavi" ? 3 : 1.5;
    ctx.strokeStyle = node.open ? colours.gold : accent;
    ctx.stroke();

    if (node.inner) {
      // Measured first: measuring sets the canvas font.
      const lift = titleInside(node, ctx) ? r * 0.28 : 0;
      const size = isBook ? Math.max(7, r * (lift ? 0.4 : 0.5)) : r * 0.85;
      ctx.font = `600 ${size}px ${colours.fontBody}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = node.open ? colours.onFill : isBook ? colours.goldLabel : colours.teal;
      // A book whose title fits inside its circle carries it above the count.
      ctx.fillText(node.inner, x, y + size * 0.05 + lift);
    }
    ctx.restore();
  };

  const graph = new ForceGraph<SceneNode, SceneLink>(container)
    .backgroundColor("rgba(0,0,0,0)")
    .nodeId("id")
    .nodeLabel(() => "")
    .nodeCanvasObjectMode(() => "replace")
    .nodeCanvasObject(paintNode)
    .nodePointerAreaPaint((node, colour, ctx) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      // A little larger than the circle, so the small ones are easy to tap.
      ctx.arc(node.x ?? 0, node.y ?? 0, node.radius + 3, 0, 2 * Math.PI);
      ctx.fill();
    })
    .onRenderFramePost(paintLabels)
    .linkColor(() => colours.line)
    .linkWidth((link) => (link.dimmed ? 0.5 : 1.2))
    .linkLineDash((link) => (link.dimmed ? [2, 2] : null))
    .minZoom(0.3)
    .maxZoom(12)
    .onNodeClick((node) => options.onSelect(node))
    .onNodeDragEnd((node) => {
      // Stays where the reader put it.
      node.fx = node.x;
      node.fy = node.y;
    });

  graph.d3Force("center", null);
  graph.d3Force("gravity", gravity());
  graph.d3Force("collide", collide());
  const charge = graph.d3Force("charge");
  charge?.strength?.((node: SceneNode) => -node.radius * 1.5);
  const link = graph.d3Force("link");
  link?.distance?.((l: SceneLink) => {
    const source = l.source as SceneNode;
    const target = l.target as SceneNode;
    return source.radius + target.radius + LINK_ROOM;
  });

  // Quick to rest: the layout loses its energy fast and circles do not coast.
  graph.d3AlphaDecay(0.06).d3VelocityDecay(0.55);
  if (options.reducedMotion) graph.cooldownTicks(0);
  else graph.cooldownTime(REST_MS);

  // Whatever the forces left, nothing overlaps once the map is at rest.
  graph.onEngineStop(() => {
    let moved = false;
    for (let pass = 0; pass < FINAL_PASSES && pushApart(current); pass++) moved = true;
    // Setting a painter again is what asks the library for a redraw while the map is at rest.
    if (moved && !destroyed) graph.nodeCanvasObject(paintNode);
    if (refitAtRest) {
      refitAtRest = false;
      fit(true);
    }
  });

  let lastFit: { x: number; y: number; k: number } | null = null;
  let refitAtRest = false;
  const fit = (onlyIfOff = false) => {
    if (destroyed || current.length === 0) return;
    const open = current.filter((n) => n.open);
    const deepest = open.length ? open.reduce((x, y) => (DEPTH[y.kind] > DEPTH[x.kind] ? y : x)) : null;
    // Nothing open: every book. A book open: it and its chapters. Deeper: the open chapter and
    // all that has opened under it, so the reader keeps the branch in view as it grows.
    const inView = (n: SceneNode) =>
      !deepest ? true
      : deepest.kind === "book" ? n.id === deepest.id || n.parentId === deepest.id
      : n.kind !== "book" && (n.kind !== "chapter" || n.open);

    const box = graph.getGraphBbox(inView);
    if (!box) return;
    // The box is measured between centres; make room for the circles themselves and their labels.
    const room = 2 * (Math.max(...current.filter(inView).map((n) => n.radius)) + LABEL_ROOM);
    const width = Math.max(1, box.x[1] - box.x[0] + room);
    const height = Math.max(1, box.y[1] - box.y[0] + room);
    const scale = Math.min(
      (graph.width() - 2 * FIT_PADDING) / width,
      (graph.height() - 2 * FIT_PADDING) / height,
      MAX_FIT_ZOOM,
    );
    const target = { x: (box.x[0] + box.x[1]) / 2, y: (box.y[0] + box.y[1]) / 2, k: Math.max(scale, 0.3) };
    // A touch-up after the circles have stopped is skipped when the view is already close.
    if (
      onlyIfOff &&
      lastFit &&
      Math.hypot(target.x - lastFit.x, target.y - lastFit.y) * target.k < 24 &&
      Math.abs(target.k / lastFit.k - 1) < 0.08
    ) {
      return;
    }
    lastFit = target;
    const ms = options.reducedMotion ? 0 : FIT_MS;
    graph.centerAt(target.x, target.y, ms);
    graph.zoom(target.k, ms);
  };

  return {
    update(next: MapGraph) {
      if (destroyed) return;
      const seen = new Set<string>();
      const first = nodesById.size === 0;
      current = next.nodes.map((fresh) => {
        seen.add(fresh.id);
        const existing = nodesById.get(fresh.id);
        if (existing) return Object.assign(existing, fresh);
        const node: SceneNode = { ...fresh };
        // A new circle starts just beyond the one it hangs from, on the side away from that
        // one's own parent, so each level opens outwards and has only a short way to go.
        const parent = fresh.parentId ? nodesById.get(fresh.parentId) : undefined;
        if (parent?.x != null && parent.y != null) {
          const grand = parent.parentId ? nodesById.get(parent.parentId) : undefined;
          const outward =
            grand?.x != null && grand.y != null
              ? Math.atan2(parent.y - grand.y, parent.x - grand.x) + (Math.random() - 0.5) * 1.6
              : Math.random() * 2 * Math.PI;
          const reach = parent.radius + fresh.radius + LINK_ROOM;
          node.x = parent.x + Math.cos(outward) * reach;
          node.y = parent.y + Math.sin(outward) * reach;
        }
        nodesById.set(fresh.id, node);
        return node;
      });
      for (const id of [...nodesById.keys()]) if (!seen.has(id)) nodesById.delete(id);

      // Under reduced motion every layout is worked out in full before it is drawn.
      graph.warmupTicks(first || options.reducedMotion ? FIRST_LAYOUT_TICKS : CHANGE_LAYOUT_TICKS);
      graph.graphData({
        nodes: current,
        links: next.links.map((l: MapLink) => ({ ...l })),
      });

      if (fitTimer) clearTimeout(fitTimer);
      // One move of the view, once the circles are nearly in place.
      refitAtRest = true;
      fitTimer = setTimeout(() => fit(), first || options.reducedMotion ? 80 : FIT_DELAY_MS);
    },
    fit: () => fit(),
    resize(width: number, height: number) {
      if (!destroyed) graph.width(width).height(height);
    },
    refreshColours() {
      if (destroyed) return;
      colours = readColours();
      // Setting a painter again is what asks the library for a redraw while the map is at rest.
      graph.nodeCanvasObject(paintNode);
    },
    destroy() {
      destroyed = true;
      if (fitTimer) clearTimeout(fitTimer);
      graph._destructor();
      container.replaceChildren();
    },
  };
}
