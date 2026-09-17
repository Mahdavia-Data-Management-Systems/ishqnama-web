# Frontend handling of API cold starts

Design spec, 2026-09-18. The implementation plan that follows this spec goes in
`plans/frontend-cold-start-handling-plan.md`.

## Context

The API runs on Azure Container Apps with `min_replicas = 0` so the project stays at $0. When the
last replica has been removed, the first request pays a cold start. On dev this is observed at
roughly 50 seconds from request to response. The Container Apps ingress queues requests during
that time rather than rejecting them, so a request sent at zero replicas hangs and then succeeds
once the app is up.

`frontend/src/components/api-keep-alive.tsx` pings `GET /api/healthz` on load, on tab visibility
and every 2 minutes, which keeps a warm replica alive but does nothing for the first load. Today
that first load has three problems for the reader:

1. The ping aborts after 30 s, before the API is up, and swallows the result. Nothing in the app
   ever learns that the API arrived, so nothing can react to it.
2. There is no visible change on the page during the wait. The home page shows an empty bookmark
   shelf because the bookmarks GET is queued behind the same cold start. The reader has no way
   to tell "still loading" from "you have no bookmarks" or "the site is broken".
3. Writes made during the wait misbehave. Creating a bookmark shows a generic "Creating..." with
   no timeout. Reader-settings saves fail silently. Worse, if the initial settings GET fails, the
   context marks itself loaded with defaults and the next change the user makes PUTs those
   defaults over their real saved settings.

## Goals

- The app knows when the API is warming, ready or unreachable, from a single source of truth.
- Every reader, signed in or not, sees a friendly explanation of a long wait, and sees it go away
  the moment the API answers.
- Signed-in readers can keep changing settings and bookmarks during the wait without losing work
  or being misled about what was saved.
- A warm API, which answers in well under a second, shows nothing new.
- No backend or infrastructure change, and no cost. `/api/healthz` is already anonymous, skips the
  database and is excluded from the long-lived `Cache-Control` header.

## Non-goals

- Persisting queued writes across a tab close. A settings change queued during warm-up is lost if
  the tab is closed before the API is ready. Accepted.
- An outbox for bookmark creation. The POST needs the server to mint the slug, so creation waits
  visibly instead of being queued.
- Shortening the cold start itself.

## Copy rules

The audience includes readers unfamiliar with technology. User-facing text never says "service",
"API", "server", "backend", "waking up" or "cold start". Waiting states are phrased in terms of
what the reader is getting. The book is spelled "Noor e Imaan", matching the home page.

| State | Where | Text |
|---|---|---|
| warming | ribbon under the app bar | Preparing Noor e Imaan text, this usually takes under a minute |
| unreachable | ribbon under the app bar | Still preparing. Please check your internet connection. (button: Try again) |
| warming | sura/ruku/juz placeholder | Preparing Noor e Imaan text, this usually takes under a minute |
| unreachable | sura/ruku/juz placeholder | Still preparing. Please check your internet connection. (existing Try again button) |
| warming | bookmark shelf caption | Your bookmarks will appear shortly |
| unreachable | bookmark shelf caption | Couldn't load your bookmarks yet |
| warming or unreachable | create bookmark dialog helper | Noor e Imaan is getting ready, this may take up to a minute |
| warming, saving | create bookmark button | Creating, please wait |
| create timed out | create bookmark dialog error | Couldn't create the bookmark yet. Please try again. |
| warming | settings sheet status line | Your changes apply now and will be saved shortly |
| unreachable | settings sheet status line | Your changes apply now but couldn't be saved yet |
| warming, settings not yet loaded | settings sheet status line | Loading your saved settings |

## 1. Readiness store and probe

### `frontend/src/lib/api-readiness.ts` (new)

Modelled on `lib/pending-requests.ts`: a module-level value, a `Set` of listeners, and a
`useApiReadiness()` hook built on `useSyncExternalStore` with a server snapshot of `unknown`.

```ts
export type ApiReadiness = "unknown" | "warming" | "ready" | "unreachable";
```

- `unknown`: page just loaded, no probe has answered yet. Consumers behave as today.
- `warming`: the probe has been pending longer than the grace period. Cues turn on, settings
  writes queue.
- `ready`: the probe answered. Consumers flush queues and refetch.
- `unreachable`: the probe hit its long timeout, a network error occurred while online, or the
  browser reports offline. Cues switch to the "still preparing" wording with a retry.

API:

- `markProbeStarted()`: starts a `GRACE_MS = 3_000` timer. When it fires and the state is
  `unknown` or `ready`, the state becomes `warming`. Calling it while a timer is pending is a
  no-op.
