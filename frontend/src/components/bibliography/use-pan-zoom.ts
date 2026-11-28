import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { Box } from "@/lib/bibliography-layout";

/** How far the reader can zoom out and in. Text is drawn at its natural size at 1. */
const SCALE_EXTENT: [number, number] = [0.25, 2];
/** A press that moves less than this is still a tap on a shape, not a drag of the map. */
const TAP_SLOP_PX = 4;
const MOVE_MS = 350;
/** Kept clear around what is brought into view: the panel above, the button below. */
const INSET = { top: 112, right: 32, bottom: 72, left: 32 };

export interface MoveOptions {
  animate: boolean;
  /** The view never shrinks its target below this; a target too big for it is centred instead. */
  minScale?: number;
}

export interface PanZoom {
  /** The scale at which a rectangle of the map just fits the view, never above natural size. */
  scaleToFit: (target: Box) => number;
  /** Centres a rectangle of the map in the view, as large as fits. */
  moveTo: (target: Box, options: MoveOptions) => void;
  /** Slides the map just far enough for a rectangle to be in view, keeping the zoom. */
  reveal: (target: Box) => void;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Zoom and pan for the bibliography map: the wheel and a pinch zoom, a drag pans, and the map
 * can be told to bring part of itself into view. `viewport` takes the gestures and `layer` (its
 * child, holding the map) takes the transform. Nothing here moves the map on its own.
 */
export function usePanZoom(
  viewport: RefObject<HTMLElement | null>,
  layer: RefObject<HTMLElement | null>,
): PanZoom {
  const behaviour = useRef<ZoomBehavior<HTMLElement, unknown> | null>(null);
  const frame = useRef(0);

  // Set up before the map's first layout effect, which already asks for a move.
  useLayoutEffect(() => {
    const box = viewport.current;
    if (!box) return;

    const zooming = zoom<HTMLElement, unknown>()
      .scaleExtent(SCALE_EXTENT)
      .clickDistance(TAP_SLOP_PX)
      // Always listen for fingers. By default the library asks once, here, whether the device
      // has a touch screen, and a screen that gains touch later (a phone view switched on in the
      // browser's tools, a tablet mode) would never pan.
      .touchable(true)
      .on("start", (event) => {
        // The reader's own gesture takes over from a move in progress.
        if (event.sourceEvent) cancelAnimationFrame(frame.current);
      })
      .on("zoom", (event: { transform: ZoomTransform }) => {
        const { x, y, k } = event.transform;
        if (layer.current) layer.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      });
    behaviour.current = zooming;
    // A double tap on a shape opens and closes it; it must not zoom as well.
    select(box).call(zooming).on("dblclick.zoom", null);

    return () => {
      cancelAnimationFrame(frame.current);
      select(box).on(".zoom", null);
      behaviour.current = null;
    };
  }, [viewport, layer]);

  return useMemo<PanZoom>(() => {
    const room = (box: HTMLElement) => ({
      width: Math.max(1, box.clientWidth - INSET.left - INSET.right),
      height: Math.max(1, box.clientHeight - INSET.top - INSET.bottom),
    });

    const scaleToFit = (target: Box) => {
      const box = viewport.current;
      if (!box) return 1;
      const { width, height } = room(box);
      return Math.min(1, width / Math.max(1, target.width), height / Math.max(1, target.height));
    };

    const go = (to: ZoomTransform, animate: boolean) => {
      const box = viewport.current;
      const zooming = behaviour.current;
      if (!box || !zooming) return;
      cancelAnimationFrame(frame.current);
      const selection = select(box);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduced) {
        zooming.transform(selection, to);
        return;
      }

      const from = zoomTransform(box);
      const started = performance.now();
      const step = (now: number) => {
        const t = easeOut(Math.min(1, (now - started) / MOVE_MS));
        const at = zoomIdentity
          .translate(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
          .scale(from.k + (to.k - from.k) * t);
        zooming.transform(selection, at);
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    };

    const moveTo = (target: Box, { animate, minScale = SCALE_EXTENT[0] }: MoveOptions) => {
      const box = viewport.current;
      if (!box) return;
      const { width, height } = room(box);
      const k = Math.max(minScale, scaleToFit(target));
      const x = INSET.left + width / 2 - k * (target.x + target.width / 2);
      const y = INSET.top + height / 2 - k * (target.y + target.height / 2);
      go(zoomIdentity.translate(x, y).scale(k), animate);
    };

    const reveal = (target: Box) => {
      const box = viewport.current;
      if (!box) return;
      const { x, y, k } = zoomTransform(box);
      const left = x + k * target.x;
      const top = y + k * target.y;
      const right = left + k * target.width;
      const bottom = top + k * target.height;
      const dx = left < INSET.left ? INSET.left - left : Math.min(0, box.clientWidth - INSET.right - right);
      const dy = top < INSET.top ? INSET.top - top : Math.min(0, box.clientHeight - INSET.bottom - bottom);
      if (dx !== 0 || dy !== 0) go(zoomIdentity.translate(x + dx, y + dy).scale(k), true);
    };

    return { scaleToFit, moveTo, reveal };
  }, [viewport]);
}
