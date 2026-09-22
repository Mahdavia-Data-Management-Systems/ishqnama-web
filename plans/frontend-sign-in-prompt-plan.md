# Frontend Sign-in Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementation subagents run on **Sonnet** (the owner's choice for this work).

**Goal:** Show every account-only control to every reader and open one shared, reusable sign-in prompt when an anonymous reader invokes it, replacing today's hidden gear, hidden "Saved" link, silent bookmark click and replaced search page.

**Architecture:** A `SignInPromptProvider` mounted in the app shell owns one `SignInPromptSheet` and exposes `useSignInGate(feature)` for click sites and `useSignInPrompt()` for pages that prompt on arrival. All feature copy lives in `src/config/sign-in-copy.ts`. Sign-in stays the existing MSAL `loginRedirect`; nothing is replayed after the redirect.

**Tech Stack:** Next.js 15 (static export), React 19, `@azure/msal-react` v5, CSS modules, Vitest + jsdom + Testing Library.

**Spec:** `plans/frontend-sign-in-prompt-spec.md`

## Global Constraints

- All paths below are relative to `frontend/` unless they start with `plans/` or are `CLAUDE.md`. Run every `npm` command from `frontend/`.
- Copy rules (spec, "Copy"): sentence case; fewer than twelve words per string; none of the words `service`, `API`, `server`, `account`, `log in`, `authenticate`, `session`; no emoji. The spelling is "Noor e Imaan".
- Sign-in is `instance.loginRedirect(loginRequest)` from `@/config/auth-config`. No MSAL configuration change, no popup window, no resume of the attempted action.
- The sheet follows `src/components/scripture/share-verse-sheet.tsx`: bottom sheet under 600 px, centred card above, `z-index: 300`, `--surface-overlay`, `--surface-card`, `--radius-lg`, `--shadow-modal`, `env(safe-area-inset-bottom)`, no animation under `prefers-reduced-motion: reduce`.
- `ProtectedRoute` must never mount while `inProgress !== InteractionStatus.None` (spec, "Saved").
- Commit messages never mention Claude or Claude Code, and carry no `Co-Authored-By` or "Generated with" trailer.
- Tests live in a `__tests__` folder next to the code (`vitest.config.ts` includes `src/**/__tests__/**/*.test.{ts,tsx}`) and mock `@azure/msal-react` per file with `vi.mock`, as `src/context/__tests__/bookmarks-context.test.tsx` does.

---

## File map

New:

| File | Responsibility |
|---|---|
| `src/config/sign-in-copy.ts` | `SignInFeature` union and every string the prompt shows |
| `src/config/__tests__/sign-in-copy.test.ts` | enforces the copy rules |
| `src/components/sign-in-prompt-sheet.tsx`, `.module.css` | the visual sheet, stateless, props only |
| `src/components/__tests__/sign-in-prompt-sheet.test.tsx` | dialog behaviour |
| `src/context/sign-in-prompt-context.tsx` | provider, `useSignInPrompt`, `useSignInGate` |
| `src/context/__tests__/sign-in-prompt-context.test.tsx` | gate and provider behaviour |
| `src/components/auth-loading.tsx` | the "Signing in..." spinner, moved out of `protected-route.tsx` |
| `src/components/saved-gate.tsx` | the three-branch gate for `/saved/` |
| `src/components/__tests__/saved-gate.test.tsx` | the three branches |
| `src/components/__tests__/reader-toolbar.test.tsx` | gear visible and gated |
| `src/app/search/__tests__/search-anonymous.test.tsx` | anonymous search prompts once |

Modified: `src/components/app-shell.tsx`, `src/components/reader-toolbar.tsx`, `src/components/navigation/app-bar.tsx`, `src/components/navigation/bottom-nav.tsx`, `src/app/saved/layout.tsx`, `src/components/protected-route.tsx`, `src/components/scripture/quran-reader-client.tsx`, `src/app/search/page.tsx`, `CLAUDE.md`.

---

### Task 1: Sign-in copy and its rules test

**Files:**
- Create: `src/config/sign-in-copy.ts`
- Test: `src/config/__tests__/sign-in-copy.test.ts`

**Interfaces:**
- Produces: `type SignInFeature = "settings" | "saved" | "bookmark" | "search"`, `interface SignInCopy { title: string; body: string }`, `SIGN_IN_COPY: Record<SignInFeature, SignInCopy>`, `SIGN_IN_LABEL`, `NOT_NOW_LABEL`, `SIGN_IN_CREDIT` (all `string`).

- [ ] **Step 1: Write the failing test**

Create `src/config/__tests__/sign-in-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  NOT_NOW_LABEL,
  SIGN_IN_COPY,
  SIGN_IN_CREDIT,
  SIGN_IN_LABEL,
} from "@/config/sign-in-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
const BANNED = /(service|\bapi\b|server|account|log in|authenticat|session)/i;

const allStrings: string[] = [
  ...Object.values(SIGN_IN_COPY).flatMap((c) => [c.title, c.body]),
  SIGN_IN_LABEL,
  NOT_NOW_LABEL,
  SIGN_IN_CREDIT,
];

describe("sign-in copy", () => {
  it("covers every feature with a title and a body", () => {
    for (const feature of ["settings", "saved", "bookmark", "search"] as const) {
      expect(SIGN_IN_COPY[feature].title.length).toBeGreaterThan(0);
      expect(SIGN_IN_COPY[feature].body.length).toBeGreaterThan(0);
    }
  });

  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string under twelve words", () => {
    for (const s of allStrings) expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
  });

  it("is written in sentence case", () => {
    for (const s of allStrings) {
      expect(s[0], s).toBe(s[0].toUpperCase());
      expect(s, s).not.toBe(s.toUpperCase());
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/config/__tests__/sign-in-copy.test.ts`
Expected: FAIL, "Failed to resolve import "@/config/sign-in-copy"".