- `markProbeSettled(ok: boolean)`: clears the grace timer and sets `ready` or `unreachable`.
  Setting `ready` runs and clears every `onReady` callback, in registration order.
- `markOffline()`: sets `unreachable` and clears the grace timer.
- `onReady(cb: () => void): () => void`: registers a one-shot callback for the next transition
  into `ready` and returns an unregister function. If the state is already `ready` the callback
  is not run; callers check the current state first. This lets contexts register a flush without
  holding React state.
- `requestProbe()`: invokes a probe function registered by the keep-alive component via
  `setProbe(fn)`. The ribbon's Try again button calls it. If no probe is registered it is a no-op.
- `getApiReadiness()` and `useApiReadiness()`.

The store knows nothing about bookmarks, settings or rendering, and decides no timing beyond the
grace period.

### `frontend/src/components/api-keep-alive.tsx` (changed)

The ping becomes the probe. Schedule is unchanged (on load, on tab becoming visible, every
2 minutes while visible, paused while hidden). Changes:

- `KEEP_ALIVE_TIMEOUT_MS` rises from 30 000 to 90 000 so a 50 s cold start resolves instead of
  aborting. The comment explains the observed cold-start duration.
- `ping()` calls `markProbeStarted()` before `getHealth` and `markProbeSettled(true)` on success or
  `markProbeSettled(false)` on any error, including abort, except when the component is being
  disposed (unmount abort must not flip the state).
- When `navigator.onLine === false`, `ping()` calls `markOffline()` instead of returning silently,
  and the component listens for the `online` event to ping immediately.
- While the state is `unreachable`, the next ping is scheduled after `RETRY_MS = 15_000` instead of
  waiting for the 2-minute interval, so a recovering API is noticed quickly. The interval timer
  keeps running; the retry is an extra one-shot timer cleared on success or unmount.
- The component registers its `ping` with `setProbe` on mount and unregisters on unmount, so the
  ribbon's Try again button can trigger it.

The ping is already counted by `beginRequest()`, so the loading rail keeps being driven by the
pending-request counter. The keep-alive is not mounted on the MSAL redirect bridge route, as today,
so the store is never active there.

## 2. App-wide cue

### Rail: `frontend/src/components/global-loading-indicator.tsx` and its CSS module (changed)

Reads `useApiReadiness()` and sets `data-mode="warming"` on the rail element while the state is
`warming` or `unreachable`; otherwise the attribute is absent. In warming mode the CSS replaces
the fast gleam sweep with a slow breathing opacity pulse of the gold hairline, about a 2.4 s cycle,
using the existing tokens. Under `prefers-reduced-motion: reduce` it is a steady gold line.
Visibility rules (`SHOW_DELAY_MS`, `MIN_VISIBLE_MS`, `LINGER_MS`, `FADE_MS`) are unchanged; only the
rhythm changes. It stays `position: fixed`, `pointer-events: none` and `aria-hidden`.

### Ribbon: `frontend/src/components/api-warmup-notice.tsx` and CSS module (new)

Mounted in `frontend/src/components/app-shell.tsx` next to `GlobalLoadingIndicator`, outside
`AuthProvider`, so it works before MSAL initialises and for anonymous readers. Not rendered on the
redirect bridge route (the existing early return in `AppShell` covers this).

- Renders nothing in `unknown` and `ready`. While fading out after `ready` it keeps the last
  message for the fade duration, then unmounts.
- In `warming`: a bookmark ribbon hanging from the seam under the app bar, centred, `position:
  fixed` at `--header-height` with no gap so it reads as part of the chrome. Gold-wash paper
  (`--gold-wash`), text `--teal-primary` in the display face (`--font-display`, `--text-md`,
  weight 500), a swallowtail bottom edge cut with `clip-path`, and a drop shadow on a wrapper so
  the shadow follows the notch. It unfurls once from behind the bar over `--duration-slow` with
  `--ease-out` and leaves by fading out. No dot and no looping animation: the breathing rail
  directly above it carries the "still working" rhythm, so the two read as one composed object.
- In `unreachable`: the text turns `--gold-label`; the copy changes and a "Try again" text button
  (body face, teal, underlined, min 44 px tap target) sits on its own line under the text and
  calls `requestProbe()`.
- Accessibility: `role="status"`, `aria-live="polite"`, so a screen reader announces each message
  once. Not dismissible: it goes away by itself.
- Phone width: spans the viewport minus 16 px gutters each side, text wraps to two lines.
- Under `prefers-reduced-motion: reduce` the global tokens zero the durations, so the ribbon
  appears and disappears without sliding.

