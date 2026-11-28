"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import Icon from "@/components/ui/icon";
import { BIBLIOGRAPHY_COPY } from "@/config/bibliography-copy";
import type { MapNode, MapNodeKind } from "@/lib/bibliography-graph";
import { boundsOf, layoutTree, type Size, type TreeLayout } from "@/lib/bibliography-layout";
import { usePanZoom } from "./use-pan-zoom";
import styles from "./brace-map.module.css";

export interface BibliographyMapHandle {
  /** Brings the whole map back into view. */
  fit: () => void;
}

interface BibliographyMapProps {
  /** The eras, and the open branch under them, from `visibleTree`. */
  tree: MapNode[];
  onSelect: (node: MapNode) => void;
  className?: string;
  ref?: Ref<BibliographyMapHandle>;
}

/** The whole map is shown after a change only while its text stays at least this large. */
const READABLE_SCALE = 0.6;

function flatten(nodes: readonly MapNode[], into: MapNode[] = []): MapNode[] {
  for (const node of nodes) {
    into.push(node);
    flatten(node.children, into);
  }
  return into;
}

/** The deepest open shape with its group: what a change of branch has just brought out. */
function newestGroup(tree: readonly MapNode[]): string[] {
  let level = tree;
  let ids: string[] = [];
  for (;;) {
    const open = level.find((node) => node.open && node.children.length > 0);
    if (!open) return ids;
    ids = [open.id, ...open.children.map((child) => child.id)];
    level = open.children;
  }
}

/** The picture that tells a kind of shape apart at a glance. The other kinds have none. */
const KIND_ICON: Partial<Record<MapNodeKind, string>> = { era: "calendar", author: "user", book: "book" };
const ICON_SIZE: Partial<Record<MapNodeKind, number>> = { era: 22 };

/** A shape's mark, if its kind has one: a drawn icon, or for a ruku the ain the mushaf marks it with. */
function NodeMark({ kind }: { kind: MapNodeKind }) {
  if (kind === "ruku") {
    return (
      <span className={styles.ain} lang="ar" aria-hidden="true">
        ع
      </span>
    );
  }
  const name = KIND_ICON[kind];
  return name ? <Icon name={name} size={ICON_SIZE[kind] ?? 18} className={styles.icon} /> : null;
}

function NodeFace({ node }: { node: MapNode }) {
  const script = node.arabic ? { lang: "ar", dir: "rtl" as const } : {};
  return (
    <>
      <NodeMark kind={node.kind} />
      <span className={styles.text}>
        <span className={styles.label} {...script}>
          {node.label}
        </span>
        {node.detail && (
          // An author's detail is their year, in the same script as their name.
          <span className={styles.detail} {...(node.kind === "author" ? script : {})}>
            {node.detail}
          </span>
        )}
      </span>
    </>
  );
}

/**
 * The bibliography as a brace map that reads right to left: the eras in a column on the right,
 * each open shape holding its group in a brace to its left. Shapes are placed by
 * `layoutTree` from their measured sizes and never move unless the reader opens or closes a
 * branch; the reader zooms and pans to look around. Every shape is a button, so a keyboard or a
 * screen reader walks the same map.
 *
 * A shape is measured out of sight before it is placed, so it first appears where it belongs,
 * and the map keeps its last arrangement until every new shape has a size.
 */