- [ ] **Step 3: Write the copy file**

Create `src/config/sign-in-copy.ts`:

```ts
/**
 * Every user-facing string of the shared sign-in prompt.
 *
 * Readers are often unfamiliar with technology, so nothing here says "service", "API",
 * "server", "account", "log in", "authenticate" or "session". Each string is sentence case and
 * under twelve words: one fact, one action. `src/config/__tests__/sign-in-copy.test.ts` enforces
 * these rules. To add an account-only feature, add its name to `SignInFeature` and its title and
 * body here, then wrap the action at the call site with `useSignInGate("<feature>")`.
 */

export type SignInFeature = "settings" | "saved" | "bookmark" | "search";

export interface SignInCopy {
  /** Sheet heading, also the inline empty-state title where a page shows one. */
  title: string;
  /** One line under the heading saying what signing in unlocks. */
  body: string;
}

export const SIGN_IN_COPY: Record<SignInFeature, SignInCopy> = {
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/config/__tests__/sign-in-copy.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/config/sign-in-copy.ts src/config/__tests__/sign-in-copy.test.ts
git commit -m "feat(frontend): add the sign-in prompt copy with a rules test"
```

---

### Task 2: The sign-in prompt sheet

**Files:**
- Create: `src/components/sign-in-prompt-sheet.tsx`
- Create: `src/components/sign-in-prompt-sheet.module.css`
- Test: `src/components/__tests__/sign-in-prompt-sheet.test.tsx`

**Interfaces:**
- Consumes: `SIGN_IN_COPY`, `SIGN_IN_LABEL`, `NOT_NOW_LABEL`, `SIGN_IN_CREDIT`, `SignInFeature` from Task 1; `Button` from `src/components/ui/button.tsx` (`variant: "primary" | "secondary" | "ghost"`, `size`, `fullWidth`, `onClick`); `Icon` from `src/components/ui/icon.tsx` (`name="close"`).
- Produces: `export default function SignInPromptSheet(props: { isOpen: boolean; feature: SignInFeature | null; onSignIn: () => void; onClose: () => void }): JSX.Element | null`.

Use the frontend-design skill while writing the CSS in Step 3 to settle the mark size, spacing and type sizes. The structure (mark, title, body, "Sign in", "Not now", credit) and the tokens named in the spec are fixed.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/sign-in-prompt-sheet.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignInPromptSheet from "@/components/sign-in-prompt-sheet";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";

function renderSheet(props: Partial<React.ComponentProps<typeof SignInPromptSheet>> = {}) {
  const onSignIn = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <SignInPromptSheet isOpen feature="bookmark" onSignIn={onSignIn} onClose={onClose} {...props} />,
  );
  return { onSignIn, onClose, view };
}

