# Frontend sign-in prompt for account-only features

Design spec, 2026-09-23. The implementation plan that follows this spec goes in
`plans/frontend-sign-in-prompt-plan.md`.

## Context

The reader is open to anonymous users. Reading settings, bookmarks, favourites, reading history
and search need an account, because they are stored per user in Cosmos DB or protected against
abuse. Today the frontend handles an anonymous reader differently at each of these points:

1. The reading-settings gear in `frontend/src/components/reader-toolbar.tsx` is wrapped in
   `AuthenticatedTemplate`, so anonymous readers never see it. The user menu shows only a
   "Sign in" button when anonymous, so there is no other way to reach the settings sheet.
2. "Saved" carries an `authOnly` flag in `frontend/src/components/navigation/app-bar.tsx` and
   `bottom-nav.tsx`, and both filter it out when anonymous. A direct visit to `/saved/` goes
   through `ProtectedRoute` (`MsalAuthenticationTemplate` with `InteractionType.Redirect`), which
   sends the reader to Entra immediately.
3. The bookmark button on a verse, in both the continuous-mode block and the verse popup, renders
   for everyone, but `handleBookmarkVerse` in
   `frontend/src/components/scripture/quran-reader-client.tsx` returns early when anonymous. The
   click does nothing and nothing explains why.
4. `frontend/src/app/search/page.tsx` replaces the whole page with an `EmptyState` titled
   "Sign in to search" when anonymous.

An anonymous reader therefore cannot discover that settings and a saved library exist, and gets
no feedback when they try to bookmark. The owner also expects more account-only features in
future and wants one prompt they can all reuse rather than a new hidden-or-silent state each time.

## Goals

- Every account-only control is visible to every reader.
- When an anonymous reader invokes one, a single shared sign-in prompt opens with one line that
  says what signing in unlocks, in plain words, and a "Sign in" action.
- Adding a future account-only feature takes one line of copy and one hook call at the call site.
- Sign-in stays the existing MSAL redirect flow. After sign-in the reader lands back on the same
  page, signed in. Nothing is replayed.
- No backend or infrastructure change, and no cost.

## Non-goals

- Resuming the attempted action after sign-in (opening the settings sheet, saving the bookmark,
  running the search). The reader taps once more; Saved and Search simply work on return.
- Changing how a signed-in reader's expired session is renewed. `ProtectedRoute` keeps that job.
- Showing the home page Bookmarks shelf to anonymous readers, or promoting tafseer to anonymous
  readers. Both stay as they are.
- Any change to the user menu when anonymous. It keeps its plain "Sign in" button.
- A popup-window sign-in, a Backend-for-Frontend, or any MSAL configuration change.

## Design

### Provider and hooks

`frontend/src/context/sign-in-prompt-context.tsx` exports `SignInPromptProvider` and two hooks.
The provider holds `{ open: boolean; feature: SignInFeature | null }` and renders the sheet
(below) exactly once. It is mounted in `frontend/src/components/app-shell.tsx` inside
`AuthProvider` and outside `ReaderSettingsProvider`, so every provider, page and component below
it can gate.

```ts
export type SignInFeature = "settings" | "saved" | "bookmark" | "search";

interface SignInPromptContextValue {
  isOpen: boolean;
  feature: SignInFeature | null;
  /** True once MSAL has finished starting up or handling a redirect (inProgress === None). */
  authSettled: boolean;
  promptSignIn: (feature: SignInFeature) => void;
  dismiss: () => void;
}

export function useSignInPrompt(): SignInPromptContextValue;

/**
 * Returns gate(action): runs action and returns true when signed in; otherwise opens the
 * prompt for `feature`, does not run action, and returns false.
 */
export function useSignInGate(feature: SignInFeature): (action: () => void) => boolean;
```

`useSignInGate` reads `useIsAuthenticated()` itself, so a call site never checks auth. It does
not wait for `authSettled`: a click while MSAL is still starting is unlikely, and opening the
prompt in that case is harmless because the sheet closes itself the moment `isAuthenticated`
becomes true.

`authSettled` is `useMsal().inProgress === InteractionStatus.None`. Pages that prompt on
arrival (Saved) must wait for it, or a returning reader whose redirect is still being handled
sees the prompt flash before their session loads.

Signing in is `instance.loginRedirect(loginRequest)`, the same call `user-menu.tsx` makes. If it
rejects (for example an interaction is already in progress), the sheet stays open and nothing
else happens; MSAL logs the error through the existing logger callback.

### Copy

`frontend/src/config/sign-in-copy.ts` holds every user-facing string of the feature:

