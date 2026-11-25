"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { BIBLIOGRAPHY_COPY } from "@/config/bibliography-copy";
import type { MapGraph, MapNode } from "@/lib/bibliography-graph";
import { useTheme } from "@/lib/theme";
import type { MapScene } from "./map-scene";

export interface BibliographyMapHandle {
  /** Brings the open branch, or everything, back into view. */
  fit: () => void;
}

interface BibliographyMapProps {
  graph: MapGraph;
  onSelect: (node: MapNode) => void;
  className?: string;
  ref?: Ref<BibliographyMapHandle>;
}

/**
 * The canvas box of the bibliography map. Owns lifecycle only: it imports the scene (and with
 * it the drawing library) after mount, keeps it sized to the box, hands it each new graph and
 * tells it when the theme changes. The page's trail and list of choices are how a keyboard or a
 * screen reader uses the map; the canvas itself is a picture to them.
 */
export default function BibliographyMap({ graph, onSelect, className, ref }: BibliographyMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MapScene | null>(null);
  const graphRef = useRef(graph);
  const onSelectRef = useRef(onSelect);
  const { resolved } = useTheme();

  graphRef.current = graph;
  onSelectRef.current = onSelect;

  useImperativeHandle(ref, () => ({ fit: () => sceneRef.current?.fit() }), []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    import("./map-scene").then(({ createMapScene }) => {
      if (disposed) return;
      const scene = createMapScene(box, {
        onSelect: (node) => onSelectRef.current(node),
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      sceneRef.current = scene;
      scene.resize(box.clientWidth, box.clientHeight);
      scene.update(graphRef.current);

      observer = new ResizeObserver(() => scene.resize(box.clientWidth, box.clientHeight));
      observer.observe(box);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update(graph);
  }, [graph]);

  useEffect(() => {
    sceneRef.current?.refreshColours();
  }, [resolved]);

  return <div ref={boxRef} className={className} role="img" aria-label={BIBLIOGRAPHY_COPY.map} />;
}