describe("SignInPromptSheet", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("is a labelled modal dialog showing the feature's title and body", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog", { name: SIGN_IN_COPY.bookmark.title });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText(SIGN_IN_COPY.bookmark.body)).toBeTruthy();
    expect(screen.getByText(/Mahdavia Data Management System/)).toBeTruthy();
  });

  it("shows the copy of whichever feature it is opened for", () => {
    renderSheet({ feature: "search" });
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
  });

  it("calls onSignIn from the primary button", () => {
    const { onSignIn, onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from Not now, the close button, Escape and the backdrop", () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("sign-in-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it("does not close when the sheet body itself is clicked", () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog and back out when it closes", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { view } = renderSheet();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    view.rerender(<SignInPromptSheet isOpen={false} feature="bookmark" onSignIn={() => {}} onClose={() => {}} />);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("locks body scroll while open and releases it on close", () => {
    const { view } = renderSheet();
    expect(document.body.style.overflow).toBe("hidden");
    view.rerender(<SignInPromptSheet isOpen={false} feature="bookmark" onSignIn={() => {}} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("renders nothing when closed or without a feature", () => {
    renderSheet({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    renderSheet({ feature: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/__tests__/sign-in-prompt-sheet.test.tsx`
Expected: FAIL, "Failed to resolve import "@/components/sign-in-prompt-sheet"".

- [ ] **Step 3: Write the component and its stylesheet**

Create `src/components/sign-in-prompt-sheet.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef } from "react";
import Icon from "@/components/ui/icon";
import Button from "@/components/ui/button";
import {
  NOT_NOW_LABEL,
  SIGN_IN_COPY,
  SIGN_IN_CREDIT,
  SIGN_IN_LABEL,
  type SignInFeature,
} from "@/config/sign-in-copy";
import styles from "./sign-in-prompt-sheet.module.css";

interface SignInPromptSheetProps {
  isOpen: boolean;
  /** Which feature the reader tried to use; picks the title and body. */
  feature: SignInFeature | null;
  onSignIn: () => void;
  onClose: () => void;
}

/**
 * The one sign-in prompt, rendered by SignInPromptProvider. Stateless: the provider decides
 * when it is open and for which feature. Same form as ShareVerseSheet: a bottom sheet on phones,
 * a centred card from 600 px up.
 */
export default function SignInPromptSheet({ isOpen, feature, onSignIn, onClose }: SignInPromptSheetProps) {
  const headingId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock scroll and move focus only when the sheet opens or closes.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Focus the dialog itself so keyboard users start inside it without a ring on the first button.
    sheetRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !feature) return null;

  const copy = SIGN_IN_COPY[feature];

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="sign-in-backdrop">
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
          <Icon name="close" size={18} />
        </button>

        <div className={styles.markCircle} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ishqnama-gold.svg" alt="" width={36} height={30} className={styles.mark} />
        </div>

        <h2 id={headingId} className={styles.title}>
          {copy.title}
        </h2>
        <p className={styles.body}>{copy.body}</p>

        <div className={styles.actions}>
          <Button variant="primary" size="md" fullWidth onClick={onSignIn}>
            {SIGN_IN_LABEL}
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={onClose}>
            {NOT_NOW_LABEL}
          </Button>
        </div>

        <p className={styles.credit}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/mdms-mark.webp" alt="" width={18} height={18} className={styles.creditMark} aria-hidden="true" />
          <span>{SIGN_IN_CREDIT}</span>
        </p>
      </div>
    </div>
  );
}
```

Create `src/components/sign-in-prompt-sheet.module.css` (adjust sizes with the frontend-design skill, keep the tokens and breakpoints):

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: var(--surface-overlay);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  position: relative;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: var(--surface-card);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-modal);
  padding: var(--space-8) var(--space-6) max(var(--space-5), env(safe-area-inset-bottom));
  animation: rise var(--duration-slow) var(--ease-out);
}

.sheet:focus {
  outline: none;
}

@keyframes rise {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

@media (min-width: 600px) {
  .overlay {
    align-items: center;
    padding: var(--space-6);
  }

  .sheet {
    border-radius: var(--radius-lg);
    padding-bottom: var(--space-6);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet {
    animation: none;
  }
}

.closeButton {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.closeButton:hover {
  background: rgba(0, 68, 70, 0.06);
}

.closeButton:focus-visible {
  outline: 2px solid var(--teal-accent);
  outline-offset: 2px;
}

.markCircle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--gold-wash);
  margin-bottom: var(--space-5);
}

.mark {
  display: block;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 500;
  line-height: var(--leading-tight);
  color: var(--text-primary);
}

.body {
  margin: var(--space-2) 0 0;
  max-width: 320px;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-secondary);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-6);
}

.credit {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: var(--space-5) 0 0;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.creditMark {
  display: block;
  border-radius: 50%;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/__tests__/sign-in-prompt-sheet.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors (the two `<img>` lines carry the `no-img-element` disable, as `app-bar.tsx` does).

- [ ] **Step 6: Commit**

```bash
git add src/components/sign-in-prompt-sheet.tsx src/components/sign-in-prompt-sheet.module.css src/components/__tests__/sign-in-prompt-sheet.test.tsx
git commit -m "feat(frontend): add the sign-in prompt sheet"
```

---

### Task 3: Provider, hooks and mounting in the app shell

**Files:**
- Create: `src/context/sign-in-prompt-context.tsx`
- Modify: `src/components/app-shell.tsx`
- Test: `src/context/__tests__/sign-in-prompt-context.test.tsx`

**Interfaces:**
- Consumes: `SignInPromptSheet` from Task 2; `SignInFeature` from Task 1; `loginRequest` from `@/config/auth-config`; `useIsAuthenticated`, `useMsal` from `@azure/msal-react`; `InteractionStatus` from `@azure/msal-browser` (`InteractionStatus.None === "none"`).
- Produces:
  - `export default function SignInPromptProvider({ children }: { children: ReactNode })`
  - `export function useSignInPrompt(): { isOpen: boolean; feature: SignInFeature | null; authSettled: boolean; promptSignIn: (feature: SignInFeature) => void; dismiss: () => void }`
  - `export function useSignInGate(feature: SignInFeature): (action: () => void) => boolean`

- [ ] **Step 1: Write the failing test**

Create `src/context/__tests__/sign-in-prompt-context.test.tsx`:

```tsx
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInPromptProvider, { useSignInGate, useSignInPrompt } from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";
import { loginRequest } from "@/config/auth-config";

const msal = vi.hoisted(() => ({
  authed: false,
  inProgress: "none",
  loginRedirect: vi.fn(),
}));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: msal.loginRedirect }, inProgress: msal.inProgress }),
}));
vi.mock("@azure/msal-browser", () => ({ InteractionStatus: { None: "none" } }));

function GateHarness() {
  const gate = useSignInGate("bookmark");
  const [ran, setRan] = useState(0);
  const [result, setResult] = useState("");
  return (
    <>
      <button onClick={() => setResult(String(gate(() => setRan((r) => r + 1))))}>go</button>
      <output data-testid="ran">{ran}</output>
      <output data-testid="result">{result}</output>
    </>
  );
}

function PromptHarness() {
  const { promptSignIn, dismiss, authSettled, isOpen } = useSignInPrompt();
  return (
    <>
      <button onClick={() => promptSignIn("search")}>prompt</button>
      <button onClick={dismiss}>dismiss</button>
      <output data-testid="settled">{String(authSettled)}</output>
      <output data-testid="open">{String(isOpen)}</output>
    </>
  );
}

function renderWith(ui: React.ReactNode) {
  return render(<SignInPromptProvider>{ui}</SignInPromptProvider>);
}

describe("useSignInGate", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
    msal.loginRedirect.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("runs the action and returns true when signed in", () => {
    msal.authed = true;
    renderWith(<GateHarness />);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByTestId("ran").textContent).toBe("1");
    expect(screen.getByTestId("result").textContent).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the prompt for its feature and returns false when anonymous", () => {
    renderWith(<GateHarness />);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByTestId("ran").textContent).toBe("0");
    expect(screen.getByTestId("result").textContent).toBe("false");
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.bookmark.title })).toBeTruthy();
  });
});

