import { useSyncExternalStore } from "react";

/**
 * Where the app bar's bottom edge currently is, in viewport pixels.
 *
 * The app bar is position: sticky inside a body that is height: 100%, so on
 * a long page it stays pinned for the first viewport height and then scrolls
 * away with the body box. Fixed elements that hang from its seam (the loading
 * rail, the warm-up ribbon) read this value so they can follow the bar and
 * clamp at the top of the viewport once it has gone.
 *
 * One frame-throttled scroll/resize listener serves every subscriber, and it
 * is attached only while someone is subscribed. null means "not measured yet",
 * so consumers can fall back to their CSS default (--header-height).
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let bottom: number | null = null;
let frame = 0;
let attached = false;

function measure() {
  frame = 0;
  const bar = document.querySelector<HTMLElement>("[data-app-bar]");
  const next = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
  if (next === bottom) return;
  bottom = next;
  for (const listener of listeners) listener();
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(measure);
}

function attach() {
  if (attached) return;
  attached = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  measure();
}

function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  attach();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) detach();
  };
}

function subscribeInactive(): () => void {
  return () => {};
}

function getSnapshot(): number | null {
  return bottom;
}

function getServerSnapshot(): number | null {
  return null;
}

/**
 * The app bar's bottom edge in viewport pixels, or null before the first
 * measurement. Pass active = false while the caller is hidden so no scroll
 * listener runs for it.
 */
export function useAppBarBottom(active = true): number | null {
  return useSyncExternalStore(
    active ? subscribe : subscribeInactive,
    getSnapshot,
    getServerSnapshot,
  );
}

/** Test-only: forget the last measurement. */
export function resetAppBarOffset(): void {
  detach();
  listeners.clear();
  bottom = null;
}
