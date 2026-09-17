import { useSyncExternalStore } from "react";

/**
 * Whether the scale-to-zero API is answering.
 *
 * The keep-alive ping in components/api-keep-alive.tsx is the probe: it calls
 * markProbeStarted() before GET /api/healthz and markProbeSettled() when the
 * call resolves or fails. This store turns that into one value the whole app
 * can read:
 *
 *  - "unknown":     no probe has answered yet; consumers behave as normal.
 *  - "warming":     the probe has been pending longer than GRACE_MS, which on
 *                   a cold start (~50 s observed on dev) means the Container
 *                   App is booting. Cues turn on, settings saves queue.
 *  - "ready":       the probe answered. Consumers flush queues and refetch.
 *  - "unreachable": the probe failed, timed out or the browser is offline.
 *
 * The store decides no timing beyond the grace period and knows nothing about
 * bookmarks, settings or rendering.
 */
export type ApiReadiness = "unknown" | "warming" | "ready" | "unreachable";

/** How long a probe may hang before the wait is shown. A warm API answers in well under a second. */
export const GRACE_MS = 3_000;

type Listener = () => void;

let state: ApiReadiness = "unknown";
const listeners = new Set<Listener>();
const readyCallbacks = new Set<() => void>();
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let probe: (() => void) | null = null;

function setState(next: ApiReadiness) {
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener();
}

function clearGraceTimer() {
  if (graceTimer !== null) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
}

/** Call just before the probe request is sent. Starts the grace timer once. */
export function markProbeStarted(): void {
  if (graceTimer !== null) return;
  graceTimer = setTimeout(() => {
    graceTimer = null;
    if (state === "unknown" || state === "ready") setState("warming");
  }, GRACE_MS);
}

/**
 * Call when the probe settles. On success the state becomes "ready" and every
 * onReady callback runs once and is cleared, even if the state was already
 * "ready": a routine ping success is a fine moment to retry a failed save.
 */
export function markProbeSettled(ok: boolean): void {
  clearGraceTimer();
  if (!ok) {
    setState("unreachable");
    return;
  }
  setState("ready");
  const callbacks = [...readyCallbacks];
  readyCallbacks.clear();
  for (const cb of callbacks) cb();
}

/** The browser reports no network; the wait is explained without sending a probe. */
export function markOffline(): void {
  clearGraceTimer();
  setState("unreachable");
}

/**
 * Registers a one-shot callback for the next successful probe. Returns an
 * unregister function. If the state is already "ready" the callback is not
 * run immediately; check getApiReadiness() first if that matters.
 */
export function onReady(cb: () => void): () => void {
  readyCallbacks.add(cb);
  return () => {
    readyCallbacks.delete(cb);
  };
}

/** The keep-alive component registers its ping here so UI can ask for a probe. */
export function setProbe(fn: (() => void) | null): void {
  probe = fn;
}

/** Asks the keep-alive component to ping now. No-op when nothing is registered. */
export function requestProbe(): void {
  probe?.();
}

export function getApiReadiness(): ApiReadiness {
  return state;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): ApiReadiness {
  return "unknown";
}

/** Re-renders the caller whenever the readiness changes. */
export function useApiReadiness(): ApiReadiness {
  return useSyncExternalStore(subscribe, getApiReadiness, getServerSnapshot);
}

/** Test-only: returns the store to its initial state. */
export function resetApiReadiness(): void {
  clearGraceTimer();
  readyCallbacks.clear();
  probe = null;
  setState("unknown");
}