describe("SignInPromptProvider", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
    msal.loginRedirect.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("opens on promptSignIn and closes on dismiss", () => {
    renderWith(<PromptHarness />);
    expect(screen.getByTestId("open").textContent).toBe("false");
    fireEvent.click(screen.getByText("prompt"));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
    expect(screen.getByTestId("open").textContent).toBe("true");
    fireEvent.click(screen.getByText("dismiss"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts the redirect sign-in with the app's login request", () => {
    renderWith(<PromptHarness />);
    fireEvent.click(screen.getByText("prompt"));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(msal.loginRedirect).toHaveBeenCalledWith(loginRequest);
    // The sheet stays open while the browser navigates away.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("stays open if the redirect call rejects", async () => {
    msal.loginRedirect.mockRejectedValue(new Error("interaction_in_progress"));
    renderWith(<PromptHarness />);
    fireEvent.click(screen.getByText("prompt"));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await Promise.resolve();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes itself once the reader is signed in", () => {
    const view = renderWith(<PromptHarness />);
    fireEvent.click(screen.getByText("prompt"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    msal.authed = true;
    view.rerender(<SignInPromptProvider><PromptHarness /></SignInPromptProvider>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports authSettled from MSAL's interaction status", () => {
    msal.inProgress = "startup";
    const view = renderWith(<PromptHarness />);
    expect(screen.getByTestId("settled").textContent).toBe("false");
    msal.inProgress = "none";
    view.rerender(<SignInPromptProvider><PromptHarness /></SignInPromptProvider>);
    expect(screen.getByTestId("settled").textContent).toBe("true");
  });

  it("throws when a hook is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<PromptHarness />)).toThrow(/SignInPromptProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/context/__tests__/sign-in-prompt-context.test.tsx`
Expected: FAIL, "Failed to resolve import "@/context/sign-in-prompt-context"".

- [ ] **Step 3: Write the provider**

Create `src/context/sign-in-prompt-context.tsx`:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "@/config/auth-config";
import SignInPromptSheet from "@/components/sign-in-prompt-sheet";
import type { SignInFeature } from "@/config/sign-in-copy";

interface SignInPromptContextValue {
  isOpen: boolean;
  feature: SignInFeature | null;
  /** True once MSAL has finished starting up or handling a redirect (inProgress === None). */
  authSettled: boolean;
  /** Open the prompt for a feature. Pages that prompt on arrival must wait for authSettled first. */
  promptSignIn: (feature: SignInFeature) => void;
  dismiss: () => void;
}

const SignInPromptContext = createContext<SignInPromptContextValue | null>(null);

/**
 * Owns the one sign-in prompt for the whole app. Mounted in AppShell inside AuthProvider so
 * every provider, page and component below it can gate an account-only action.
 */
export default function SignInPromptProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { instance, inProgress } = useMsal();
  const [feature, setFeature] = useState<SignInFeature | null>(null);

  // Once signed in, forget the pending feature so a later sign-out does not reopen the sheet.
  useEffect(() => {
    if (isAuthenticated) setFeature(null);
  }, [isAuthenticated]);

  const promptSignIn = useCallback((f: SignInFeature) => setFeature(f), []);
  const dismiss = useCallback(() => setFeature(null), []);

  const signIn = useCallback(() => {
    // The sheet stays open while the browser navigates away. If the call rejects (for example
    // an interaction is already in progress) it also stays open; MSAL logs the error itself.
    instance.loginRedirect(loginRequest).catch(() => {});
  }, [instance]);

  // Reading isAuthenticated here means the sheet closes the moment a sign-in completes.
  const isOpen = feature !== null && !isAuthenticated;
  const authSettled = inProgress === InteractionStatus.None;

  const value = useMemo<SignInPromptContextValue>(
    () => ({ isOpen, feature, authSettled, promptSignIn, dismiss }),
    [isOpen, feature, authSettled, promptSignIn, dismiss],
  );

  return (
    <SignInPromptContext.Provider value={value}>
      {children}
      <SignInPromptSheet isOpen={isOpen} feature={feature} onSignIn={signIn} onClose={dismiss} />
    </SignInPromptContext.Provider>
  );
}

export function useSignInPrompt(): SignInPromptContextValue {
  const ctx = useContext(SignInPromptContext);
  if (!ctx) throw new Error("useSignInPrompt must be used within SignInPromptProvider");
  return ctx;
}

/**
 * Returns gate(action). Signed in: runs action and returns true. Anonymous: opens the prompt
 * for `feature`, does not run action, and returns false. Call sites never check auth themselves.
 */
export function useSignInGate(feature: SignInFeature): (action: () => void) => boolean {
  const isAuthenticated = useIsAuthenticated();
  const { promptSignIn } = useSignInPrompt();
  return useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
        return true;
      }
      promptSignIn(feature);
      return false;
    },
    [isAuthenticated, promptSignIn, feature],
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/context/__tests__/sign-in-prompt-context.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Mount the provider in the app shell**

In `src/components/app-shell.tsx`, add the import after the `AuthProvider` import:

```tsx
import SignInPromptProvider from "@/context/sign-in-prompt-context";
```

and change the tree so the provider sits inside `AuthProvider` and outside `ReaderSettingsProvider`:

```tsx
      <AuthProvider>
        <SignInPromptProvider>
          <ReaderSettingsProvider>
            <BookmarksProvider>
              <AppBar />
              {children}
              <Footer />
              <BottomNav />
              <PwaInstallPrompt />
            </BookmarksProvider>
          </ReaderSettingsProvider>
        </SignInPromptProvider>
      </AuthProvider>
```

- [ ] **Step 6: Lint and type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/context/sign-in-prompt-context.tsx src/context/__tests__/sign-in-prompt-context.test.tsx src/components/app-shell.tsx
git commit -m "feat(frontend): add the sign-in prompt provider and gate hook"
```

---

### Task 4: Show the reading-settings gear to everyone and gate it

**Files:**
- Modify: `src/components/reader-toolbar.tsx`
- Test: `src/components/__tests__/reader-toolbar.test.tsx`

**Interfaces:**
- Consumes: `SignInPromptProvider`, `useSignInGate` from Task 3; `useReaderSettings().openSettings` from `src/context/reader-settings-context.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/reader-toolbar.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReaderToolbar from "@/components/reader-toolbar";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";

const msal = vi.hoisted(() => ({ authed: false }));
const openSettings = vi.fn();

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: "none" }),
}));
vi.mock("@azure/msal-browser", () => ({ InteractionStatus: { None: "none" } }));
vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ openSettings }),
}));