No earlier feedback is shown: the 3 s grace period means a warm API never shows the ribbon, and a
single slow data request never triggers it, because only the probe drives the state.

## 3. Reader settings

### `frontend/src/context/reader-settings-context.tsx` (changed)

**Load state.** The `loaded` boolean becomes
`loadState: "idle" | "loading" | "loaded" | "failed"`. The initial GET keeps no timeout of its own:
the ingress queues it and it resolves when the API wakes. Only a real error or an unmount ends it.
On failure `loadState` becomes `failed` and the context registers an `onReady` callback that
retries the GET. The callback is unregistered on unmount and on sign-out.

**Changes made before the settings arrived.** A `pendingPatchRef: Partial<UserSettingsDto>`
collects only the fields the user changes while `loadState !== "loaded"`. When the GET succeeds
the server settings (or defaults if the server returns `null`) are overlaid with the pending patch,
the merged result is applied to state, and if the patch was non-empty it is PUT immediately and
cleared. The user's choices made during the wait survive, and fields they never touched keep
their saved values.

**Saves while warming.** `persistSettings` reads `getApiReadiness()`:

- In `unknown` or `ready`: debounce 500 ms and PUT `settingsRef.current`, as today.
- In `warming` or `unreachable`: do not send. Set `dirtyRef = true` and, if not already
  registered, register one `onReady` callback that PUTs `settingsRef.current` and clears the flag.
  This avoids a stack of hanging PUTs whose arrival order at the server is not guaranteed.
- A PUT that fails at any time sets `dirtyRef = true` and registers the same flush, so the next
  `ready` transition retries it.

Settings still apply to the page instantly in every state.

**Sync status for the sheet.** The context derives
`syncStatus: "warming" | "unreachable" | "loading" | null` from the readiness state and
`loadState`: `null` when readiness is `unknown` or `ready`; otherwise `loading` when `loadState`
is `loading` or `failed`; otherwise the readiness value (`warming` or `unreachable`). A warm API
therefore never shows a status line, even while its sub-second GET is in flight. It passes
`syncStatus` to `SettingsSheet`.

### `frontend/src/components/settings-sheet.tsx` and CSS module (changed)

New optional prop `syncStatus`. When non-null the sheet renders one quiet line directly under the
title: plain text from the copy table, in `--text-sm` and `--text-secondary`, with no dot or
animation. Absent in `ready`
and `unknown`, so a warm API shows nothing new. The sheet remains a presentational component; the
context decides the status.

## 4. Bookmarks

### `frontend/src/context/bookmarks-context.tsx` (changed)

- `loading: boolean` becomes `status: "idle" | "loading" | "loaded" | "failed"`. `idle` while not
  authenticated.
- The initial GET keeps no timeout. If it fails, `status` becomes `failed` and the context
  registers an `onReady` refetch, unregistered on unmount or sign-out. A GET still pending when
  the API wakes resolves by itself; no refetch is registered for that case.
- `addBookmark` passes an `AbortSignal` that fires after `CREATE_TIMEOUT_MS = 90_000` to
  `createBookmark`, which gains an optional `signal` parameter in `lib/user-api.ts`. If the POST
  resolves after the dialog has closed, the new bookmark is still appended to state.
- `savePosition`, `removeBookmark` and history writes are unchanged: optimistic, and a hanging
  request lands when the API is up.

### Skeleton: `frontend/src/components/bookmark-tile-skeleton.tsx` and CSS module (new)

Same footprint and radius as `BookmarkTile`, drawn as a blank page from the volume: paper
background (`--surface-page`), the site's gold girih lattice from `ornaments.css` at
`--ornament-gold`, and a faint 40 px circle outline where the bookmark's icon will sit.
`aria-hidden`. No shimmer and no animation, so reduced motion needs no special case; the loading
rail carries the motion. A variant prop `variant="row"` matches the history list row height for
the Saved page.

### Home page `frontend/src/app/page.tsx` and Saved page `frontend/src/app/saved/page.tsx` (changed)

- While `status` is `loading` or `failed` and the list is empty, the bookmark grid renders two
  skeleton tiles before the add tile. The add tile stays visible and usable.
- One caption line sits under the grid only while readiness is `warming` or `unreachable`, with
  the copy from the table, in `--text-sm` and `--text-secondary`. Absent otherwise.
- The Saved page's history tab replaces the bare "Loading..." text with three skeleton rows and
  applies the same caption rule.
- The home hero keeps showing the generic card until bookmarks arrive and then switches to
  Continue reading, as it does now.

