import { useEffect } from "react";

const DRAG_THRESHOLD_PX = 5;
/** Pointer samples older than this are ignored when measuring the flick. */
const VELOCITY_WINDOW_MS = 100;
/** A release this long after the last move is a hold, not a flick. */
const RELEASE_STALE_MS = 60;
/** Speed kept per 16 ms frame while gliding; lower stops sooner. */
const FRICTION_PER_FRAME = 0.95;
/** Below this speed (px/ms) a glide stops. */
const MIN_GLIDE_SPEED = 0.02;
const MAX_GLIDE_SPEED = 6;

interface Sample {
  x: number;
  t: number;
}

/**
 * Lets a mouse drag a horizontal rail sideways, as touch already can.
 *
 * A press becomes a drag only once the pointer has moved a few pixels, so a
 * plain click on a card still follows its link; after a real drag the click
 * that ends it is swallowed. Only mouse pointers are handled, since touch and
 * pen scroll the rail natively. Scroll snapping is suspended during the drag
 * and restored when the rail comes to rest, which settles it on the nearest
 * card. While dragging, the rail carries data-dragging for cursor and
 * selection styles.
 *
 * A release that is still moving keeps the rail gliding at the flick's speed,
 * slowing under friction as a touch swipe does, unless the reader prefers
 * reduced motion. A press, touch or wheel on the rail stops the glide, and a
 * press that only stops it does not follow the link under it.
 *
 * Takes the element rather than a ref (pass it from a callback ref held in
 * state), so it attaches to a rail that only renders later, such as the
 * signed-in reader's bookmarks.
 */
export function useDragToScroll(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return;
    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let suppressClick = false;
    let samples: Sample[] = [];
    let glideFrame: number | null = null;

    const restoreSnap = () => {
      el.style.scrollSnapType = "";
    };

    const stopGlide = () => {
      if (glideFrame === null) return false;
      cancelAnimationFrame(glideFrame);
      glideFrame = null;
      restoreSnap();
      return true;
    };

    const glide = (initialVelocity: number) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      let velocity = initialVelocity;
      let position = el.scrollLeft;
      let last = performance.now();

      const step = (now: number) => {
        const dt = Math.max(0, now - last);
        last = now;
        position = Math.min(maxScroll, Math.max(0, position - velocity * dt));
        el.scrollLeft = position;
        velocity *= Math.pow(FRICTION_PER_FRAME, dt / 16);
        const atEdge = position <= 0 || position >= maxScroll;
        if (atEdge || Math.abs(velocity) < MIN_GLIDE_SPEED) {
          glideFrame = null;
          restoreSnap();
          return;
        }
        glideFrame = requestAnimationFrame(step);
      };
      glideFrame = requestAnimationFrame(step);
    };

    /** Pointer speed in px/ms over the last few samples, or 0 if it had come to rest. */
    const releaseVelocity = (now: number) => {
      const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
      if (recent.length < 2) return 0;
      const first = recent[0];
      const last = recent[recent.length - 1];
      if (now - last.t > RELEASE_STALE_MS || last.t === first.t) return 0;
      const v = (last.x - first.x) / (last.t - first.t);
      return Math.max(-MAX_GLIDE_SPEED, Math.min(MAX_GLIDE_SPEED, v));
    };

    const prefersReducedMotion = () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const onPointerDown = (event: PointerEvent) => {
      const stoppedGlide = stopGlide();
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = el.scrollLeft;
      dragging = false;
      suppressClick = stoppedGlide;
      samples = [{ x: event.clientX, t: performance.now() }];
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
      const now = performance.now();
      samples.push({ x: event.clientX, t: now });
      samples = samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
    };

    const endDrag = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      suppressClick = true;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      delete el.dataset.dragging;

      const velocity = event.type === "pointerup" ? releaseVelocity(performance.now()) : 0;
      samples = [];
      if (Math.abs(velocity) >= MIN_GLIDE_SPEED && !prefersReducedMotion()) {
        glide(velocity);
      } else {
        restoreSnap();
      }
    };

    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    // Links and images start a native drag-and-drop that would steal the gesture.
    const onDragStart = (event: DragEvent) => event.preventDefault();

    const onInterrupt = () => {
      stopGlide();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("click", onClick, true);
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("wheel", onInterrupt, { passive: true });
    el.addEventListener("touchstart", onInterrupt, { passive: true });
    return () => {
      stopGlide();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("wheel", onInterrupt);
      el.removeEventListener("touchstart", onInterrupt);
      el.style.scrollSnapType = "";
      delete el.dataset.dragging;
    };
  }, [el]);
}