function renderToolbar() {
  return render(
    <SignInPromptProvider>
      <ReaderToolbar
        prev={null}
        next={null}
        mode="verse"
        onModeChange={() => {}}
        lang="english"
        onLangChange={() => {}}
        fontScale={2}
        onFontScaleChange={() => {}}
      />
    </SignInPromptProvider>,
  );
}

describe("ReaderToolbar settings gear", () => {
  beforeEach(() => {
    msal.authed = false;
    openSettings.mockReset();
  });
  afterEach(cleanup);

  it("is shown to an anonymous reader and opens the sign-in prompt instead of settings", () => {
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(openSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.settings.title })).toBeTruthy();
  });

  it("opens the settings sheet for a signed-in reader", () => {
    msal.authed = true;
    renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/__tests__/reader-toolbar.test.tsx`
Expected: FAIL. The first test cannot find the "Settings" button (the toolbar's `AuthenticatedTemplate` is mocked away with `@azure/msal-react`, so the import itself fails: "No "AuthenticatedTemplate" export is defined on the mock"). Either failure is the expected red.

- [ ] **Step 3: Remove the wrapper and gate the click**

In `src/components/reader-toolbar.tsx`:

Replace the import line

```tsx
import { AuthenticatedTemplate } from "@azure/msal-react";
```

with

```tsx
import { useSignInGate } from "@/context/sign-in-prompt-context";
```

After `const { openSettings } = useReaderSettings();` add:

```tsx
  const gateSettings = useSignInGate("settings");
```

Replace the block

```tsx
          {/* Settings only persist for signed-in readers, so the panel is hidden when anonymous. */}
          <AuthenticatedTemplate>
            <button onClick={openSettings} className={styles.settingsBtn} aria-label="Settings">
              <Icon name="settings" size={18} />
            </button>
          </AuthenticatedTemplate>
```

with

```tsx
          {/* Settings persist for signed-in readers; anonymous readers get the sign-in prompt. */}
          <button onClick={() => gateSettings(openSettings)} className={styles.settingsBtn} aria-label="Settings">
            <Icon name="settings" size={18} />
          </button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/components/__tests__/reader-toolbar.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`
Expected: no errors.

```bash
git add src/components/reader-toolbar.tsx src/components/__tests__/reader-toolbar.test.tsx
git commit -m "feat(frontend): show the reading settings gear to every reader behind the sign-in prompt"
```

---

### Task 5: Gate the bookmark button on a verse

**Files:**
- Modify: `src/components/scripture/quran-reader-client.tsx:5,49,194-203`

**Interfaces:**
- Consumes: `useSignInGate` from Task 3.

There is no unit test for this component today and rendering it needs the full reader tree, so this task is verified by type-check, lint and the manual pass in Task 8. Both the continuous-mode `AyahBlock` and the verse popup already call `handleBookmarkVerse`, so one change covers both.

- [ ] **Step 1: Replace the silent guard with the gate**

In `src/components/scripture/quran-reader-client.tsx`:

Remove the import

```tsx
import { useIsAuthenticated } from "@azure/msal-react";
```

and add, next to the other context imports:

```tsx
import { useSignInGate } from "@/context/sign-in-prompt-context";
```

Remove the line

```tsx
  const isAuthenticated = useIsAuthenticated();
```

(it was only used by the bookmark guard) and, where `const { bookmarks, savePosition, hasCustomBookmarks } = useBookmarks();` is, add after it:

```tsx
  const gateBookmark = useSignInGate("bookmark");
```

Replace

```tsx
  const handleBookmarkVerse = useCallback((chapterNum: number, verseNum: number) => {
    if (!isAuthenticated) return;
    if (!hasCustomBookmarks) {
      savePosition("nazra", chapterNum, verseNum);
    } else {
      pickerChapterRef.current = chapterNum;
      pickerVerseRef.current = verseNum;
      setPickerOpen(true);
    }
  }, [isAuthenticated, hasCustomBookmarks, savePosition]);
```

with

```tsx
  // Anonymous readers get the sign-in prompt instead of a click that does nothing.
  const handleBookmarkVerse = useCallback((chapterNum: number, verseNum: number) => {
    gateBookmark(() => {
      if (!hasCustomBookmarks) {
        savePosition("nazra", chapterNum, verseNum);
      } else {
        pickerChapterRef.current = chapterNum;
        pickerVerseRef.current = verseNum;
        setPickerOpen(true);
      }
    });
  }, [gateBookmark, hasCustomBookmarks, savePosition]);
```

- [ ] **Step 2: Confirm nothing else in the file used isAuthenticated**

Run: `grep -n "isAuthenticated" src/components/scripture/quran-reader-client.tsx`
Expected: no output.

- [ ] **Step 3: Type-check, lint and run the whole suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/scripture/quran-reader-client.tsx
git commit -m "feat(frontend): prompt anonymous readers to sign in when they bookmark a verse"
```

---

### Task 6: Show "Saved" to everyone and gate the Saved page

**Files:**
- Create: `src/components/auth-loading.tsx`
- Create: `src/components/saved-gate.tsx`
- Modify: `src/components/protected-route.tsx:11-40` (remove the local `Loading`, import `AuthLoading`)
- Modify: `src/components/navigation/app-bar.tsx:5,13,18,37`
- Modify: `src/components/navigation/bottom-nav.tsx:5,14,19,29`
- Modify: `src/app/saved/layout.tsx`
- Test: `src/components/__tests__/saved-gate.test.tsx`

**Interfaces:**
- Consumes: `useSignInPrompt` (`authSettled`, `promptSignIn`) from Task 3; `SIGN_IN_COPY`, `SIGN_IN_LABEL` from Task 1; `ProtectedRoute` (default export, `{ children }`); `EmptyState` (`icon`, `title`, `body`, `action?: { label, onClick }`); `SectionHeading` (`eyebrow?`, `title`).
- Produces: `export default function AuthLoading(): JSX.Element` (the "Signing in..." spinner); `export default function SavedGate({ children }: { children: ReactNode })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/saved-gate.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SavedGate from "@/components/saved-gate";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";

const msal = vi.hoisted(() => ({ authed: false, inProgress: "none" }));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: msal.inProgress }),
}));
vi.mock("@azure/msal-browser", () => ({ InteractionStatus: { None: "none" } }));
// ProtectedRoute wraps MsalAuthenticationTemplate; here we only care that it is (or is not) mounted.
vi.mock("@/components/protected-route", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected">{children}</div>,
}));

function renderGate() {
  return render(
    <SignInPromptProvider>
      <SavedGate>
        <p>saved page content</p>
      </SavedGate>
    </SignInPromptProvider>,
  );
}

function rerenderGate(view: ReturnType<typeof render>) {
  view.rerender(
    <SignInPromptProvider>
      <SavedGate>
        <p>saved page content</p>
      </SavedGate>
    </SignInPromptProvider>,
  );
}

describe("SavedGate", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
  });
  afterEach(cleanup);

  it("shows the signing-in spinner and mounts nothing else while MSAL is still starting", () => {
    msal.inProgress = "startup";
    renderGate();
    expect(screen.getByText("Signing in...")).toBeTruthy();
    expect(screen.queryByTestId("protected")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("saved page content")).toBeNull();
  });

  it("shows the page shell and opens the prompt once for an anonymous reader", () => {
    const view = renderGate();
    expect(screen.getByRole("heading", { name: "Saved" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.saved.title })).toBeTruthy();
    expect(screen.queryByTestId("protected")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    rerenderGate(view);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the inline empty state reopen the prompt after it was dismissed", () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    // The inline empty state's button and the (closed) sheet share the label; only one remains.
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.saved.title })).toBeTruthy();
  });

  it("renders the page inside ProtectedRoute for a signed-in reader", () => {
    msal.authed = true;
    renderGate();
    expect(screen.getByTestId("protected")).toBeTruthy();
    expect(screen.getByText("saved page content")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/__tests__/saved-gate.test.tsx`
Expected: FAIL, "Failed to resolve import "@/components/saved-gate"".

- [ ] **Step 3: Move the spinner out of ProtectedRoute**

Create `src/components/auth-loading.tsx` with the `Loading` function currently at the top of `src/components/protected-route.tsx`, renamed:

```tsx
"use client";

/** Shown while MSAL is starting up or finishing a redirect and the page cannot yet decide what to render. */
export default function AuthLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(0, 68, 70, 0.1)",
          borderTopColor: "var(--teal-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-base)" }}>
        Signing in...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

In `src/components/protected-route.tsx`, delete the whole `function Loading() { ... }` block, add

```tsx
import AuthLoading from "@/components/auth-loading";
```

and change `loadingComponent={Loading}` to `loadingComponent={AuthLoading}`.

- [ ] **Step 4: Write the gate**

Create `src/components/saved-gate.tsx`:

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import AuthLoading from "@/components/auth-loading";
import EmptyState from "@/components/empty-state";
import ProtectedRoute from "@/components/protected-route";
import SectionHeading from "@/components/navigation/section-heading";
import { SIGN_IN_COPY, SIGN_IN_LABEL } from "@/config/sign-in-copy";
import { useSignInPrompt } from "@/context/sign-in-prompt-context";

/**
 * Wraps /saved/. While MSAL is still starting, shows the spinner. Once settled: an anonymous
 * reader sees the page shell with the sign-in prompt opened once over it (and an inline way to
 * reopen it); a signed-in reader gets ProtectedRoute as before, which keeps silent renewal and
 * the "Sign in again" error state for expired sessions.
 *
 * ProtectedRoute must not mount before auth has settled: MsalAuthenticationTemplate starts its
 * own redirect the moment inProgress becomes None with no account, which would race the
 * anonymous branch and send the reader away without ever showing the prompt.
 */
export default function SavedGate({ children }: { children: ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { authSettled, promptSignIn } = useSignInPrompt();
  const anonymous = authSettled && !isAuthenticated;
  const prompted = useRef(false);

  useEffect(() => {
    if (!anonymous || prompted.current) return;
    prompted.current = true;
    promptSignIn("saved");
  }, [anonymous, promptSignIn]);

  if (!authSettled) return <AuthLoading />;

  if (!isAuthenticated) {
    return (
      <main style={{ padding: "var(--space-8) 0 var(--space-16)" }}>
        <div className="page-container">
          <SectionHeading eyebrow="Your library" title="Saved" />
          <EmptyState
            icon="bookmark"
            title={SIGN_IN_COPY.saved.title}
            body={SIGN_IN_COPY.saved.body}
            action={{ label: SIGN_IN_LABEL, onClick: () => promptSignIn("saved") }}
          />
        </div>
      </main>
    );
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
```

The inline `padding` mirrors `.main` in `src/app/saved/page.module.css` so the shell sits where the real page will.

- [ ] **Step 5: Use the gate in the layout**

Replace the contents of `src/app/saved/layout.tsx` with:

```tsx
"use client";

import SavedGate from "@/components/saved-gate";

export default function SavedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SavedGate>{children}</SavedGate>;
}
```

- [ ] **Step 6: Show "Saved" in both navigations**

In `src/components/navigation/app-bar.tsx`:
- delete `import { useIsAuthenticated } from "@azure/msal-react";`
- change `{ href: "/saved/", label: "Saved", authOnly: true },` to `{ href: "/saved/", label: "Saved" },`
- delete `const isAuthenticated = useIsAuthenticated();`
- delete `if (link.authOnly && !isAuthenticated) return null;`

In `src/components/navigation/bottom-nav.tsx`:
- delete `import { useIsAuthenticated } from "@azure/msal-react";`
- change `{ href: "/saved/", icon: "bookmark", label: "Saved", authOnly: true },` to `{ href: "/saved/", icon: "bookmark", label: "Saved" },`
- delete `const isAuthenticated = useIsAuthenticated();`
- delete `if (tab.authOnly && !isAuthenticated) return null;`

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- src/components/__tests__/saved-gate.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 8: Type-check, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass, and `grep -rn "authOnly" src` prints nothing.

- [ ] **Step 9: Commit**

```bash
git add src/components/auth-loading.tsx src/components/saved-gate.tsx src/components/protected-route.tsx src/components/navigation/app-bar.tsx src/components/navigation/bottom-nav.tsx src/app/saved/layout.tsx src/components/__tests__/saved-gate.test.tsx
git commit -m "feat(frontend): show Saved to every reader and prompt anonymous visitors to sign in"
```

---

### Task 7: Keep the search page visible and prompt on the first keystroke

**Files:**
- Modify: `src/app/search/page.tsx:3-5,62-63,128-144,167-217`
- Test: `src/app/search/__tests__/search-anonymous.test.tsx`

**Interfaces:**
- Consumes: `useSignInPrompt().promptSignIn` from Task 3; `SIGN_IN_COPY`, `SIGN_IN_LABEL` from Task 1.

- [ ] **Step 1: Write the failing test**

Create `src/app/search/__tests__/search-anonymous.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "@/app/search/page";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";
import { searchQuran } from "@/lib/api";

const msal = vi.hoisted(() => ({ authed: false }));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: "none" }),
}));
vi.mock("@azure/msal-browser", () => ({ InteractionStatus: { None: "none" } }));
vi.mock("@/lib/api", () => ({ searchQuran: vi.fn() }));

function renderPage() {
  return render(
    <SignInPromptProvider>
      <SearchPage />
    </SignInPromptProvider>,
  );
}

describe("SearchPage for an anonymous reader", () => {
  beforeEach(() => {
    msal.authed = false;
    vi.mocked(searchQuran).mockReset();
  });
  afterEach(cleanup);

  it("keeps the heading and the field, with no prompt until the reader types", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(SIGN_IN_COPY.search.title)).toBeTruthy();
  });

  it("prompts once on the first keystroke and never searches", () => {
    renderPage();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "n" } });
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "noor" } });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(searchQuran).not.toHaveBeenCalled();
  });

  it("reopens the prompt from the inline Sign in button", () => {
    renderPage();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "n" } });
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/search/__tests__/search-anonymous.test.tsx`
Expected: FAIL. The page still returns early for anonymous readers, so there is no `searchbox` (and the import of `loginRequest`/`useMsal` may fail against the mock first). Either is the expected red.

- [ ] **Step 3: Rework the page**

In `src/app/search/page.tsx`:

Replace the imports

```tsx
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "@/config/auth-config";
```

with

```tsx
import { useIsAuthenticated } from "@azure/msal-react";
import { SIGN_IN_COPY, SIGN_IN_LABEL } from "@/config/sign-in-copy";
import { useSignInPrompt } from "@/context/sign-in-prompt-context";
```

Replace

```tsx
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();
  const abortRef = useRef<AbortController | null>(null);
```

with

```tsx
  const isAuthenticated = useIsAuthenticated();
  const { promptSignIn } = useSignInPrompt();
  // Prompt an anonymous reader once per visit, on the first character they type.
  const promptedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isAuthenticated || query.length === 0 || promptedRef.current) return;
    promptedRef.current = true;
    promptSignIn("search");
  }, [isAuthenticated, query, promptSignIn]);
```

Delete the whole anonymous early return:

```tsx
  if (!isAuthenticated) {
    return (
      <main className={styles.main}>
        <div className="page-container">
          <SectionHeading eyebrow="Explore" title="Search" />
          <EmptyState
            icon="lock"
            title="Sign in to search"
            body="Log in to search across tarjuma and tafseer."
            action={{
              label: "Sign in",
              onClick: () => instance.loginRedirect(loginRequest),
            }}
          />
        </div>
      </main>
    );
  }
```

In the results area, wrap the existing states so an anonymous reader sees only the sign-in empty state. Change

```tsx
        <div className={styles.results}>
          {!searched && !loading && (
```

to

```tsx
        <div className={styles.results}>
          {!isAuthenticated && (
            <EmptyState
              icon="logIn"
              title={SIGN_IN_COPY.search.title}
              body={SIGN_IN_COPY.search.body}
              action={{ label: SIGN_IN_LABEL, onClick: () => promptSignIn("search") }}
            />
          )}

          {isAuthenticated && !searched && !loading && (
```

The other four states in that `div` (`searched && error && !loading`, `searched && !error && results.length === 0 && !loading`, `results.length > 0`, `loading && results.length === 0`) can only be true after a search, and the debounced effect never searches while anonymous, so they need no extra guard.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/search/__tests__/search-anonymous.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass. The build confirms the `__tests__` folder under `src/app/search/` does not register as a route (only `page.tsx`, `layout.tsx` and the other Next.js file conventions do).

- [ ] **Step 6: Commit**

```bash
git add src/app/search/page.tsx src/app/search/__tests__/search-anonymous.test.tsx
git commit -m "feat(frontend): keep the search page open to anonymous readers and prompt on the first keystroke"
```

---

### Task 8: Documentation and final verification

**Files:**
- Modify: `CLAUDE.md` (repository root), Frontend section

- [ ] **Step 1: Document the prompt in CLAUDE.md**

In `CLAUDE.md`, under "### Frontend", add this bullet directly after the **Sharing a verse** bullet:

```markdown
- **Sign-in prompt**: account-only controls are shown to every reader; never hide one or let its click do nothing. `src/context/sign-in-prompt-context.tsx` (`SignInPromptProvider`, mounted in `app-shell.tsx` inside `AuthProvider`) renders the one `src/components/sign-in-prompt-sheet.tsx` and exposes `useSignInGate(feature)`, which returns `gate(action)`: signed in it runs the action, anonymous it opens the sheet for that feature. `useSignInPrompt()` gives `promptSignIn`, `dismiss` and `authSettled` (`inProgress === None`) for pages that prompt on arrival; those must wait for `authSettled` or a returning reader sees the prompt flash mid-redirect. Copy lives in `src/config/sign-in-copy.ts` (`SignInFeature` union plus title and body per feature) under the same non-technical rule as the readiness copy, enforced by `src/config/__tests__/sign-in-copy.test.ts`. Sign-in is the existing `loginRedirect`; nothing is replayed after it. Gated today: the reader-toolbar settings gear, the bookmark button on a verse, `/saved/` (via `src/components/saved-gate.tsx`, which shows the spinner until auth settles, then the page shell with the prompt for anonymous readers, and `ProtectedRoute` only for signed-in ones) and search (prompts once on the first keystroke). To add a feature: one entry in the copy file, one `useSignInGate` call at the site. Design in `plans/frontend-sign-in-prompt-spec.md`
```

Replace the **Protected pages** bullet with:

```markdown
- **Protected pages**: `/saved` shows "Saved" in the navigation to everyone; anonymous readers get the page shell with the sign-in prompt (see **Sign-in prompt**), signed-in readers go through `<ProtectedRoute>` inside `src/components/saved-gate.tsx`. `/search` is public UI; an anonymous reader is prompted to sign in on the first keystroke and the `/api/search` call requires a token
```

- [ ] **Step 2: Full automated verification**

Run from `frontend/`: `npm run lint && npm test && npm run build`
Expected: lint clean, every test file passes (the new ones: sign-in-copy, sign-in-prompt-sheet, sign-in-prompt-context, reader-toolbar, saved-gate, search-anonymous), static export succeeds.

- [ ] **Step 3: Manual pass on the dev server**

Run `npm run dev` and, signed out, at a phone width (about 390 px) and on desktop:

1. Open `/quran/1/`. The gear is visible in the toolbar. Click it: the sheet rises (phone) or appears centred (desktop) with "Sign in to keep your reading settings". "Not now", Escape, the backdrop and the close button each dismiss it. Tab order starts inside the sheet; on dismiss focus returns to the gear.
2. In continuous mode click a verse's bookmark icon; in verse mode open the popup and click its bookmark icon. Both show "Sign in to bookmark this ayah".
3. "Saved" appears in the app bar and the bottom nav. Tap it: the Saved heading appears with the prompt over it. Dismiss: the inline "Sign in to see your bookmarks" state remains and its button reopens the prompt.
4. Open `/search/`. Heading, tabs and field are present, no prompt. Type one character: the prompt opens. Dismiss, keep typing: no prompt again, no results, the inline state's "Sign in" reopens it.
5. From any prompt click "Sign in". Sign in at Entra. You return to the same page signed in; the gear opens settings, the bookmark saves, Saved lists bookmarks, search works.
6. While signed in, reload `/saved/`: the spinner shows briefly, then the page, with no flash of the anonymous shell or prompt.
7. With the OS "reduce motion" setting on, the sheet appears without the rise animation.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe the shared sign-in prompt and the new anonymous behaviour of Saved and Search"
```
