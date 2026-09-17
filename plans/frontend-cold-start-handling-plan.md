# Frontend Cold-Start Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontend know when the scale-to-zero API is warming, ready or unreachable, tell the reader in friendly words, and keep signed-in writes (settings, bookmarks) safe during the wait.

**Architecture:** A tiny module-level readiness store (`unknown | warming | ready | unreachable`) is fed by the existing keep-alive ping, which becomes the probe with a 90 s timeout. UI consumers subscribe through a `useSyncExternalStore` hook: the loading rail changes rhythm, a bookmark ribbon hanging from the app bar explains the wait, skeletons replace empty shelves, and the reader placeholder changes its text. Data consumers (reader settings, bookmarks) register one-shot `onReady` callbacks to flush queued saves or refetch.

**Tech Stack:** Next.js 15 (static export), React 19, TypeScript, CSS Modules, MSAL React. Tests: Vitest + React Testing Library + jsdom (added by this plan).

**Spec:** `plans/frontend-cold-start-handling-spec.md`

## Global Constraints

- All work is under `frontend/`. Run every `npm` command from `frontend/`.
- No backend or infrastructure change. No new cost.
- User-facing copy never says "service", "API", "server", "backend", "waking up" or "cold start". The book is spelled "Noor e Imaan". All strings come from `src/config/readiness-copy.ts` (Task 1) and must match the spec's copy table exactly.
- Use existing CSS tokens from `src/app/globals.css` (`--gold`, `--gold-wash`, `--gold-label`, `--teal-primary`, `--teal-accent`, `--surface-card`, `--text-sm`, `--text-secondary`, `--surface-page`, `--font-display`, `--font-body`, `--text-md`, `--radius-md`, `--radius-sm`, `--space-*`, `--duration-normal`, `--duration-slow`, `--ease-out`, `--header-height`, `--ornament-gold`). Do not add new tokens.
- Respect `prefers-reduced-motion: reduce`: no looping animation in that mode (a static fill or steady line instead).
- Timing constants are exact: grace period 3 000 ms, keep-alive timeout 90 000 ms, unreachable retry 15 000 ms, create-bookmark timeout 90 000 ms, settings debounce 500 ms.
- Commit after every task. Commit messages follow the repo's `type(scope): summary` style and contain no tool attribution lines.
- `npm run lint` and `npm test` must pass at the end of every task. `npm run build` must pass at the end of Task 10.

---

## File structure

New files:

| Path | Responsibility |
|---|---|
| `frontend/vitest.config.ts` | Vitest config: jsdom, `@/` alias, automatic JSX |
| `frontend/src/config/readiness-copy.ts` | Every user-facing string for warming/unreachable states |
| `frontend/src/lib/api-readiness.ts` | Readiness store, grace timer, `onReady`, probe hook, `useApiReadiness` |
| `frontend/src/lib/__tests__/api-readiness.test.ts` | Store unit tests |
| `frontend/src/components/__tests__/api-keep-alive.test.tsx` | Probe behaviour tests |
| `frontend/src/components/api-warmup-notice.tsx` + `.module.css` | The bookmark ribbon hanging from the app bar |
| `frontend/src/components/__tests__/api-warmup-notice.test.tsx` | Pill tests |
| `frontend/src/context/__tests__/reader-settings-context.test.tsx` | Settings merge, queue and flush tests |
| `frontend/src/context/__tests__/bookmarks-context.test.tsx` | Bookmarks refetch-on-ready and create tests |
| `frontend/src/components/bookmark-tile-skeleton.tsx` + `.module.css` | Ghost tile / ghost row |
| `frontend/src/components/__tests__/create-bookmark-dialog.test.tsx` | Dialog copy and timeout message tests |

Modified files: `package.json`, `src/components/api-keep-alive.tsx`, `src/components/global-loading-indicator.tsx` + `.module.css`, `src/components/app-shell.tsx`, `src/context/reader-settings-context.tsx`, `src/components/settings-sheet.tsx` + `.module.css`, `src/context/bookmarks-context.tsx`, `src/lib/user-api.ts`, `src/components/create-bookmark-dialog.tsx` + `.module.css`, `src/app/page.tsx` + `page.module.css`, `src/app/saved/page.tsx` + `page.module.css`, `src/components/scripture/quran-reader-client.tsx`, root `CLAUDE.md`.

---

### Task 1: Test runner, copy constants and the readiness store

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/config/readiness-copy.ts`
- Create: `frontend/src/lib/api-readiness.ts`
- Test: `frontend/src/lib/__tests__/api-readiness.test.ts`

**Interfaces:**
- Produces (used by every later task):

```ts
export type ApiReadiness = "unknown" | "warming" | "ready" | "unreachable";
export const GRACE_MS: number;                        // 3000
export function markProbeStarted(): void;
export function markProbeSettled(ok: boolean): void;
export function markOffline(): void;
export function onReady(cb: () => void): () => void;  // returns unregister
export function setProbe(fn: (() => void) | null): void;
export function requestProbe(): void;
export function getApiReadiness(): ApiReadiness;
export function useApiReadiness(): ApiReadiness;
export function resetApiReadiness(): void;            // tests only
```

- [ ] **Step 1: Add the test runner**

From `frontend/`:

```bash
npm install --save-dev vitest@^3.2.4 jsdom@^26.1.0 @testing-library/react@^16.3.0 @testing-library/dom@^10.4.0
```

Then edit `frontend/package.json` `scripts` to add:

```json
"test": "vitest run"
```

Create `frontend/vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
```

Run: `npm test`
Expected: Vitest reports "No test files found" and exits 0 (or exit code 1 with that message; either is fine at this step).

- [ ] **Step 2: Add the copy constants**

Create `frontend/src/config/readiness-copy.ts`:

```ts
/**
 * Every user-facing string shown while the API is warming or unreachable.
 *
 * The audience includes readers unfamiliar with technology, so nothing here
 * says "service", "API", "server", "waking up" or "cold start". States are
 * phrased in terms of what the reader is getting: the text, their bookmarks,
 * their settings. Keep the spelling "Noor e Imaan", as on the home page.
 */

export const WARMING_MESSAGE =
  "Preparing Noor e Imaan text, this usually takes under a minute";
export const UNREACHABLE_MESSAGE =
  "Still preparing. Please check your internet connection.";
export const TRY_AGAIN_LABEL = "Try again";

export const BOOKMARKS_WARMING_MESSAGE = "Your bookmarks will appear shortly";
export const BOOKMARKS_UNREACHABLE_MESSAGE = "Couldn't load your bookmarks yet";

export const CREATE_BOOKMARK_HELPER =
  "Noor e Imaan is getting ready, this may take up to a minute";
export const CREATE_BOOKMARK_WAITING_LABEL = "Creating, please wait";
export const CREATE_BOOKMARK_TIMEOUT_ERROR =
  "Couldn't create the bookmark yet. Please try again.";

export const SETTINGS_WARMING_MESSAGE =
  "Your changes apply now and will be saved shortly";
export const SETTINGS_UNREACHABLE_MESSAGE =
  "Your changes apply now but couldn't be saved yet";
export const SETTINGS_LOADING_MESSAGE = "Loading your saved settings";
```

- [ ] **Step 3: Write the failing store tests**

Create `frontend/src/lib/__tests__/api-readiness.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRACE_MS,
  getApiReadiness,
  markOffline,
  markProbeSettled,
  markProbeStarted,
  onReady,
  requestProbe,
  resetApiReadiness,
  setProbe,
} from "@/lib/api-readiness";