### Create dialog `frontend/src/components/create-bookmark-dialog.tsx` and CSS module (changed)

- Reads `useApiReadiness()`. While `warming` or `unreachable`, a plain helper line appears above
  the footer before the user presses Create, with the copy from the table.
- Create stays enabled. While saving and the state is `warming` or `unreachable`, the button reads
  "Creating, please wait". In `ready` it reads "Creating..." as today. No dots anywhere in the
  dialog; the loading rail carries the motion.
- The close button and overlay click are never disabled. Closing mid-save leaves the POST running
  in the context.
- Error handling: 409 keeps "A bookmark with this name already exists."; an abort from the 90 s
  timeout shows "Couldn't create the bookmark yet. Please try again."; any other error keeps
  "Failed to create bookmark. Please try again."

## 5. Anonymous reader

`frontend/src/components/scripture/quran-reader-client.tsx` reads `useApiReadiness()` in its
placeholder branch. While `warming` the text under the spinner becomes the warming copy; while
`unreachable` it becomes the unreachable copy. The error branch and its Try again button are
unchanged. The verse hooks (`use-chapter-verses`, `use-ruku-verses`, `use-juz-verses`) are
unchanged: their requests queue at the ingress and resolve when the API wakes.

## Edge cases

- **Tab returns from background** after the app scaled down: the keep-alive already pings on
  visibility, so the probe starts and the cue appears after 3 s.
- **Offline**: `markOffline()` sets `unreachable`; the browser's `online` event triggers a ping.
- **Sign-out during warming**: both contexts gate on `isAuthenticated` and unregister their
  `onReady` callbacks, so nothing flushes for a signed-out user.
- **Routine ping fails while `ready`**: the state becomes `unreachable` and the 15 s retry applies.
  The ribbon appears, which is correct: the API is not answering.
- **Probe succeeds while data requests still hang**: not expected, since the ingress serves all
  routes from the same replica. If it happens, the existing inline loaders cover it.
- **Redirect bridge route**: nothing here is mounted there.

## Testing

The frontend has no test runner today. This work adds Vitest with `@testing-library/react` and
`jsdom` as dev dependencies and an `npm test` script. `pr-validation.yml` is not changed in this
work.

Unit tests, under `frontend/src/**/__tests__/`:

- `api-readiness`: grace timer with fake timers (`unknown` stays `unknown` before 3 s, becomes
  `warming` after); `markProbeSettled(true)` runs and clears `onReady` callbacks once; a settled
  probe cancels the pending grace timer; `markOffline`; `requestProbe` with and without a probe.
- Settings merge: server settings overlaid with a pending patch, with a `null` server response,
  with an empty patch (no PUT), and with a non-empty patch (one PUT of the merged value).
- Settings flush: a change during `warming` sends no PUT, sets dirty, and a single PUT of the
  latest value follows `ready`; a failed PUT retries on the next `ready`.
- Bookmarks: a failed GET refetches on `ready`; a create that resolves after `onClose` still
  appends.

Manual verification against a local delay proxy that holds every response for 50 s, with
`NEXT_PUBLIC_API_URL` pointed at it: home page (ribbon, rail rhythm, skeletons, caption, then tiles),
settings sheet (status line, change during warming, one PUT after ready, saved values preserved),
create dialog (helper line, button state, close mid-save, timeout copy), a sura page as an
anonymous reader, the unreachable path with the proxy stopped, and the reduced-motion variant.

## Files

New:

- `frontend/src/lib/api-readiness.ts`
- `frontend/src/components/api-warmup-notice.tsx`, `api-warmup-notice.module.css`
- `frontend/src/components/bookmark-tile-skeleton.tsx`, `bookmark-tile-skeleton.module.css`
- tests under `frontend/src/**/__tests__/`
- `frontend/vitest.config.ts`

Changed:

- `frontend/src/components/api-keep-alive.tsx`
- `frontend/src/components/global-loading-indicator.tsx`, `.module.css`
- `frontend/src/components/app-shell.tsx`
- `frontend/src/context/reader-settings-context.tsx`
- `frontend/src/components/settings-sheet.tsx`, `.module.css`
- `frontend/src/context/bookmarks-context.tsx`
- `frontend/src/lib/user-api.ts`
- `frontend/src/components/create-bookmark-dialog.tsx`, `.module.css`
- `frontend/src/app/page.tsx`, `page.module.css`
- `frontend/src/app/saved/page.tsx`, `page.module.css`
- `frontend/src/components/scripture/quran-reader-client.tsx`
- `frontend/package.json`
- `CLAUDE.md` (frontend notes on the readiness store, the 90 s probe timeout and the copy rule)
