import { useSyncExternalStore } from "react";

/**
 * Counts in-flight API requests so a single global indicator can react to them.
 *
 * The fetch layer in api-client.ts calls beginRequest() before the network call
 * and the returned function once the body has been read (or the call failed or
 * was aborted). Nothing here knows about timing or rendering: the 300 ms delay
 * and the anti-flicker rules live in the indicator component.
 */

type Listener = () => void;

let pendingCount = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

/** Marks one request as in flight. Call the returned function exactly once when it settles. */
export function beginRequest(): () => void {
  pendingCount += 1;
  notify();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pendingCount -= 1;
    notify();
  };
}

export function getPendingRequestCount(): number {
  return pendingCount;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): number {
  return 0;
}

/** Re-renders the caller whenever the number of in-flight requests changes. */
export function usePendingRequestCount(): number {
  return useSyncExternalStore(subscribe, getPendingRequestCount, getServerSnapshot);
}