export default function BibliographyMap({ tree, onSelect, className, ref }: BibliographyMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<ReadonlyMap<string, Size>>(new Map());
  const lastLayout = useRef<TreeLayout | null>(null);
  const shownOnce = useRef(false);
  const panZoom = usePanZoom(viewportRef, layerRef);

  const nodes = useMemo(() => flatten(tree), [tree]);
  const unmeasured = useMemo(() => nodes.filter((node) => !sizes.has(node.id)), [nodes, sizes]);

  const layout = useMemo(() => {
    if (unmeasured.length > 0) return lastLayout.current;
    return layoutTree(tree, (id) => sizes.get(id));
  }, [tree, sizes, unmeasured]);
  lastLayout.current = layout;

  // Before the browser paints: size the new shapes, which lays the map out again with them in it.
  useLayoutEffect(() => {
    const box = measureRef.current;
    if (!box || unmeasured.length === 0) return;
    const measured = new Map(sizes);
    for (const el of box.children) {
      const id = (el as HTMLElement).dataset.id;
      // A fraction of a pixel over, so text that just fits is never wrapped once placed.
      if (id) measured.set(id, { width: Math.ceil(el.getBoundingClientRect().width) + 1, height: (el as HTMLElement).offsetHeight });
    }
    setSizes(measured);
  }, [unmeasured, sizes]);

  // The Arabic font arrives only once text uses it, and changes every size it touches.
  useEffect(() => {
    const remeasure = () => setSizes(new Map());
    document.fonts?.addEventListener?.("loadingdone", remeasure);
    return () => document.fonts?.removeEventListener?.("loadingdone", remeasure);
  }, []);

  // After a change of branch, bring what it opened into view: everything while that stays
  // readable, otherwise the newest group with the shape it hangs from.
  useLayoutEffect(() => {
    if (!layout || layout.boxes.size === 0) return;
    const animate = shownOnce.current;
    shownOnce.current = true;
    if (panZoom.scaleToFit(layout.bounds) >= READABLE_SCALE) {
      panZoom.moveTo(layout.bounds, { animate });
    } else {
      panZoom.moveTo(boundsOf(layout, newestGroup(tree)), { animate, minScale: READABLE_SCALE });
    }
    // `tree` is read as it was laid out; the layout changing is what calls for a move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, panZoom]);

  useImperativeHandle(
    ref,
    () => ({
      fit: () => {
        if (lastLayout.current) panZoom.moveTo(lastLayout.current.bounds, { animate: true });
      },
    }),
    [panZoom],
  );

  const attributes = (node: MapNode) => ({
    "data-id": node.id,
    "data-kind": node.kind,
    "data-open": node.open || undefined,
    "data-dimmed": node.dimmed || undefined,
    "data-mahdavi": (node.kind === "book" && node.mahdavi) || undefined,
  });

  return (
    <div ref={viewportRef} className={`${styles.viewport} ${className ?? ""}`} role="group" aria-label={BIBLIOGRAPHY_COPY.map}>
      <div ref={layerRef} className={styles.layer}>
        <svg className={styles.braces} aria-hidden="true" focusable="false">
          {layout?.braces.map((brace) => (
            // A brace that changes shape is drawn afresh, fading in as its group settles.
            <path key={`${brace.parentId} ${brace.d}`} className={styles.brace} d={brace.d} />
          ))}
        </svg>

        {nodes.map((node) => {
          const box = layout?.boxes.get(node.id);
          if (!box) return null;
          const style: CSSProperties = {
            transform: `translate(${box.x}px, ${box.y}px)`,
            width: box.width,
            height: box.height,
          };
          return (
            <button
              key={node.id}
              type="button"
              className={styles.node}
              style={style}
              aria-label={node.name}
              aria-expanded={node.kind === "citation" ? undefined : node.open}
              aria-haspopup={node.kind === "citation" ? "dialog" : undefined}
              onClick={() => onSelect(node)}
              onFocus={(event) => {
                // The browser scrolls a clipped box to a focused child; the map moves itself instead.
                viewportRef.current?.scrollTo(0, 0);
                if (event.currentTarget.matches(":focus-visible")) panZoom.reveal(box);
              }}
              {...attributes(node)}
            >
              <NodeFace node={node} />
            </button>
          );
        })}
      </div>

      {/* New shapes take their natural size here first, out of sight and out of reach. */}
      <div ref={measureRef} className={styles.measure} aria-hidden="true">
        {unmeasured.map((node) => (
          <div key={node.id} className={styles.node} {...attributes(node)}>
            <NodeFace node={node} />
          </div>
        ))}
      </div>
    </div>
  );
}
