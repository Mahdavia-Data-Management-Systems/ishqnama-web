import { useEffect } from "react";

const LINE_HEIGHT_PX = 16;
const SNAP_RESTORE_MS = 150;

/**
 * Lets a vertical mouse wheel scroll a horizontal rail, handing the wheel back
 * to the page once the rail reaches either end, so scrolling down the page
 * pages through the rail and then carries on down.
 *
 * Wheels that already scroll sideways (trackpads, shift+wheel) and pinch-zoom
 * (ctrl+wheel) are left to the browser. Scroll snapping is suspended while
 * the wheel turns, because mandatory snap would pull each small wheel step
 * back to the card it started on, and restored once the wheel rests so the
 * rail settles on a card.
 *
 * Takes the element rather than a ref, for the same reason as useDragToScroll.
 */
export function useWheelToHorizontal(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT_PX : event.deltaY;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const canScroll = delta > 0 ? el.scrollLeft < maxScroll - 1 : el.scrollLeft > 1;
      if (!canScroll) return;

      event.preventDefault();
      el.style.scrollSnapType = "none";
      el.scrollLeft += delta;
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        el.style.scrollSnapType = "";
      }, SNAP_RESTORE_MS);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(restoreTimer);
      el.style.scrollSnapType = "";
    };
  }, [el]);
}