describe("api-readiness store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts unknown", () => {
    expect(getApiReadiness()).toBe("unknown");
  });

  it("stays unknown until the grace period has passed, then becomes warming", () => {
    markProbeStarted();
    vi.advanceTimersByTime(GRACE_MS - 1);
    expect(getApiReadiness()).toBe("unknown");
    vi.advanceTimersByTime(1);
    expect(getApiReadiness()).toBe("warming");
  });

  it("does not become warming when the probe settles before the grace period", () => {
    markProbeStarted();
    vi.advanceTimersByTime(500);
    markProbeSettled(true);
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("ready");
  });

  it("becomes warming again from ready when a later probe hangs", () => {
    markProbeStarted();
    markProbeSettled(true);
    markProbeStarted();
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("warming");
  });

  it("becomes unreachable when the probe fails", () => {
    markProbeStarted();
    markProbeSettled(false);
    expect(getApiReadiness()).toBe("unreachable");
  });

  it("does not flip unreachable to warming on a subsequent hanging probe", () => {
    markProbeStarted();
    markProbeSettled(false);
    markProbeStarted();
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("unreachable");
  });

  it("markOffline sets unreachable and cancels a pending grace timer", () => {
    markProbeStarted();
    markOffline();
    expect(getApiReadiness()).toBe("unreachable");
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("unreachable");
  });

  it("runs onReady callbacks once, in order, when the probe succeeds", () => {
    const calls: string[] = [];
    onReady(() => calls.push("a"));
    onReady(() => calls.push("b"));
    markProbeSettled(true);
    markProbeSettled(true);
    expect(calls).toEqual(["a", "b"]);
  });

  it("does not run an unregistered onReady callback", () => {
    const cb = vi.fn();
    const unregister = onReady(cb);
    unregister();
    markProbeSettled(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not run onReady callbacks on failure", () => {
    const cb = vi.fn();
    onReady(cb);
    markProbeSettled(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it("requestProbe calls the registered probe and is a no-op without one", () => {
    expect(() => requestProbe()).not.toThrow();
    const probe = vi.fn();
    setProbe(probe);
    requestProbe();
    expect(probe).toHaveBeenCalledTimes(1);
    setProbe(null);
    requestProbe();
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, module `@/lib/api-readiness` cannot be resolved.

- [ ] **Step 5: Implement the store**

Create `frontend/src/lib/api-readiness.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 11 tests.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/config/readiness-copy.ts frontend/src/lib/api-readiness.ts frontend/src/lib/__tests__/api-readiness.test.ts
git commit -m "feat(frontend): add an API readiness store and a Vitest test runner"
```

---

### Task 2: Turn the keep-alive ping into the probe

**Files:**
- Modify: `frontend/src/components/api-keep-alive.tsx`
- Test: `frontend/src/components/__tests__/api-keep-alive.test.tsx`

**Interfaces:**
- Consumes: `markProbeStarted`, `markProbeSettled`, `markOffline`, `setProbe` from Task 1; `getHealth(signal)` from `@/lib/api`.
- Produces: no exports change. Behaviour: the ping reports to the store, times out at 90 s, retries every 15 s while unreachable, pings on the `online` event, and registers itself with `setProbe`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/api-keep-alive.test.tsx`:

```tsx
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiKeepAlive from "@/components/api-keep-alive";
import { GRACE_MS, getApiReadiness, requestProbe, resetApiReadiness } from "@/lib/api-readiness";
import { getHealth } from "@/lib/api";

vi.mock("@/lib/api", () => ({ getHealth: vi.fn() }));

type Deferred = { promise: Promise<{ status: string }>; resolve: () => void; reject: (e: unknown) => void };

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ status: string }>((res, rej) => {
    resolve = () => res({ status: "healthy" });
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockedGetHealth = vi.mocked(getHealth);

describe("ApiKeepAlive as the readiness probe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("marks warming after the grace period and ready when the ping resolves", async () => {
    const d = deferred();
    mockedGetHealth.mockReturnValueOnce(d.promise);

    render(<ApiKeepAlive />);
    expect(mockedGetHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GRACE_MS);
    });
    expect(getApiReadiness()).toBe("warming");

    await act(async () => {
      d.resolve();
      await d.promise;
    });
    expect(getApiReadiness()).toBe("ready");
  });

  it("does not abort a ping before 90 seconds", async () => {
    const d = deferred();
    mockedGetHealth.mockReturnValueOnce(d.promise);
    render(<ApiKeepAlive />);
    const signal = mockedGetHealth.mock.calls[0][0] as AbortSignal;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(89_000);
    });
    expect(signal.aborted).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(signal.aborted).toBe(true);
  });

  it("marks unreachable on failure and re-pings after 15 seconds", async () => {
    mockedGetHealth.mockRejectedValueOnce(new Error("network"));
    const second = deferred();
    mockedGetHealth.mockReturnValueOnce(second.promise);

    render(<ApiKeepAlive />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(getApiReadiness()).toBe("unreachable");
    expect(mockedGetHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(mockedGetHealth).toHaveBeenCalledTimes(2);
  });

  it("registers itself so requestProbe triggers a ping", async () => {
    mockedGetHealth.mockRejectedValueOnce(new Error("network"));
    mockedGetHealth.mockReturnValueOnce(deferred().promise);

    render(<ApiKeepAlive />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedGetHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      requestProbe();
    });
    expect(mockedGetHealth).toHaveBeenCalledTimes(2);
  });

  it("marks offline instead of pinging when the browser is offline", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<ApiKeepAlive />);
    expect(mockedGetHealth).not.toHaveBeenCalled();
    expect(getApiReadiness()).toBe("unreachable");
    onLine.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new file FAILS (state stays `unknown`, second ping not sent, abort at 30 s). The Task 1 tests still pass.

- [ ] **Step 3: Rewrite the component**

Replace the whole of `frontend/src/components/api-keep-alive.tsx` with:

```tsx
"use client";

import { useEffect } from "react";
import { getHealth } from "@/lib/api";
import {
  markOffline,
  markProbeSettled,
  markProbeStarted,
  setProbe,
} from "@/lib/api-readiness";

/**
 * Keeps the scale-to-zero API Container App warm while the site is open, and
 * doubles as the probe behind the readiness store in lib/api-readiness.ts.
 *
 * Azure Container Apps removes the last replica after roughly five minutes
 * without requests. On a reading site a user can sit on one page far longer
 * than that, so the next navigation would pay a cold start. This component
 * pings GET /api/healthz on load and every KEEP_ALIVE_INTERVAL_MS while the
 * tab is visible. It pauses when the tab is hidden (so a forgotten background
 * tab does not keep a replica billed) and pings immediately when the tab
 * becomes visible again or the browser comes back online.
 *
 * Every ping reports to the readiness store: started before the request,
 * settled with the outcome. While the store says the API is unreachable the
 * next ping comes after UNREACHABLE_RETRY_MS instead of the full interval, and
 * the store can ask for a ping on demand (the "Try again" button).
 *
 * /api/healthz is the only safe route to ping: it is anonymous, does not touch
 * the database, and is excluded from the long-lived Cache-Control header that
 * every other /api route carries, so each ping actually reaches the origin.
 */

/** Comfortably under the ~300 s ACA scale-in cooldown, with margin for timer jitter. */
const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Cold starts on dev are observed at about 50 s end to end. The ping must
 * outlive one so it can report the API as ready; the ingress queues the
 * request until the replica is up, so waiting is safe.
 */
const KEEP_ALIVE_TIMEOUT_MS = 90_000;

/** While the API is unreachable, probe again this often so recovery is noticed quickly. */
const UNREACHABLE_RETRY_MS = 15_000;

export default function ApiKeepAlive() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let retryId: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;
    let disposed = false;

    const clearRetry = () => {
      if (retryId !== null) {
        clearTimeout(retryId);
        retryId = null;
      }
    };

    const ping = async () => {
      if (disposed || inFlight) return;
      clearRetry();

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        markOffline();
        return;
      }

      const controller = new AbortController();
      inFlight = controller;
      const timeoutId = setTimeout(
        () => controller.abort(),
        KEEP_ALIVE_TIMEOUT_MS,
      );

      markProbeStarted();
      try {
        await getHealth(controller.signal);
        if (!disposed) markProbeSettled(true);
      } catch (err) {
        // Expected during a cold start that outlasts the timeout, or while
        // offline. The store explains the wait; never surface it here.
        console.debug("API keep-alive ping failed:", err);
        if (!disposed) {
          markProbeSettled(false);
          retryId = setTimeout(() => void ping(), UNREACHABLE_RETRY_MS);
        }
      } finally {
        clearTimeout(timeoutId);
        if (inFlight === controller) inFlight = null;
      }
    };

    const start = () => {
      if (intervalId !== null) return;
      void ping();
      intervalId = setInterval(() => void ping(), KEEP_ALIVE_INTERVAL_MS);
    };

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      clearRetry();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    const handleOnline = () => {
      if (document.visibilityState === "visible") void ping();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    setProbe(() => void ping());
    if (document.visibilityState === "visible") start();

    return () => {
      disposed = true;
      setProbe(null);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      stop();
      inFlight?.abort();
    };
  }, []);

  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all files. If the "re-pings after 15 seconds" test is flaky on the microtask flush, replace `await Promise.resolve();` with `await vi.advanceTimersByTimeAsync(0);`.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/api-keep-alive.tsx frontend/src/components/__tests__/api-keep-alive.test.tsx
git commit -m "feat(frontend): make the keep-alive ping the API readiness probe"
```

---

### Task 3: Warming rhythm on the loading rail

**Files:**
- Modify: `frontend/src/components/global-loading-indicator.tsx`
- Modify: `frontend/src/components/global-loading-indicator.module.css`

**Interfaces:**
- Consumes: `useApiReadiness` from Task 1.
- Produces: the rail element carries `data-mode="warming"` while readiness is `warming` or `unreachable`.

- [ ] **Step 1: Read the readiness in the component**

In `frontend/src/components/global-loading-indicator.tsx`:

Add the import after the `usePendingRequestCount` import:

```tsx
import { useApiReadiness } from "@/lib/api-readiness";
```

Inside the component, after `const pending = usePendingRequestCount() > 0;` add:

```tsx
  const readiness = useApiReadiness();
  const warming = readiness === "warming" || readiness === "unreachable";
```

Change the returned root element to:

```tsx
    <div
      className={styles.rail}
      data-state={phase}
      data-mode={warming ? "warming" : undefined}
      aria-hidden="true"
    >
```

Also extend the doc comment's timing list with one line:

```
 *  - while the readiness store says the API is warming or unreachable the
 *    rail carries data-mode="warming" and breathes slowly instead of gleaming,
 *    so a long wait does not look like an ordinary fetch.
```

- [ ] **Step 2: Add the warming styles**

Append to `frontend/src/components/global-loading-indicator.module.css`, before the `@keyframes breathe` block:

```css
/* Warming: the probe has been pending for seconds, so a cold start is under
   way. A travelling gleam would over-promise progress; the rail breathes
   slowly instead; it is the only looping motion in the cold-start UI. */
.rail[data-mode="warming"] .gleam {
  display: none;
}

.rail[data-mode="warming"] .still {
  display: block;
}

.rail[data-mode="warming"]:not([data-state="hidden"]) .still {
  animation: breathe 2.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .rail[data-mode="warming"]:not([data-state="hidden"]) .still {
    animation: none;
    opacity: 1;
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/global-loading-indicator.tsx frontend/src/components/global-loading-indicator.module.css
git commit -m "feat(frontend): breathe the loading rail while the API is warming"
```

---

### Task 4: The warm-up ribbon

**Files:**
- Create: `frontend/src/components/api-warmup-notice.tsx`
- Create: `frontend/src/components/api-warmup-notice.module.css`
- Modify: `frontend/src/components/app-shell.tsx`
- Test: `frontend/src/components/__tests__/api-warmup-notice.test.tsx`

**Interfaces:**
- Consumes: `useApiReadiness`, `requestProbe` from Task 1; `WARMING_MESSAGE`, `UNREACHABLE_MESSAGE`, `TRY_AGAIN_LABEL` from `@/config/readiness-copy`.
- Produces: default export `ApiWarmupNotice`, mounted in `AppShell` next to `GlobalLoadingIndicator`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/api-warmup-notice.test.tsx`:

```tsx
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiWarmupNotice from "@/components/api-warmup-notice";
import { TRY_AGAIN_LABEL, UNREACHABLE_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";
import {
  GRACE_MS,
  markProbeSettled,
  markProbeStarted,
  resetApiReadiness,
  setProbe,
} from "@/lib/api-readiness";

describe("ApiWarmupNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders an empty live region while the API state is unknown", () => {
    render(<ApiWarmupNotice />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
  });

  it("shows the warming message once the probe has hung past the grace period", () => {
    render(<ApiWarmupNotice />);
    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the unreachable message with a Try again button that requests a probe", () => {
    const probe = vi.fn();
    setProbe(probe);
    render(<ApiWarmupNotice />);
    act(() => {
      markProbeStarted();
      markProbeSettled(false);
    });
    expect(screen.getByText(UNREACHABLE_MESSAGE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: TRY_AGAIN_LABEL }));
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("clears the message shortly after the API becomes ready", () => {
    render(<ApiWarmupNotice />);
    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    act(() => {
      markProbeSettled(true);
    });
    // Still visible during the fade-out.
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText(WARMING_MESSAGE)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new file FAILS, module `@/components/api-warmup-notice` cannot be resolved.

- [ ] **Step 3: Create the component**

Create `frontend/src/components/api-warmup-notice.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  TRY_AGAIN_LABEL,
  UNREACHABLE_MESSAGE,
  WARMING_MESSAGE,
} from "@/config/readiness-copy";
import { requestProbe, useApiReadiness } from "@/lib/api-readiness";
import styles from "./api-warmup-notice.module.css";

/**
 * A bookmark ribbon hanging from the app bar that explains a long wait for
 * the API. Gold-wash paper with a swallowtail bottom edge, set in the display
 * face, so it reads as part of the printed volume rather than a toast.
 *
 * Shown only while the readiness store says "warming" or "unreachable", which
 * the store itself delays by a 3 s grace period, so a warm API never shows it.
 * Mounted outside AuthProvider so it works before MSAL initialises and for
 * anonymous readers. Fixed position: it never pushes content. It is not
 * dismissible because it disappears by itself when the API answers. The only
 * motion is a single unfurl from under the bar; the breathing loading rail
 * directly above it carries the "still working" rhythm.
 *
 * The wrapper is always rendered as a polite live region so a screen reader
 * announces each message once when it appears.
 */

/** Matches --duration-normal; how long the fade-out runs before the text is removed. */
const FADE_MS = 200;

type Shown = "warming" | "unreachable";

export default function ApiWarmupNotice() {
  const readiness = useApiReadiness();
  const target: Shown | null =
    readiness === "warming" || readiness === "unreachable" ? readiness : null;

  const [shown, setShown] = useState<Shown | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (target) {
      setShown(target);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const timer = setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [target, shown]);

  const state = !shown ? "hidden" : leaving ? "leaving" : "entered";

  return (
    <div className={styles.layer} role="status" aria-live="polite">
      {shown && (
        <div className={styles.shadow} data-state={state}>
          <div className={styles.ribbon} data-variant={shown}>
            <span className={styles.text}>
              {shown === "unreachable" ? UNREACHABLE_MESSAGE : WARMING_MESSAGE}
            </span>
            {shown === "unreachable" && (
              <button type="button" className={styles.retry} onClick={requestProbe}>
                {TRY_AGAIN_LABEL}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the styles**

Create `frontend/src/components/api-warmup-notice.module.css`:

```css
/* Full-width fixed layer starting exactly at the seam under the app bar, so
   the ribbon hangs from the chrome with no gap. overflow: hidden lets the
   ribbon unfurl from behind the bar; the bottom padding leaves room for the
   drop shadow. The layer takes no pointer events, only the ribbon does. */
.layer {
  position: fixed;
  top: var(--header-height);
  left: 0;
  right: 0;
  z-index: 105; /* above the sticky header (100), below the rail (110) */
  display: flex;
  justify-content: center;
  padding: 0 16px 12px;
  overflow: hidden;
  pointer-events: none;
}

/* clip-path would clip a box-shadow on the ribbon itself, so the shadow sits
   on a wrapper and follows the swallowtail through drop-shadow. */
.shadow {
  max-width: 100%;
  filter: drop-shadow(0 2px 3px rgba(0, 68, 70, 0.18));
  transform: translateY(-100%);
  transition:
    transform var(--duration-slow) var(--ease-out),
    opacity var(--duration-normal) var(--ease-out);
}

.shadow[data-state="entered"] {
  transform: translateY(0);
}

.shadow[data-state="leaving"] {
  opacity: 0;
  transform: translateY(0);
}

/* The ribbon: gold-wash paper, swallowtail bottom edge, display face. */
.ribbon {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
  padding: var(--space-3) var(--space-5) calc(var(--space-3) + 10px);
  background: var(--gold-wash);
  color: var(--teal-primary);
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 500;
  line-height: var(--leading-snug);
  text-align: center;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 10px), 0 100%);
}

.ribbon[data-variant="unreachable"] {
  color: var(--gold-label);
}

.text {
  min-width: 0;
  max-width: 34ch;
}

.retry {
  min-height: 44px;
  margin: calc(-1 * var(--space-2)) 0 calc(-1 * var(--space-3));
  padding: 0 var(--space-2);
  background: none;
  border: none;
  color: var(--teal-primary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.retry:hover {
  color: var(--teal-accent);
}

.retry:focus-visible {
  outline: 2px solid var(--teal-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

@media (max-width: 480px) {
  .ribbon {
    width: 100%;
  }
}
```

Under `prefers-reduced-motion: reduce` the global tokens zero `--duration-slow` and `--duration-normal`, so the unfurl and fade become instant; there is no looping animation here to switch off.

- [ ] **Step 5: Mount it in the app shell**

In `frontend/src/components/app-shell.tsx` add the import after `GlobalLoadingIndicator`:

```tsx
import ApiWarmupNotice from "@/components/api-warmup-notice";
```

and render it right after `<GlobalLoadingIndicator />`:

```tsx
      <ApiKeepAlive />
      <GlobalLoadingIndicator />
      <ApiWarmupNotice />
```

Update the shell's doc comment sentence "no MSAL initialisation, no keep-alive ping, no app chrome" to "no MSAL initialisation, no keep-alive ping or warm-up notice, no app chrome".

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all files.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/api-warmup-notice.tsx frontend/src/components/api-warmup-notice.module.css frontend/src/components/app-shell.tsx frontend/src/components/__tests__/api-warmup-notice.test.tsx
git commit -m "feat(frontend): show a warm-up notice while the API is starting"
```

---

### Task 5: Reader settings: safe load, queued saves, sync status

**Files:**
- Modify: `frontend/src/context/reader-settings-context.tsx`
- Modify: `frontend/src/components/settings-sheet.tsx`
- Modify: `frontend/src/components/settings-sheet.module.css`
- Test: `frontend/src/context/__tests__/reader-settings-context.test.tsx`

**Interfaces:**
- Consumes: `getApiReadiness`, `onReady`, `useApiReadiness` from Task 1; the `SETTINGS_*` strings from `@/config/readiness-copy`.
- Produces:

```ts
// reader-settings-context.tsx
export type SettingsLoadState = "idle" | "loading" | "loaded" | "failed";
export const DEFAULT_SETTINGS: UserSettingsDto;
export function mergeSettings(server: UserSettingsDto | null, patch: Partial<UserSettingsDto>): UserSettingsDto;
// context value is unchanged in shape: mode, lang, fontScale, showTafseer, updateSettings, settingsOpen, openSettings, closeSettings

// settings-sheet.tsx
export type SettingsSyncStatus = "warming" | "unreachable" | "loading" | null;
// new optional prop: syncStatus?: SettingsSyncStatus
```

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/context/__tests__/reader-settings-context.test.tsx`:

```tsx
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReaderSettingsProvider, {
  DEFAULT_SETTINGS,
  mergeSettings,
  useReaderSettings,
} from "@/context/reader-settings-context";
import {
  GRACE_MS,
  markProbeSettled,
  markProbeStarted,
  resetApiReadiness,
} from "@/lib/api-readiness";
import { getUserSettings, saveUserSettings } from "@/lib/user-api";
import type { UserSettingsDto } from "@/types/user";

vi.mock("@azure/msal-react", () => ({ useIsAuthenticated: () => true }));
vi.mock("@/lib/user-api", () => ({
  getUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
}));

const mockedGet = vi.mocked(getUserSettings);
const mockedSave = vi.mocked(saveUserSettings);

const SERVER: UserSettingsDto = { mode: "continuous", lang: "english", fontScale: 3, showTafseer: true };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function wrapper({ children }: { children: ReactNode }) {
  return <ReaderSettingsProvider>{children}</ReaderSettingsProvider>;
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("mergeSettings", () => {
  it("overlays server settings with the pending patch", () => {
    expect(mergeSettings(SERVER, { fontScale: 5 })).toEqual({ ...SERVER, fontScale: 5 });
  });

  it("falls back to defaults when the server has no settings", () => {
    expect(mergeSettings(null, { mode: "continuous" })).toEqual({ ...DEFAULT_SETTINGS, mode: "continuous" });
  });

  it("returns the server settings unchanged for an empty patch", () => {
    expect(mergeSettings(SERVER, {})).toEqual(SERVER);
  });
});

describe("ReaderSettingsProvider sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
    mockedSave.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("applies server settings when the load succeeds and sends nothing", async () => {
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();
    expect(result.current.mode).toBe("continuous");
    expect(result.current.fontScale).toBe(3);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("keeps a change made before the settings arrived and saves the merged result once", async () => {
    const load = deferred<UserSettingsDto | null>();
    mockedGet.mockReturnValueOnce(load.promise);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });

    act(() => result.current.updateSettings({ fontScale: 5 }));
    expect(result.current.fontScale).toBe(5);
    expect(mockedSave).not.toHaveBeenCalled();

    await act(async () => {
      load.resolve(SERVER);
      await load.promise;
    });
    await flush();

    expect(result.current.mode).toBe("continuous");
    expect(result.current.fontScale).toBe(5);
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith({ ...SERVER, fontScale: 5 });
  });

  it("does not overwrite server settings with defaults after a failed load", async () => {
    mockedGet.mockRejectedValueOnce(new Error("network"));
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();

    act(() => result.current.updateSettings({ showTafseer: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mockedSave).not.toHaveBeenCalled();

    act(() => markProbeSettled(true));
    await flush();

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(result.current.mode).toBe("continuous");
    expect(result.current.showTafseer).toBe(false);
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith({ ...SERVER, showTafseer: false });
  });

  it("queues saves while warming and sends one PUT of the latest value on ready", async () => {
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();

    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });

    act(() => result.current.updateSettings({ fontScale: 1 }));
    act(() => result.current.updateSettings({ fontScale: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mockedSave).not.toHaveBeenCalled();

    act(() => markProbeSettled(true));
    await flush();
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith({ ...SERVER, fontScale: 2 });
  });

  it("debounces and sends immediately when ready, and retries a failed PUT on the next ready", async () => {
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();
    act(() => {
      markProbeStarted();
      markProbeSettled(true);
    });

    mockedSave.mockRejectedValueOnce(new Error("network"));
    act(() => result.current.updateSettings({ lang: "hindi" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockedSave).toHaveBeenCalledTimes(1);

    act(() => markProbeSettled(true));
    await flush();
    expect(mockedSave).toHaveBeenCalledTimes(2);
    expect(mockedSave).toHaveBeenLastCalledWith({ ...SERVER, lang: "hindi" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new file FAILS (`mergeSettings` and `DEFAULT_SETTINGS` are not exported; the failed-load test sees a PUT of defaults).

- [ ] **Step 3: Rewrite the context**

Replace the whole of `frontend/src/context/reader-settings-context.tsx` with:

```tsx
"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import SettingsSheet, { type SettingsSyncStatus } from "@/components/settings-sheet";
import type { ReadingMode, TranslationLang } from "@/components/reader-toolbar";
import { DEFAULT_FONT_SIZE_INDEX } from "@/config/reader-config";
import { getApiReadiness, onReady, useApiReadiness } from "@/lib/api-readiness";
import { getUserSettings, saveUserSettings } from "@/lib/user-api";
import type { UserSettingsDto } from "@/types/user";

/**
 * Reader settings, applied instantly in memory and synced to the API for
 * signed-in users.
 *
 * Sync rules, all there to survive an API cold start (see lib/api-readiness.ts):
 *  - The initial GET is never treated as "loaded" unless it succeeds. A failed
 *    GET is retried on the next ready transition, so defaults are never PUT over
 *    the reader's saved values.
 *  - Fields the reader changes before the GET has succeeded are kept in a
 *    pending patch, overlaid on the server settings when they arrive, and then
 *    saved once.
 *  - While the API is warming or unreachable no PUT is sent; the latest value
 *    is flushed once on the next ready transition. A PUT that fails is retried
 *    the same way.
 */

export type SettingsLoadState = "idle" | "loading" | "loaded" | "failed";

export const DEFAULT_SETTINGS: UserSettingsDto = {
  mode: "verse",
  lang: "urdu",
  fontScale: DEFAULT_FONT_SIZE_INDEX,
  showTafseer: false,
};

const SAVE_DEBOUNCE_MS = 500;

/** Server settings (or defaults when the server has none) overlaid with the fields the reader changed before they arrived. */
export function mergeSettings(
  server: UserSettingsDto | null,
  patch: Partial<UserSettingsDto>,
): UserSettingsDto {
  return { ...DEFAULT_SETTINGS, ...(server ?? {}), ...patch };
}

interface ReaderSettingsContextValue {
  mode: ReadingMode;
  lang: TranslationLang;
  fontScale: number;
  showTafseer: boolean;
  updateSettings: (patch: Partial<UserSettingsDto>) => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const ReaderSettingsContext = createContext<ReaderSettingsContextValue | null>(null);

export function useReaderSettings() {
  const ctx = useContext(ReaderSettingsContext);
  if (!ctx) {
    throw new Error("useReaderSettings must be used within a ReaderSettingsProvider");
  }
  return ctx;
}

export default function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const readiness = useApiReadiness();

  const [settings, setSettings] = useState<UserSettingsDto>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadState, setLoadStateValue] = useState<SettingsLoadState>("idle");

  // Refs mirror state synchronously so callbacks and timers always read the latest values.
  const settingsRef = useRef<UserSettingsDto>(DEFAULT_SETTINGS);
  const loadStateRef = useRef<SettingsLoadState>("idle");
  const pendingPatchRef = useRef<Partial<UserSettingsDto>>({});
  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unregisterFlushRef = useRef<(() => void) | null>(null);
  const sendRef = useRef<(value: UserSettingsDto) => void>(() => {});

  const setLoadState = useCallback((next: SettingsLoadState) => {
    loadStateRef.current = next;
    setLoadStateValue(next);
  }, []);

  const applySettings = useCallback((next: UserSettingsDto) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  // Registers one flush of the latest settings for the next time the API is ready.
  const scheduleFlushOnReady = useCallback(() => {
    if (unregisterFlushRef.current) return;
    unregisterFlushRef.current = onReady(() => {
      unregisterFlushRef.current = null;
      if (dirtyRef.current) sendRef.current(settingsRef.current);
    });
  }, []);

  const send = useCallback(
    (value: UserSettingsDto) => {
      dirtyRef.current = false;
      saveUserSettings(value).catch(() => {
        dirtyRef.current = true;
        scheduleFlushOnReady();
      });
    },
    [scheduleFlushOnReady],
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Load settings from the API when authenticated; retry a failed load on ready.
  useEffect(() => {
    if (!isAuthenticated) {
      setLoadState("idle");
      pendingPatchRef.current = {};
      dirtyRef.current = false;
      unregisterFlushRef.current?.();
      unregisterFlushRef.current = null;
      return;
    }

    const controller = new AbortController();
    let unregisterRetry: (() => void) | null = null;
    let cancelled = false;

    const load = () => {
      setLoadState("loading");
      getUserSettings(controller.signal)
        .then((server) => {
          if (cancelled) return;
          const patch = pendingPatchRef.current;
          pendingPatchRef.current = {};
          const merged = mergeSettings(server, patch);
          applySettings(merged);
          setLoadState("loaded");
          if (Object.keys(patch).length > 0) send(merged);
        })
        .catch(() => {
          if (cancelled) return;
          setLoadState("failed");
          unregisterRetry = onReady(() => {
            unregisterRetry = null;
            load();
          });
        });
    };
    load();

    return () => {
      cancelled = true;
      controller.abort();
      unregisterRetry?.();
    };
  }, [isAuthenticated, applySettings, send, setLoadState]);

  // Clear timers and callbacks on unmount.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      unregisterFlushRef.current?.();
    },
    [],
  );

  const persistSettings = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const current = getApiReadiness();
    if (current === "warming" || current === "unreachable") {
      dirtyRef.current = true;
      scheduleFlushOnReady();
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      send(settingsRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [scheduleFlushOnReady, send]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettingsDto>) => {
      const defined: Partial<UserSettingsDto> = {};
      if (patch.mode !== undefined) defined.mode = patch.mode;
      if (patch.lang !== undefined) defined.lang = patch.lang;
      if (patch.fontScale !== undefined) defined.fontScale = patch.fontScale;
      if (patch.showTafseer !== undefined) defined.showTafseer = patch.showTafseer;

      applySettings({ ...settingsRef.current, ...defined });

      if (!isAuthenticated) return;
      if (loadStateRef.current !== "loaded") {
        pendingPatchRef.current = { ...pendingPatchRef.current, ...defined };
        return;
      }
      persistSettings();
    },
    [isAuthenticated, applySettings, persistSettings],
  );

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  let syncStatus: SettingsSyncStatus = null;
  if (isAuthenticated && (readiness === "warming" || readiness === "unreachable")) {
    syncStatus = loadState === "loading" || loadState === "failed" ? "loading" : readiness;
  }

  const mode = settings.mode as ReadingMode;
  const lang = settings.lang as TranslationLang;
  const { fontScale, showTafseer } = settings;

  return (
    <ReaderSettingsContext.Provider
      value={{
        mode,
        lang,
        fontScale,
        showTafseer,
        updateSettings,
        settingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
      {isAuthenticated && (
        <SettingsSheet
          isOpen={settingsOpen}
          onClose={closeSettings}
          mode={mode}
          onModeChange={(m) => updateSettings({ mode: m })}
          lang={lang}
          onLangChange={(l) => updateSettings({ lang: l })}
          fontScale={fontScale}
          onFontScaleChange={(s) => updateSettings({ fontScale: s })}
          showTafseer={showTafseer}
          onTafseerChange={(t) => updateSettings({ showTafseer: t })}
          syncStatus={syncStatus}
        />
      )}
    </ReaderSettingsContext.Provider>
  );
}
```

- [ ] **Step 4: Add the status line to the sheet**

In `frontend/src/components/settings-sheet.tsx`:

Add the import:

```tsx
import {
  SETTINGS_LOADING_MESSAGE,
  SETTINGS_UNREACHABLE_MESSAGE,
  SETTINGS_WARMING_MESSAGE,
} from "@/config/readiness-copy";
```

Add the exported type above the props interface:

```tsx
/** Why a change may not be saved yet; null when nothing needs saying. */
export type SettingsSyncStatus = "warming" | "unreachable" | "loading" | null;

const SYNC_MESSAGES: Record<Exclude<SettingsSyncStatus, null>, string> = {
  warming: SETTINGS_WARMING_MESSAGE,
  unreachable: SETTINGS_UNREACHABLE_MESSAGE,
  loading: SETTINGS_LOADING_MESSAGE,
};
```

Add to `SettingsSheetProps`:

```tsx
  syncStatus?: SettingsSyncStatus;
```

Destructure `syncStatus = null` in the component parameters. Then change the header block so the title and status line stack:

```tsx
        <div className={styles.header}>
          <div className={styles.headingGroup}>
            <h2 className={styles.title}>Reading settings</h2>
            {syncStatus && (
              <p className={styles.syncStatus} role="status">
                {SYNC_MESSAGES[syncStatus]}
              </p>
            )}
          </div>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
```

- [ ] **Step 5: Style the status line**

In `frontend/src/components/settings-sheet.module.css`, after the `.title` rule add:

```css
.headingGroup {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

/* One quiet line under the title while a change cannot be saved yet. Plain
   text: the loading rail carries the motion, this only carries the words. */
.syncStatus {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all files.

Run: `npm run lint`
Expected: no errors. If `react-hooks/exhaustive-deps` flags the load effect, the dependency list `[isAuthenticated, applySettings, send, setLoadState]` is complete; do not silence the rule, fix the list.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/context/reader-settings-context.tsx frontend/src/components/settings-sheet.tsx frontend/src/components/settings-sheet.module.css frontend/src/context/__tests__/reader-settings-context.test.tsx
git commit -m "fix(frontend): never overwrite saved reader settings during an API cold start"
```

---

### Task 6: Bookmarks context: status, refetch on ready, create timeout

**Files:**
- Modify: `frontend/src/lib/user-api.ts`
- Modify: `frontend/src/context/bookmarks-context.tsx`
- Test: `frontend/src/context/__tests__/bookmarks-context.test.tsx`

**Interfaces:**
- Consumes: `onReady` from Task 1.
- Produces:

```ts
// user-api.ts
export function createBookmark(title: string, icon: string, signal?: AbortSignal): Promise<UserBookmarkDto>;

// bookmarks-context.tsx
export type BookmarksStatus = "idle" | "loading" | "loaded" | "failed";
// context value: `loading: boolean` is replaced by `status: BookmarksStatus`; everything else unchanged
```

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/context/__tests__/bookmarks-context.test.tsx`:

```tsx
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookmarksProvider, { useBookmarks } from "@/context/bookmarks-context";
import { markProbeSettled, resetApiReadiness } from "@/lib/api-readiness";
import { createBookmark, getUserBookmarks } from "@/lib/user-api";
import type { UserBookmarkDto } from "@/types/user";

vi.mock("@azure/msal-react", () => ({ useIsAuthenticated: () => true }));
vi.mock("@/lib/user-api", () => ({
  getUserBookmarks: vi.fn(),
  createBookmark: vi.fn(),
  updateBookmarkPosition: vi.fn(),
  deleteBookmark: vi.fn(),
}));

const mockedGet = vi.mocked(getUserBookmarks);
const mockedCreate = vi.mocked(createBookmark);

const NAZRA: UserBookmarkDto = {
  slug: "nazra",
  title: "Nazra",
  icon: "book",
  chapterNumber: 1,
  verseNumber: 0,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  return <BookmarksProvider>{children}</BookmarksProvider>;
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("BookmarksProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("reports loading, then loaded with the list", async () => {
    mockedGet.mockResolvedValueOnce([NAZRA]);
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    expect(result.current.status).toBe("loading");
    await flush();
    expect(result.current.status).toBe("loaded");
    expect(result.current.bookmarks).toEqual([NAZRA]);
  });

  it("reports failed after a failed load and refetches on ready", async () => {
    mockedGet.mockRejectedValueOnce(new Error("network"));
    mockedGet.mockResolvedValueOnce([NAZRA]);
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    await flush();
    expect(result.current.status).toBe("failed");
    expect(mockedGet).toHaveBeenCalledTimes(1);

    act(() => markProbeSettled(true));
    await flush();
    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("loaded");
    expect(result.current.bookmarks).toEqual([NAZRA]);
  });

  it("passes an abort signal to createBookmark that fires after 90 seconds", async () => {
    mockedGet.mockResolvedValueOnce([]);
    mockedCreate.mockImplementationOnce(
      (_title, _icon, signal) =>
        new Promise((_, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    await flush();

    let rejection: unknown = null;
    const pending = result.current.addBookmark("Daily", "sun").catch((e) => {
      rejection = e;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    await pending;
    expect((rejection as { name?: string } | null)?.name).toBe("AbortError");
  });

  it("appends a created bookmark even after the caller stopped waiting", async () => {
    mockedGet.mockResolvedValueOnce([]);
    const created: UserBookmarkDto = { ...NAZRA, slug: "daily", title: "Daily", isDefault: false };
    mockedCreate.mockResolvedValueOnce(created);
    const { result } = renderHook(() => useBookmarks(), { wrapper });
    await flush();

    await act(async () => {
      await result.current.addBookmark("Daily", "sun");
    });
    expect(result.current.bookmarks).toEqual([created]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new file FAILS (`status` is undefined, no signal passed to `createBookmark`, no refetch on ready).

- [ ] **Step 3: Accept a signal in `createBookmark`**

In `frontend/src/lib/user-api.ts` replace the `createBookmark` function with:

```ts
export function createBookmark(title: string, icon: string, signal?: AbortSignal): Promise<UserBookmarkDto> {
  return authenticatedApiFetch<UserBookmarkDto>("/user/bookmarks", {
    method: "POST",
    body: { title, icon },
    signal,
  });
}
```

- [ ] **Step 4: Rewrite the context**

Replace the whole of `frontend/src/context/bookmarks-context.tsx` with:

```tsx
"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import { onReady } from "@/lib/api-readiness";
import {
  getUserBookmarks,
  createBookmark as apiCreateBookmark,
  updateBookmarkPosition,
  deleteBookmark as apiDeleteBookmark,
} from "@/lib/user-api";
import type { UserBookmarkDto } from "@/types/user";

/**
 * Bookmarks for the signed-in reader.
 *
 * The initial GET has no timeout: during an API cold start the ingress queues
 * it and it resolves by itself when the replica is up. Only a GET that fails
 * outright marks the list "failed" and registers a refetch for the next ready
 * transition (see lib/api-readiness.ts). Position saves and deletes are
 * optimistic; a hanging request lands when the API is up and a real failure
 * refetches the list. Creating a bookmark needs the server to mint the slug,
 * so it waits, with a long timeout so a hung request eventually reports back.
 */

export type BookmarksStatus = "idle" | "loading" | "loaded" | "failed";

/** Long enough to outlive a ~50 s cold start; the dialog shows a friendly message if it fires. */
const CREATE_TIMEOUT_MS = 90_000;

interface BookmarksContextValue {
  bookmarks: UserBookmarkDto[];
  status: BookmarksStatus;
  savePosition: (slug: string, chapterNumber: number, verseNumber: number) => void;
  addBookmark: (title: string, icon: string) => Promise<UserBookmarkDto>;
  removeBookmark: (slug: string) => void;
  refresh: () => void;
  hasCustomBookmarks: boolean;
}

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) {
    throw new Error("useBookmarks must be used within a BookmarksProvider");
  }
  return ctx;
}

export default function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const [bookmarks, setBookmarks] = useState<UserBookmarkDto[]>([]);
  const [status, setStatus] = useState<BookmarksStatus>("idle");

  /** Resolves true on success, false on failure (including abort). */
  const fetchBookmarks = useCallback(
    (signal?: AbortSignal): Promise<boolean> => {
      if (!isAuthenticated) return Promise.resolve(false);
      setStatus("loading");
      return getUserBookmarks(signal)
        .then((list) => {
          setBookmarks(list);
          setStatus("loaded");
          return true;
        })
        .catch(() => {
          // An abort means we are unmounting or reloading; leave the status alone.
          if (!signal?.aborted) setStatus("failed");
          return false;
        });
    },
    [isAuthenticated],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setBookmarks([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    let unregister: (() => void) | null = null;
    let cancelled = false;

    const load = () => {
      void fetchBookmarks(controller.signal).then((ok) => {
        if (cancelled || ok) return;
        unregister = onReady(() => {
          unregister = null;
          load();
        });
      });
    };
    load();

    return () => {
      cancelled = true;
      controller.abort();
      unregister?.();
    };
  }, [fetchBookmarks, isAuthenticated]);

  const refresh = useCallback(() => {
    void fetchBookmarks();
  }, [fetchBookmarks]);

  const savePosition = useCallback(
    (slug: string, chapterNumber: number, verseNumber: number) => {
      // Optimistic update
      setBookmarks((prev) =>
        prev.map((b) =>
          b.slug === slug
            ? { ...b, chapterNumber, verseNumber, updatedAt: new Date().toISOString() }
            : b,
        ),
      );
      updateBookmarkPosition(slug, chapterNumber, verseNumber).catch(() => {
        // Revert on failure — refresh from server
        void fetchBookmarks();
      });
    },
    [fetchBookmarks],
  );

  const addBookmark = useCallback(
    async (title: string, icon: string): Promise<UserBookmarkDto> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS);
      try {
        const created = await apiCreateBookmark(title, icon, controller.signal);
        setBookmarks((prev) => [...prev, created]);
        return created;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [],
  );

  const removeBookmark = useCallback(
    (slug: string) => {
      // Optimistic remove
      setBookmarks((prev) => prev.filter((b) => b.slug !== slug));
      apiDeleteBookmark(slug).catch(() => {
        void fetchBookmarks();
      });
    },
    [fetchBookmarks],
  );

  const hasCustomBookmarks = bookmarks.some((b) => !b.isDefault);

  return (
    <BookmarksContext.Provider
      value={{ bookmarks, status, savePosition, addBookmark, removeBookmark, refresh, hasCustomBookmarks }}
    >
      {children}
    </BookmarksContext.Provider>
  );
}
```

- [ ] **Step 5: Check nothing still reads `loading` from the context**

Run from `frontend/`:

```bash
grep -rn "useBookmarks()" src --include=*.tsx | grep -v __tests__
```

Expected: `app/page.tsx`, `app/saved/page.tsx` and `components/scripture/quran-reader-client.tsx`, none of which destructure `loading`. If any does, rename it to `status` and compare with `=== "loading"`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/user-api.ts frontend/src/context/bookmarks-context.tsx frontend/src/context/__tests__/bookmarks-context.test.tsx
git commit -m "feat(frontend): refetch bookmarks when the API becomes ready and bound bookmark creation"
```

---

### Task 7: Skeleton tiles and captions on the home and Saved pages

**Files:**
- Create: `frontend/src/components/bookmark-tile-skeleton.tsx`
- Create: `frontend/src/components/bookmark-tile-skeleton.module.css`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/page.module.css`
- Modify: `frontend/src/app/saved/page.tsx`
- Modify: `frontend/src/app/saved/page.module.css`

**Interfaces:**
- Consumes: `status` from Task 6's context; `useApiReadiness` from Task 1; `BOOKMARKS_WARMING_MESSAGE`, `BOOKMARKS_UNREACHABLE_MESSAGE` from `@/config/readiness-copy`.
- Produces: `BookmarkTileSkeleton({ variant?: "tile" | "row" })` default export.

- [ ] **Step 1: Create the skeleton component**

Create `frontend/src/components/bookmark-tile-skeleton.tsx`:

```tsx
import styles from "./bookmark-tile-skeleton.module.css";

interface BookmarkTileSkeletonProps {
  /** "tile" matches BookmarkTile's footprint; "row" matches a history list row. */
  variant?: "tile" | "row";
}

/**
 * A ghost placeholder shown while a signed-in reader's bookmarks or history
 * are still loading, so the layout does not jump when the real items arrive.
 * A blank page from the volume: paper-coloured, carrying the site's own gold
 * girih lattice, with a faint circle where the bookmark's icon will sit. No
 * animation; the loading rail carries the motion. Decorative only: hidden
 * from assistive technology; the page caption and the warm-up notice carry
 * the spoken explanation.
 */
export default function BookmarkTileSkeleton({ variant = "tile" }: BookmarkTileSkeletonProps) {
  return (
    <div className={variant === "row" ? styles.row : styles.tile} aria-hidden="true">
      {variant === "tile" && <span className={styles.mark} />}
    </div>
  );
}
```

Create `frontend/src/components/bookmark-tile-skeleton.module.css`:

```css
/* Same footprint as BookmarkTile and a history row, on paper instead of card
   white, so the real item reads as "printed" when it replaces the ghost. */
.tile,
.row {
  position: relative;
  overflow: hidden;
  background: var(--surface-page);
  border: 1px solid rgba(0, 68, 70, 0.08);
  border-radius: var(--radius-md);
}

/* The girih lattice from ornaments.css, kept at ornament strength. */
.tile::before,
.row::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(0deg, var(--ornament-gold) 0px, var(--ornament-gold) 1px, transparent 1px, transparent 28px),
    repeating-linear-gradient(60deg, var(--ornament-gold) 0px, var(--ornament-gold) 1px, transparent 1px, transparent 28px),
    repeating-linear-gradient(120deg, var(--ornament-gold) 0px, var(--ornament-gold) 1px, transparent 1px, transparent 28px);
}

/* Icon circle + title + position line + padding in BookmarkTile add up to about this. */
.tile {
  min-height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.row {
  height: 56px;
}

/* Where the bookmark's icon circle will sit. */
.mark {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(190, 170, 48, 0.35);
}
```

- [ ] **Step 2: Home page**

In `frontend/src/app/page.tsx`:

Add imports:

```tsx
import BookmarkTileSkeleton from "@/components/bookmark-tile-skeleton";
import { BOOKMARKS_UNREACHABLE_MESSAGE, BOOKMARKS_WARMING_MESSAGE } from "@/config/readiness-copy";
import { useApiReadiness } from "@/lib/api-readiness";
```

Change the destructure and add the derived values right after it:

```tsx
  const { bookmarks, status, addBookmark, removeBookmark } = useBookmarks();
  const readiness = useApiReadiness();
  const [dialogOpen, setDialogOpen] = useState(false);

  const showSkeletons = bookmarks.length === 0 && (status === "loading" || status === "failed");
  const shelfCaption = !showSkeletons
    ? null
    : readiness === "warming"
      ? BOOKMARKS_WARMING_MESSAGE
      : readiness === "unreachable"
        ? BOOKMARKS_UNREACHABLE_MESSAGE
        : null;
```

Replace the bookmark grid block with:

```tsx
            <div className={styles.bookmarkGrid}>
              {showSkeletons && (
                <>
                  <BookmarkTileSkeleton />
                  <BookmarkTileSkeleton />
                </>
              )}
              {customBookmarks.map((b) => (
                <BookmarkTile key={b.slug} bookmark={b} onDelete={removeBookmark} />
              ))}
              <AddBookmarkTile onClick={() => setDialogOpen(true)} />
            </div>
            {shelfCaption && <p className={styles.shelfCaption}>{shelfCaption}</p>}
```

In `frontend/src/app/page.module.css`, after `.bookmarkGrid` add:

```css
.shelfCaption {
  margin: var(--space-3) 0 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
```

- [ ] **Step 3: Saved page**

In `frontend/src/app/saved/page.tsx`:

Add the same three imports as the home page. Change the destructure and add derived values:

```tsx
  const { bookmarks, status, addBookmark, removeBookmark } = useBookmarks();
  const readiness = useApiReadiness();
  const [dialogOpen, setDialogOpen] = useState(false);

  const showBookmarkSkeletons = bookmarks.length === 0 && (status === "loading" || status === "failed");
  const waitingCaption =
    readiness === "warming"
      ? BOOKMARKS_WARMING_MESSAGE
      : readiness === "unreachable"
        ? BOOKMARKS_UNREACHABLE_MESSAGE
        : null;
```

Replace the bookmarks tab grid with:

```tsx
              <div className={styles.bookmarkGrid}>
                {showBookmarkSkeletons && (
                  <>
                    <BookmarkTileSkeleton />
                    <BookmarkTileSkeleton />
                  </>
                )}
                {customBookmarks.map((b) => (
                  <BookmarkTile key={b.slug} bookmark={b} onDelete={removeBookmark} />
                ))}
                <AddBookmarkTile onClick={() => setDialogOpen(true)} />
              </div>
              {showBookmarkSkeletons && waitingCaption && (
                <p className={styles.waitingCaption}>{waitingCaption}</p>
              )}
```

Replace the history `loading` branch:

```tsx
          ) : loading ? (
            <>
              <div className={styles.skeletonList}>
                <BookmarkTileSkeleton variant="row" />
                <BookmarkTileSkeleton variant="row" />
                <BookmarkTileSkeleton variant="row" />
              </div>
              {waitingCaption && <p className={styles.waitingCaption}>{waitingCaption}</p>}
            </>
          ) : !hasItems ? (
```

In `frontend/src/app/saved/page.module.css`, replace the `.loadingText` rule (no longer used) with:

```css
.skeletonList {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.waitingCaption {
  margin: var(--space-3) 0 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bookmark-tile-skeleton.tsx frontend/src/components/bookmark-tile-skeleton.module.css frontend/src/app/page.tsx frontend/src/app/page.module.css frontend/src/app/saved/page.tsx frontend/src/app/saved/page.module.css
git commit -m "feat(frontend): show skeleton bookmarks and a waiting caption during a cold start"
```

---

### Task 8: Create-bookmark dialog during a cold start

**Files:**
- Modify: `frontend/src/components/create-bookmark-dialog.tsx`
- Modify: `frontend/src/components/create-bookmark-dialog.module.css`
- Test: `frontend/src/components/__tests__/create-bookmark-dialog.test.tsx`

**Interfaces:**
- Consumes: `useApiReadiness` from Task 1; `CREATE_BOOKMARK_HELPER`, `CREATE_BOOKMARK_WAITING_LABEL`, `CREATE_BOOKMARK_TIMEOUT_ERROR` from `@/config/readiness-copy`. Props are unchanged.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/__tests__/create-bookmark-dialog.test.tsx`:

```tsx
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateBookmarkDialog from "@/components/create-bookmark-dialog";
import {
  CREATE_BOOKMARK_HELPER,
  CREATE_BOOKMARK_TIMEOUT_ERROR,
  CREATE_BOOKMARK_WAITING_LABEL,
} from "@/config/readiness-copy";
import { GRACE_MS, markProbeStarted, resetApiReadiness } from "@/lib/api-readiness";
import { bookmarkIcons } from "@/config/bookmark-icons";

function fillForm() {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Daily" } });
  fireEvent.click(screen.getByRole("button", { name: bookmarkIcons[0].label }));
}

describe("CreateBookmarkDialog during a cold start", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows no helper line while the API state is unknown", () => {
    render(<CreateBookmarkDialog isOpen onClose={() => {}} onCreate={() => Promise.resolve()} />);
    expect(screen.queryByText(CREATE_BOOKMARK_HELPER)).toBeNull();
  });

  it("shows the helper line and a waiting label while warming", async () => {
    let resolveCreate!: () => void;
    const onCreate = vi.fn(() => new Promise<void>((res) => { resolveCreate = res; }));
    render(<CreateBookmarkDialog isOpen onClose={() => {}} onCreate={onCreate} />);
    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(screen.getByText(CREATE_BOOKMARK_HELPER)).toBeTruthy();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("button", { name: CREATE_BOOKMARK_WAITING_LABEL })).toBeTruthy();
    // The close button stays enabled while saving.
    expect((screen.getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      resolveCreate();
    });
  });

  it("explains a timed-out create in friendly words", async () => {
    const onCreate = vi.fn(() => Promise.reject(new DOMException("Aborted", "AbortError")));
    render(<CreateBookmarkDialog isOpen onClose={() => {}} onCreate={onCreate} />);
    fillForm();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    expect(screen.getByText(CREATE_BOOKMARK_TIMEOUT_ERROR)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: the new file FAILS (no helper text, button says "Creating...", generic error).

- [ ] **Step 3: Update the dialog**

In `frontend/src/components/create-bookmark-dialog.tsx`:

Add imports:

```tsx
import {
  CREATE_BOOKMARK_HELPER,
  CREATE_BOOKMARK_TIMEOUT_ERROR,
  CREATE_BOOKMARK_WAITING_LABEL,
} from "@/config/readiness-copy";
import { useApiReadiness } from "@/lib/api-readiness";
```

Inside the component, after the state declarations add:

```tsx
  const readiness = useApiReadiness();
  const waiting = readiness === "warming" || readiness === "unreachable";
```

In `handleCreate`'s `catch`, replace the branch with:

```tsx
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("A bookmark with this name already exists.");
      } else if ((err as { name?: string } | null)?.name === "AbortError") {
        setError(CREATE_BOOKMARK_TIMEOUT_ERROR);
      } else {
        setError("Failed to create bookmark. Please try again.");
      }
      setSaving(false);
    }
```

Between the closing `</div>` of `styles.body` and the `styles.footer` div, add:

```tsx
        {waiting && <p className={styles.helper}>{CREATE_BOOKMARK_HELPER}</p>}
```

Replace the create button with:

```tsx
          <button className={styles.createBtn} disabled={!canCreate} onClick={handleCreate}>
            {saving ? (waiting ? CREATE_BOOKMARK_WAITING_LABEL : "Creating...") : "Create"}
          </button>
```

Do not touch the close button or the overlay `onClick`; they must stay active while saving.

- [ ] **Step 4: Style the helper line**

Append to `frontend/src/components/create-bookmark-dialog.module.css`:

```css
/* Shown above the footer while the API is still starting, before and during a
   save. Plain text; the loading rail carries the motion. */
.helper {
  margin: 0;
  padding: 0 var(--space-6) var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/create-bookmark-dialog.tsx frontend/src/components/create-bookmark-dialog.module.css frontend/src/components/__tests__/create-bookmark-dialog.test.tsx
git commit -m "feat(frontend): explain the wait in the create-bookmark dialog during a cold start"
```

---

### Task 9: Reader placeholder copy for anonymous readers

**Files:**
- Modify: `frontend/src/components/scripture/quran-reader-client.tsx`

**Interfaces:**
- Consumes: `useApiReadiness` from Task 1; `WARMING_MESSAGE`, `UNREACHABLE_MESSAGE` from `@/config/readiness-copy`.

- [ ] **Step 1: Swap the placeholder text by readiness**

In `frontend/src/components/scripture/quran-reader-client.tsx`:

Add imports:

```tsx
import { UNREACHABLE_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";
import { useApiReadiness } from "@/lib/api-readiness";
```

After `const { bookmarks, savePosition, hasCustomBookmarks } = useBookmarks();` add:

```tsx
  const readiness = useApiReadiness();
  const placeholderText =
    readiness === "warming"
      ? WARMING_MESSAGE
      : readiness === "unreachable"
        ? UNREACHABLE_MESSAGE
        : "Loading verses...";
```

Change the loading placeholder paragraph to:

```tsx
            <p className={styles.placeholderText}>{placeholderText}</p>
```

The error branch and its Try again button stay as they are.

- [ ] **Step 2: Verify**

Run: `npm run lint && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/scripture/quran-reader-client.tsx
git commit -m "feat(frontend): explain a cold start in the reader placeholder"
```

---

### Task 10: Documentation, build and manual verification

**Files:**
- Modify: `CLAUDE.md` (repository root)

- [ ] **Step 1: Update the frontend notes in `CLAUDE.md`**

In the **Frontend** section of the root `CLAUDE.md`:

Replace the **API keep-alive** bullet with:

```
- **API keep-alive and readiness**: `src/components/api-keep-alive.tsx` (mounted in `src/components/app-shell.tsx`, skipped on the redirect bridge route) pings `GET /api/healthz` on load, on tab visibility, on the browser `online` event and every 2 minutes while the tab is visible, pausing when hidden, so the scale-to-zero Container App stays warm while someone is reading. The ping is also the probe behind `src/lib/api-readiness.ts`, a module-level store exposing `unknown | warming | ready | unreachable` through `useApiReadiness()`: `warming` after the ping has hung for 3 s (cold starts take ~50 s on dev, so the ping timeout is 90 s), `ready` when it answers (which runs every `onReady()` callback once), `unreachable` on failure, timeout or offline (then it re-pings every 15 s, and `requestProbe()` pings on demand). `/api/healthz` is the only route safe to ping: it is anonymous, skips the database, and is excluded from the long-lived `Cache-Control` header every other `/api` route carries
- **Cold-start UI**: while the store says `warming` or `unreachable`, the loading rail breathes instead of gleaming, `src/components/api-warmup-notice.tsx` hangs a gold bookmark ribbon from the app bar (the only looping motion is the rail), the reader placeholder and the bookmark shelves (skeletons from `src/components/bookmark-tile-skeleton.tsx`) explain the wait, the settings sheet shows a sync line, and the create-bookmark dialog shows a helper line (its POST has a 90 s abort). `src/context/reader-settings-context.tsx` never treats a failed settings GET as loaded (it retries on `ready`), keeps changes made before the GET succeeded in a pending patch merged over the server values, and queues PUTs while warming, flushing the latest value once on `ready`. `src/context/bookmarks-context.tsx` exposes `status` and refetches a failed GET on `ready`. All copy lives in `src/config/readiness-copy.ts` and must avoid technical words (no "service", "API", "server"); the audience includes readers unfamiliar with technology. Design in `plans/frontend-cold-start-handling-spec.md`
```

In the **Build & Run Commands → Frontend** code block add:

```
npm test          # Vitest unit tests (jsdom)
```

- [ ] **Step 2: Full verification**

From `frontend/`:

```bash
npm run lint && npm test && npm run build
```

Expected: lint clean, all test files pass, `next build` completes the static export into `out/` with no type errors (test files are included in `tsconfig.json`'s `**/*.ts` glob, so they are type-checked here).

- [ ] **Step 3: Manual check against a slow API**

Create a throwaway delay proxy outside the repo (for example in the scratchpad directory), holding every response for 50 s:

```js
// delay-proxy.mjs — node delay-proxy.mjs  (listens on :5090, forwards to :5080)
import http from "node:http";
const DELAY_MS = 50_000;
const target = { host: "localhost", port: 5080 };
http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "http://localhost:3000",
      "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    });
    return res.end();
  }
  setTimeout(() => {
    const upstream = http.request({ ...target, path: req.url, method: req.method, headers: { ...req.headers, host: `${target.host}:${target.port}` } }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  }, DELAY_MS);
}).listen(5090);
```

Run the API (`dotnet run --project backend/src/Ishqnama.Api`), the proxy, and the frontend with `NEXT_PUBLIC_API_URL=http://localhost:5090/api npm run dev`. Then walk through, ticking each:

- [ ] Home page, anonymous: after ~3 s the rail breathes and a gold ribbon unfurls from under the app bar with the warming copy; both vanish when the API answers.
- [ ] Home page, signed in: two skeleton tiles and "Your bookmarks will appear shortly" under the grid; real tiles replace them without the layout jumping.
- [ ] Settings sheet during warming: status line reads "Loading your saved settings" before the GET returns, then the warming copy; change the font size; exactly one PUT appears in the network tab after the API answers, carrying the server's other values.
- [ ] Create bookmark during warming: helper line visible before pressing Create; button reads "Creating, please wait"; close the dialog mid-save; the tile appears when the POST lands.
- [ ] A sura page, anonymous: placeholder reads the warming copy, then the verses render.
- [ ] Stop the proxy: the ribbon switches to the unreachable copy with Try again; start the proxy; Try again (or the 15 s retry) recovers to ready.
- [ ] Enable "reduce motion" in the OS: no looping animation anywhere; rail is a steady line, the ribbon appears without sliding, skeleton tiles are static paper with the gold lattice.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe the API readiness store and cold-start UI"
```