```ts
export const SIGN_IN_COPY: Record<SignInFeature, { title: string; body: string }> = {
  settings: {
    title: "Sign in to keep your reading settings",
    body: "Choose how Noor e Imaan reads for you, saved for later.",
  },
  saved: {
    title: "Sign in to see your bookmarks",
    body: "Your bookmarks, favourites and reading history live here.",
  },
  bookmark: {
    title: "Sign in to bookmark this ayah",
    body: "Mark your place and return to it from any device.",
  },
  search: {
    title: "Sign in to search",
    body: "Search the tarjuma and tafseer of Noor e Imaan.",
  },
};

export const SIGN_IN_LABEL = "Sign in";
export const NOT_NOW_LABEL = "Not now";
export const SIGN_IN_CREDIT = "Sign in provided by Mahdavia Data Management System";
```

Rules, from `frontend/plans/design-system.md` and the readiness copy: sentence case, under twelve
words per string, one fact and one action, no emoji, and none of the words "service", "API",
"server", "account", "log in", "authenticate" or "session". A unit test enforces the banned words,
the word limit and sentence case so future features cannot drift. The inline empty states on
Saved and Search reuse the same title and body, so each feature's wording exists once.

### The sheet

`frontend/src/components/sign-in-prompt-sheet.tsx` with `sign-in-prompt-sheet.module.css`. It
takes `{ isOpen, feature, onSignIn, onClose }` and renders nothing when closed.

Form: the same as `frontend/src/components/scripture/share-verse-sheet.tsx`. A full-width bottom
sheet on phones with the rise animation, a centred card from 600 px up, `--surface-overlay`
backdrop, `--surface-card` body, `--radius-lg`, `--shadow-modal`, `z-index: 300`, bottom padding
that respects `env(safe-area-inset-bottom)`, animation disabled under
`prefers-reduced-motion: reduce`.

Layout, top to bottom:

1. The Ishqnama mark (`/logo-ishqnama.svg`, the teal mark the footer uses; the gold mark is
   invisible on `--gold-wash`) inside a `--gold-wash` circle.
2. The feature title, display serif, `--text-xl`, `--text-primary`.
3. The body line, body sans, `--text-sm`, `--text-secondary`.
4. A primary `Button` labelled `SIGN_IN_LABEL`, full width on phones.
5. A ghost `Button` labelled `NOT_NOW_LABEL` beneath it.
6. A muted credit line with the MDMS mark (`/images/mdms-mark.webp`) and `SIGN_IN_CREDIT`,
   `--text-xs`, `--text-secondary`, so the reader is not surprised by the MDMS branded sign-in page.

Behaviour, copied from the share sheet: `role="dialog"`, `aria-modal="true"`,
`aria-labelledby` pointing at the title, focus moves to the sheet on open and back to the
previously focused element on close, Escape, backdrop click, the close button and "Not now" all
call `onClose`, and `document.body.style.overflow` is locked while open. Tab and Shift+Tab cycle
within the sheet while it is open, and the sheet scrolls inside a 90dvh cap on short viewports.
The frontend-design skill is used at implementation to settle the mark size, spacing and type
sizes within this structure, not to change the structure.

### Call sites

**Reading settings gear**, `frontend/src/components/reader-toolbar.tsx`. Remove the
`AuthenticatedTemplate` wrapper and its comment so the gear renders for everyone. The click
becomes `gate(openSettings)` with `useSignInGate("settings")`. The settings sheet is still only
rendered for signed-in readers by `reader-settings-context.tsx`, and the gate never reaches
`openSettings` when anonymous, so nothing else changes.

**Saved**, `frontend/src/components/navigation/app-bar.tsx`, `bottom-nav.tsx` and
`frontend/src/app/saved/layout.tsx`. Remove the `authOnly` flag from both link tables and the
`if (link.authOnly && !isAuthenticated) return null;` filters, along with the now unused
`useIsAuthenticated` imports. The layout replaces `ProtectedRoute` with a new client component
`frontend/src/components/saved-gate.tsx` with three branches:

| `authSettled` | `isAuthenticated` | Renders |
|---|---|---|
| false | any | the loading view (now reading "One moment", since anonymous readers reach it too), moved out of `protected-route.tsx` so both can use it |
| true | false | the page shell: `SectionHeading` with eyebrow "Your library" and title "Saved", then `EmptyState` (icon `bookmark`, title and body from `SIGN_IN_COPY.saved`, action "Sign in" that calls `promptSignIn("saved")`); an effect calls `promptSignIn("saved")` once on the first render of this branch |
| true | true | `<ProtectedRoute>{children}</ProtectedRoute>` exactly as today, keeping silent renewal and the "Sign in again" error state for expired sessions |

`ProtectedRoute` must not mount while auth is unsettled. `MsalAuthenticationTemplate` starts its
own login the moment `inProgress` becomes `None` with no account, which would race the second
branch and redirect the reader without ever showing the prompt.

**Bookmark on a verse**, `frontend/src/components/scripture/quran-reader-client.tsx`. Both the
continuous-mode `AyahBlock` and the verse popup already call `handleBookmarkVerse`. Its
`if (!isAuthenticated) return;` is replaced by wrapping the existing body in `gate(...)` from
`useSignInGate("bookmark")`. That guard was the component's only use of `useIsAuthenticated`, so
the hook call and its import go too (the reading-position save lives in the page loaders).

