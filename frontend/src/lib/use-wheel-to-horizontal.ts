import { useEffect } from "react";

const LINE_HEIGHT_PX = 16;
const SNAP_RESTORE_MS = 150;
/** Share of the remaining distance covered per 16 ms frame; higher is snappier. */
const EASE_PER_FRAME = 0.2;
/** Within this many pixels of its target the rail simply lands on it. */
const SETTLE_PX = 0.5;

/**
 * Lets a vertical mouse wheel scroll a horizontal rail, handing the wheel back
 * to the page once the rail reaches either end, so scrolling down the page
 * pages through the rail and then carries on down.
 *
 * Each wheel step moves a target position and the rail eases towards it frame
 * by frame, so a notched wheel glides instead of jumping a card at a time, and
 * quick turns add up into one continuous movement. Readers who prefer reduced
 * motion get the plain jump. A press or touch on the rail stops the easing
 * where it is. The end-of-rail handoff is judged from the target, so the page
 * takes the wheel as soon as the rail is headed for its end.
 *
 * Wheels that already scroll sideways (trackpads, shift+wheel) and pinch-zoom
 * (ctrl+wheel) are left to the browser. Scroll snapping is suspended while
 * the rail moves, because mandatory snap would pull each small wheel step
 * back to the card it started on, and restored once the rail rests so it
 * settles on a card.
 *
 * Takes the element rather than a ref, for the same reason as useDragToScroll.
 */
export function useWheelToHorizontal(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    let frame: number | null = null;
    let position = 0;
    let target = 0;
    let last = 0;

    const scheduleSnapRestore = () => {
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        el.style.scrollSnapType = "";
      }, SNAP_RESTORE_MS);
    };

    const stopEasing = () => {
      if (frame === null) return;
      cancelAnimationFrame(frame);
      frame = null;
      scheduleSnapRestore();
    };

    const step = (now: number) => {
      const dt = Math.max(0, now - last);
      last = now;
      const remaining = target - position;
      if (Math.abs(remaining) <= SETTLE_PX) {
        position = target;
      } else {
        position += remaining * (1 - Math.pow(1 - EASE_PER_FRAME, dt / 16));
      }
      el.scrollLeft = position;
      if (position === target) {
        frame = null;
        scheduleSnapRestore();
        return;
      }
      frame = requestAnimationFrame(step);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT_PX : event.deltaY;
      const maxScroll = el.scrollWidth - el.clientWidth;
      // Mid-glide the rail is already headed for the target; judge from there.
      const from = frame === null ? el.scrollLeft : target;
      const canScroll = delta > 0 ? from < maxScroll - 1 : from > 1;
      if (!canScroll) return;

      event.preventDefault();
      el.style.scrollSnapType = "none";
      clearTimeout(restoreTimer);
      const next = Math.min(maxScroll, Math.max(0, from + delta));

      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        el.scrollLeft = next;
        scheduleSnapRestore();
        return;
      }

      target = next;
      if (frame === null) {
        position = el.scrollLeft;
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };

    const onInterrupt = () => stopEasing();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onInterrupt);
    el.addEventListener("touchstart", onInterrupt, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onInterrupt);
      el.removeEventListener("touchstart", onInterrupt);
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(restoreTimer);
      el.style.scrollSnapType = "";
    };
  }, [el]);
}
