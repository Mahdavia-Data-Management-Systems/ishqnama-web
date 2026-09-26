import { useEffect, type RefObject } from "react";

const DRAG_THRESHOLD_PX = 5;

/**
 * Lets a mouse drag a horizontal rail sideways, as touch already can.
 *
 * A press becomes a drag only once the pointer has moved a few pixels, so a
 * plain click on a card still follows its link; after a real drag the click
 * that ends it is swallowed. Only mouse pointers are handled, since touch and
 * pen scroll the rail natively. Scroll snapping is suspended during the drag
 * and restored on release, which settles the rail on the nearest card. While
 * dragging, the rail carries data-dragging for cursor and selection styles.
 */
export function useDragToScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let suppressClick = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = el.scrollLeft;
      dragging = false;
      suppressClick = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        el.setPointerCapture(event.pointerId);
        el.style.scrollSnapType = "none";
        el.dataset.dragging = "";
      }
      el.scrollLeft = startScroll - dx;
    };

    const endDrag = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      suppressClick = true;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      el.style.scrollSnapType = "";
      delete el.dataset.dragging;
    };

    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    // Links and images start a native drag-and-drop that would steal the gesture.
    const onDragStart = (event: DragEvent) => event.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClick, true);
    el.addEventListener("dragstart", onDragStart);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("dragstart", onDragStart);
      el.style.scrollSnapType = "";
      delete el.dataset.dragging;
    };
  }, [ref]);
}