**Search**, `frontend/src/app/search/page.tsx`. Remove the anonymous early return and the direct
`useMsal`/`loginRequest` imports it needed. The heading, tabs and field render for everyone. When
anonymous:

- the debounced search effect keeps its `!isAuthenticated` guard, so no request is made;
- typing into the field is intercepted: the `SearchField` `onChange` handler ignores the new
  value when anonymous (the character never appears, `query` stays empty) and calls
  `promptSignIn("search")` instead. Every attempt prompts; there is no once-per-visit ref,
  because nothing is ever typed and the open sheet takes focus away from the field, so an
  attempt is one keystroke, not a stream of them;
- the results area renders `EmptyState` (icon `logIn`, title and body from
  `SIGN_IN_COPY.search`, action "Sign in" that calls `promptSignIn("search")`).

There is no prompt on arrival at `/search/`. After sign-in the reader returns to `/search/` with
an empty field. (Revised 2026-09-23 from "prompt once on the first typed character, which stays
in the field" at the owner's request: the gated action must not partially happen.)

### Adding a future account-only feature

1. Add the feature name to `SignInFeature` and its title and body to `SIGN_IN_COPY`.
2. At the call site, `const gate = useSignInGate("<feature>")` and wrap the action:
   `onClick={() => gate(doTheThing)}`.
3. For a page that should prompt on arrival, read `authSettled` and `promptSignIn` from
   `useSignInPrompt()` and follow the Saved gate's three branches.

Never hide the control from anonymous readers and never let a click do nothing.

### Documentation

`CLAUDE.md` (repository root) gains a short **Sign-in prompt** bullet under the Frontend section
describing the provider, the gate hook, the copy file and the rule above, and the "Protected
pages" bullet is updated: `/saved/` is no longer bounced to sign-in, it shows the prompt over a
page shell, and `/search/` swallows anonymous keystrokes and prompts instead.

## Files

New:

- `frontend/src/context/sign-in-prompt-context.tsx`
- `frontend/src/config/sign-in-copy.ts`
- `frontend/src/components/sign-in-prompt-sheet.tsx`, `.module.css`
- `frontend/src/components/saved-gate.tsx`
- `frontend/src/components/auth-loading.tsx` (the spinner moved out of `protected-route.tsx`)
- tests listed below

Changed:

- `frontend/src/components/app-shell.tsx` (mount the provider)
- `frontend/src/components/reader-toolbar.tsx`
- `frontend/src/components/navigation/app-bar.tsx`, `bottom-nav.tsx`
- `frontend/src/app/saved/layout.tsx`
- `frontend/src/components/protected-route.tsx` (import the moved loading view)
- `frontend/src/components/scripture/quran-reader-client.tsx`
- `frontend/src/app/search/page.tsx`
- `CLAUDE.md`

## Testing

Unit tests with Vitest and jsdom, mocking `@azure/msal-react` per file as
`frontend/src/context/__tests__/bookmarks-context.test.tsx` does:

- `src/context/__tests__/sign-in-prompt-context.test.tsx`: `gate` runs the action and returns
  true when signed in; anonymous, it does not run the action, opens the sheet showing that
  feature's title and returns false. `promptSignIn` opens and `dismiss` closes. Re-rendering with
  the auth mock flipped to signed in closes an open sheet. "Sign in" calls `loginRedirect` with
  `loginRequest`. `authSettled` follows `inProgress`.
- `src/components/__tests__/sign-in-prompt-sheet.test.tsx`: dialog role and labelling, focus
  moves in on open and returns on close, Escape, backdrop click, close button and "Not now" each
  call `onClose`, body overflow is locked while open and released on close, nothing renders when
  closed.
- `src/config/__tests__/sign-in-copy.test.ts`: every title and body has no banned word, fewer
  than twelve words, starts with a capital letter and is not written in capitals throughout
  (proper names such as "Noor e Imaan" keep their capitals).
- `src/components/__tests__/saved-gate.test.tsx`: the three branches, and the arrival prompt fires
  exactly once across re-renders.
- `src/app/search/__tests__/search-anonymous.test.tsx`: renders the page anonymous with
  `@/lib/api` mocked; a keystroke leaves the field empty and opens the sheet, dismissing and
  typing again opens it again, and no search request is made.
- `src/components/__tests__/reader-toolbar.test.tsx`: the gear renders for an anonymous reader and
  its click opens the prompt rather than calling `openSettings`.

Manual pass on the dev server before finishing: each of the four triggers at phone width and on
desktop; sign in from the sheet and confirm the reader returns to the same page signed in; a
return to `/saved/` shows the spinner then the page with no anonymous flash; keyboard-only use of
the sheet; reduced motion. Then `npm run lint`, `npm test` and `npm run build` in `frontend/`.
