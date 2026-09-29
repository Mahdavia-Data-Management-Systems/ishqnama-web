# Frontend Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Readers choose Light, Dark or Match my device from an app-bar button; the choice is kept per browser and applied before first paint with a "deep teal night" palette.

**Architecture:** `globals.css` keeps today's `:root` as the light theme and adds a `:root[data-theme="dark"]` block (inside `@media screen`, so printing stays light) that redefines the same tokens. An inline head script sets `data-theme`, `color-scheme` and the `theme-color` meta on `<html>` from `localStorage` and `prefers-color-scheme`; a module-level store in `src/lib/theme.ts` keeps it live afterwards. Every hardcoded colour in CSS modules becomes a token so the swap reaches the whole app.

**Tech Stack:** Next.js 15 App Router (static export), React 19, CSS Modules, Vitest + Testing Library (jsdom).

**Spec:** `plans/frontend-dark-mode-spec.md`

All commands run from `frontend/` unless stated. Run a single test file with `npx vitest run <path>`.

## Global Constraints

- Storage key `ishqnama-theme`; values `light`, `dark`, `system`; anything else, or a throwing `localStorage`, means `system`.
- Default preference: `system` ("Match my device").
- `THEME_COLOR = { light: "#004446", dark: "#00292B" }`.
- Light mode must stay pixel-identical: every new token's light value equals the literal it replaces. The single accepted exception is `rgba(180, 141, 61, 0.1)` in `create-bookmark-dialog.module.css`, which becomes the gold tint `rgba(190, 170, 48, 0.1)`.
- The control is visible to every reader and never goes through `useSignInGate`.
- Reader-facing copy avoids technical words (`system`, `theme`, `api`, `server`, `service`, `mode`), stays under twelve words and is sentence case, as `src/config/__tests__/sign-in-copy.test.ts` enforces for sign-in copy.
- No backend, Terraform, manifest, favicon, OG image, `.glb` or poster changes.
- Commit messages must not mention Claude or Claude Code and carry no `Co-Authored-By` trailer.
- Tests touching `localStorage` stub an in-memory one with `vi.stubGlobal`, because Node 25's experimental `localStorage` global shadows jsdom's and has no methods.

## Review Focus

- Blocked storage (private window, `setItem` throws) while choosing an item: the page still switches theme for this visit, and nothing throws. Pinned in Task 3.
- `window.matchMedia` missing (old embedded browsers, jsdom): the script and store treat the device as light rather than throwing. Pinned in Task 3.
- Two tabs open, the reader changes the choice in one: the other follows through the `storage` event. Pinned in Task 3.
- An explicit Light or Dark choice while the device flips at sunset: the page must not follow the device. Pinned in Task 3.
- A future component adding a raw `rgba(0, 68, 70, …)`: it would silently be wrong in dark. Pinned by the guard test in Task 2.

---

## File map

| File | Responsibility |
|---|---|
| `src/app/globals.css` (modify) | Light tokens (existing plus new), dark token block |
| `src/app/__tests__/theme-tokens.test.ts` (create) | Every light colour token has a dark value |
| `src/app/__tests__/no-hardcoded-colours.test.ts` (create) | Guard against raw colours in CSS modules and inline styles |
| ~30 `*.module.css`, `auth-loading.tsx`, `quran-reader-client.tsx` (modify) | Literals replaced by tokens |
| `src/lib/theme.ts` (create) | Types, head script, DOM apply, store, `useTheme` |
| `src/lib/__tests__/theme.test.ts` (create) | Script and store behaviour |
| `src/app/layout.tsx` (modify) | Render the head script, `suppressHydrationWarning` |
| `src/config/theme-copy.ts` (create) | Button and item labels |
| `src/config/__tests__/theme-copy.test.ts` (create) | Copy rules |
| `src/components/ui/icon.tsx` (modify) | `sun` and `monitor` icons |
| `src/components/navigation/theme-menu.tsx` + `.module.css` (create) | App-bar button and menu |
| `src/components/navigation/__tests__/theme-menu.test.tsx` (create) | Menu behaviour |
| `src/components/navigation/app-bar.tsx` + `.module.css` (modify) | Place the menu before `UserMenu` |
| `src/components/themed-logo.tsx` (create) | Teal/gold logo pair switched by CSS |
| `src/components/__tests__/themed-logo.test.tsx` (create) | Renders both logos with the right classes |
| `footer.tsx`, `sign-in-prompt-sheet.tsx`, `pwa-install-prompt.tsx` (modify) | Use `ThemedLogo` |
| `CLAUDE.md` (modify, repo root) | Dark mode bullet |

The MDMS logo on the About page (`public/images/mdms-logo.webp`) was checked while planning: it carries its own gold and green artwork with a filled white centre, so it needs no plate and no change.

---

### Task 1: Dark and new tokens in `globals.css`

**Files:**
- Modify: `src/app/globals.css` (the `:root` block, lines 37–145)
- Test: `src/app/__tests__/theme-tokens.test.ts`

**Interfaces:**
- Produces, for Task 2 and later: the tokens `--fill-primary`, `--fill-primary-hover`, `--fill-primary-press`, `--fill-danger`, `--fill-danger-hover`, `--color-error`, `--color-surface-hover`, `--surface-raised`, `--badge-madani-bg`, `--book-glow`, `--ribbon-shadow`, `--tint-teal-{3,4,6,7,8,10,12,14,15,20}`, `--tint-ink-{6,8,10,12,20}`, all defined in both themes.

- [ ] **Step 1: Write the failing parity test**

Create `src/app/__tests__/theme-tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../globals.css"), "utf8");

/** The custom properties declared directly in the first block whose selector matches. */
function block(selector: RegExp): Map<string, string> {
  const match = selector.exec(css);
  if (!match) throw new Error(`no block for ${selector}`);
  const body = css.slice(match.index + match[0].length, css.indexOf("}", match.index));
  const props = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) props.set(m[1], m[2].trim());
  return props;
}

const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(/i;

// Tokens that are the same in both themes by design (text on the always-dark chrome, gold, ornaments).
const THEME_INDEPENDENT = new Set([
  "--text-on-dark",
  "--text-on-dark-muted",
  "--text-on-dark-subtle",
  "--gold",
  "--gold-bright",
  "--gradient-splash",
  "--ornament-gold",
  "--ornament-gold-strong",
]);

describe("theme tokens", () => {
  const light = block(/:root\s*\{/);
  const dark = block(/:root\[data-theme="dark"\]\s*\{/);

  it("gives every light colour token a dark value", () => {
    const missing = [...light]
      .filter(([name, value]) => COLOUR.test(value) && !THEME_INDEPENDENT.has(name))
      .map(([name]) => name)
      .filter((name) => !dark.has(name));
    expect(missing).toEqual([]);
  });

  it("defines no dark token that light lacks", () => {
    expect([...dark.keys()].filter((name) => !light.has(name))).toEqual([]);
  });

  it("scopes the dark block to screens so printing stays light", () => {
    expect(css).toMatch(/@media screen\s*\{\s*:root\[data-theme="dark"\]/);
  });

  it("defines the tokens components rely on", () => {
    for (const name of [
      "--fill-primary", "--fill-primary-hover", "--fill-primary-press",
      "--fill-danger", "--fill-danger-hover", "--color-error", "--color-surface-hover",
      "--surface-raised", "--badge-madani-bg", "--book-glow", "--ribbon-shadow",
      "--tint-teal-3", "--tint-teal-20", "--tint-ink-6", "--tint-ink-20",
    ]) {
      expect(light.has(name), name).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/__tests__/theme-tokens.test.ts`
Expected: FAIL with `no block for /:root\[data-theme="dark"\]\s*\{/`.

- [ ] **Step 3: Add the new light tokens**

In `src/app/globals.css`, inside `:root`, after the `/* Colors – Semantic */` group (after `--madani: #004446;`), add:

```css
  /* Colors – Fills behind --text-on-dark (teal and error split into text and fill roles) */
  --fill-primary: #004446;
  --fill-primary-hover: #003234;
  --fill-primary-press: #002526;
  --fill-danger: #C0392B;
  --fill-danger-hover: #A93226;
  --color-error: #C0392B;
  --color-surface-hover: rgba(255, 255, 255, 0.04);

  /* Colors – One-off surfaces */
  --surface-raised: #FFFFFF;
  --badge-madani-bg: #EFF7F8;
  --book-glow: rgba(0, 41, 43, 0.35);
  --ribbon-shadow: rgba(0, 68, 70, 0.18);

  /* Colors – Tints for hover backgrounds and hairlines. The number is the alpha in
     hundredths; light is teal or ink, dark is the same alpha of white or light ink. */
  --tint-teal-3: rgba(0, 68, 70, 0.03);
  --tint-teal-4: rgba(0, 68, 70, 0.04);
  --tint-teal-6: rgba(0, 68, 70, 0.06);
  --tint-teal-7: rgba(0, 68, 70, 0.07);
  --tint-teal-8: rgba(0, 68, 70, 0.08);
  --tint-teal-10: rgba(0, 68, 70, 0.1);
  --tint-teal-12: rgba(0, 68, 70, 0.12);
  --tint-teal-14: rgba(0, 68, 70, 0.14);
  --tint-teal-15: rgba(0, 68, 70, 0.15);
  --tint-teal-20: rgba(0, 68, 70, 0.2);
  --tint-ink-6: rgba(18, 49, 47, 0.06);
  --tint-ink-8: rgba(18, 49, 47, 0.08);
  --tint-ink-10: rgba(18, 49, 47, 0.1);
  --tint-ink-12: rgba(18, 49, 47, 0.12);
  --tint-ink-20: rgba(18, 49, 47, 0.2);
```

- [ ] **Step 4: Add the dark block**

Directly after the closing `}` of `:root` (before `/* ── Reduced Motion ── */`), add:

```css
/* ── Dark theme ──
   Set on <html> by the head script in src/lib/theme.ts. Screen only, so printing always uses
   the light values. Tokens left out are the same in both themes (see theme-tokens.test.ts). */
@media screen {
  :root[data-theme="dark"] {
    --surface-page: #0A1C1C;
    --surface-card: #102828;
    --surface-chrome: #00292B;
    --surface-chrome-deep: #001A1B;
    --surface-overlay: rgba(0, 0, 0, 0.6);
    --surface-selection: rgba(205, 185, 68, 0.16);

    --text-primary: #E4EEE9;
    --text-secondary: rgba(228, 238, 233, 0.7);
    --text-tertiary: rgba(228, 238, 233, 0.52);

    --gold-wash: rgba(205, 185, 68, 0.16);
    --gold-label: #D8C766;

    --teal-primary: #5FB8BE;
    --teal-hover: #7CC8CD;
    --teal-press: #4FA5AB;
    --teal-accent: #6CC7CE;
    --makki: #D8C766;
    --madani: #5FB8BE;

    --fill-primary: #1F7C82;
    --fill-primary-hover: #248A91;
    --fill-primary-press: #1A6D72;
    --fill-danger: #B3372B;
    --fill-danger-hover: #9E3026;
    --color-error: #EF8A80;
    --color-surface-hover: rgba(255, 255, 255, 0.05);

    --surface-raised: #153232;
    --badge-madani-bg: rgba(95, 184, 190, 0.14);
    --book-glow: rgba(190, 170, 48, 0.12);
    --ribbon-shadow: rgba(0, 0, 0, 0.45);

    --tint-teal-3: rgba(255, 255, 255, 0.03);
    --tint-teal-4: rgba(255, 255, 255, 0.04);
    --tint-teal-6: rgba(255, 255, 255, 0.06);
    --tint-teal-7: rgba(255, 255, 255, 0.07);
    --tint-teal-8: rgba(255, 255, 255, 0.08);
    --tint-teal-10: rgba(255, 255, 255, 0.1);
    --tint-teal-12: rgba(255, 255, 255, 0.12);
    --tint-teal-14: rgba(255, 255, 255, 0.14);
    --tint-teal-15: rgba(255, 255, 255, 0.15);
    --tint-teal-20: rgba(255, 255, 255, 0.2);
    --tint-ink-6: rgba(228, 238, 233, 0.06);
    --tint-ink-8: rgba(228, 238, 233, 0.08);
    --tint-ink-10: rgba(228, 238, 233, 0.1);
    --tint-ink-12: rgba(228, 238, 233, 0.12);
    --tint-ink-20: rgba(228, 238, 233, 0.2);

    --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.25);
    --shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);
    --shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.35);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/__tests__/theme-tokens.test.ts`
Expected: PASS (4 tests). If "gives every light colour token a dark value" lists a token, add its dark value to the block. Do not add it to `THEME_INDEPENDENT` unless it sits only on the always-dark chrome.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/__tests__/theme-tokens.test.ts
git commit -m "Add dark theme token block and tint, fill and one-off tokens"
```

---

### Task 2: Replace hardcoded colours with tokens, plus the guard test

**Files:**
- Test: `src/app/__tests__/no-hardcoded-colours.test.ts`
- Modify: every file listed in the mapping below.

**Interfaces:**
- Consumes: the Task 1 tokens.
- Produces: no raw theme-dependent colours outside `globals.css`. Later tasks' new CSS must pass the guard.

- [ ] **Step 1: Write the failing guard test**

Create `src/app/__tests__/no-hardcoded-colours.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

// Theme-independent literals: white tints on the always-dark chrome, black for shadows and
// masks, and gold tints, which read the same on both themes.
const ALLOWED = [
  /^rgba\(255, 255, 255, [\d.]+\)$/,
  /^rgba\(0, 0, 0, [\d.]+\)$/,
  /^#000$/,
  /^rgba\(190, 170, 48, [\d.]+\)$/,
  /^rgba\(247, 228, 151, [\d.]+\)$/,
];

function files(ext: string): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith(ext) && !f.includes("__tests__"))
    .map((f) => path.join(SRC, f));
}

function offenders(file: string, pattern: RegExp): string[] {
  const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(pattern)]
    .map((m) => m[0].replace(/\s+/g, " ").replace(/\(\s*/g, "(").replace(/,\s*/g, ", "))
    .filter((literal) => !ALLOWED.some((ok) => ok.test(literal)))
    .map((literal) => `${path.relative(SRC, file)}: ${literal}`);
}

describe("colours come from theme tokens", () => {
  it("CSS modules use no raw theme-dependent colours", () => {
    const found = files(".module.css").flatMap((f) => offenders(f, /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g));
    expect(found).toEqual([]);
  });

  it("inline styles in components use no raw rgba colours", () => {
    // Only rgb(a) here: "#1757" in TSX is an HTML entity, not a colour.
    const found = files(".tsx").flatMap((f) => offenders(f, /rgba?\([^)]*\)/g));
    expect(found).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/__tests__/no-hardcoded-colours.test.ts`
Expected: FAIL. Both tests list offenders, for example `components/ui/badge.module.css: #EFF7F8` and `components/auth-loading.tsx: rgba(0, 68, 70, 0.1)`.

- [ ] **Step 3: Replace the tints with the scale (mechanical)**

In every `src/**/*.module.css`, replace these literals exactly:

| Literal | Replacement |
|---|---|
| `rgba(0, 68, 70, 0.03)` | `var(--tint-teal-3)` |
| `rgba(0, 68, 70, 0.04)` | `var(--tint-teal-4)` |
| `rgba(0, 68, 70, 0.06)` | `var(--tint-teal-6)` |
| `rgba(0, 68, 70, 0.07)` | `var(--tint-teal-7)` |
| `rgba(0, 68, 70, 0.08)` | `var(--tint-teal-8)` |
| `rgba(0, 68, 70, 0.1)` | `var(--tint-teal-10)` |
| `rgba(0, 68, 70, 0.12)` | `var(--tint-teal-12)` |
| `rgba(0, 68, 70, 0.14)` | `var(--tint-teal-14)` |
| `rgba(0, 68, 70, 0.15)` | `var(--tint-teal-15)` |
| `rgba(0, 68, 70, 0.2)` | `var(--tint-teal-20)` |
| `rgba(18, 49, 47, 0.06)` | `var(--tint-ink-6)` |
| `rgba(18, 49, 47, 0.08)` | `var(--tint-ink-8)` |
| `rgba(18, 49, 47, 0.1)` | `var(--tint-ink-10)` |
| `rgba(18, 49, 47, 0.12)` | `var(--tint-ink-12)` |
| `rgba(18, 49, 47, 0.2)` | `var(--tint-ink-20)` |

A shell loop does it safely because the literals are exact. Run from `frontend/` in Git Bash:

```bash
for a in 0.03:3 0.04:4 0.06:6 0.07:7 0.08:8 0.1:10 0.12:12 0.14:14 0.15:15 0.2:20; do
  v=${a%%:*}; n=${a##*:}
  find src -name '*.module.css' -exec sed -i "s/rgba(0, 68, 70, ${v//./\\.})/var(--tint-teal-$n)/g" {} +
done
for a in 0.06:6 0.08:8 0.1:10 0.12:12 0.2:20; do
  v=${a%%:*}; n=${a##*:}
  find src -name '*.module.css' -exec sed -i "s/rgba(18, 49, 47, ${v//./\\.})/var(--tint-ink-$n)/g" {} +
done
```

The `)` after the alpha in the pattern stops `0.1` from matching inside `0.12` or `0.14`.

- [ ] **Step 4: Replace the one-off literals by hand**

| File | Line (today) | From | To |
|---|---|---|---|
| `components/api-warmup-notice.module.css` | 22 | `rgba(0, 68, 70, 0.18)` | `var(--ribbon-shadow)` |
| `components/book-model/book-model.module.css` | 60 | `rgba(0, 41, 43, 0.35)` | `var(--book-glow)` |
| `components/ui/badge.module.css` | 21 | `#EFF7F8` | `var(--badge-madani-bg)` |
| `components/ui/segmented-control.module.css` | 6 | `#fff` | `var(--surface-raised)` |
| `components/scripture/quran-reader-client.module.css` | 64 | `#fff` | `var(--surface-raised)` |
| `components/scripture/quran-reader-client.module.css` | 216 | `#fff` | `var(--text-on-dark)` |
| `components/create-bookmark-dialog.module.css` | 131 | `rgba(180, 141, 61, 0.1)` | `rgba(190, 170, 48, 0.1)` |
| `components/bookmark-tile.module.css` | 60, 65 | `var(--color-error, #c0392b)` | `var(--color-error)` |
| `components/create-bookmark-dialog.module.css` | 92, 97 | `var(--color-error, #c0392b)` | `var(--color-error)` |
| `components/ui/confirm-dialog.module.css` | 66 | `var(--color-error, #c0392b)` | `var(--fill-danger)` |
| `components/ui/confirm-dialog.module.css` | 70 | `var(--color-error-hover, #a93226)` | `var(--fill-danger-hover)` |
| `app/saved/page.module.css` | 55 | `var(--color-surface-hover, rgba(255, 255, 255, 0.04))` | `var(--color-surface-hover)` |

- [ ] **Step 5: Move the teal fills to the fill tokens**

- In `components/ui/button.module.css`, in `.primary` (line 32), change `background: var(--teal-primary);` to `background: var(--fill-primary);`. In its hover rule (line 37), change `background: var(--teal-hover);` to `background: var(--fill-primary-hover);`. If a `:active` rule for `.primary` uses `--teal-press`, change it to `--fill-primary-press`. Leave lines 42–43 (the outline variant's teal text and inset border) on `--teal-primary`.
- In `components/ui/segmented-control.module.css`, in `.active` (line 33), change to `background: var(--fill-primary);`.
- In `components/ui/switch.module.css`, in `.on` (line 27), change to `background: var(--fill-primary);`.

Then check that no other fill still uses teal: run `grep -rn "background[a-z-]*: var(--teal-" src --include=*.module.css`. Any remaining hit that has `color: var(--text-on-dark)` in the same rule moves to the matching `--fill-primary*` token. A teal background with teal-coloured text on top does not move.

- [ ] **Step 6: Replace the inline style literals**

In `src/components/auth-loading.tsx` line 20, change `border: "3px solid rgba(0, 68, 70, 0.1)",` to `border: "3px solid var(--tint-teal-10)",`.

In `src/components/scripture/quran-reader-client.tsx` lines 229 and 286, change `{ borderTop: "1px solid rgba(0,68,70,0.08)" }` to `{ borderTop: "1px solid var(--tint-teal-8)" }`.

- [ ] **Step 7: Run the guard and the whole suite**

Run: `npx vitest run src/app/__tests__/no-hardcoded-colours.test.ts`
Expected: PASS. Any remaining offender is a literal not in the tables above. Give it a Task 1 style token whose light value equals the literal, with a dark counterpart, in both blocks of `globals.css`.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Check that light mode is unchanged**

Run `npm run build`. Expected: succeeds.

Visually compare light mode on `npm run dev` against `main` for the home page, `/quran/1/` and the settings sheet. The token values equal the literals, so there should be no difference other than the create-bookmark selected-icon wash (the accepted exception).

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "Replace hardcoded colours with theme tokens and guard against new ones"
```

---

### Task 3: Theme script and store (`src/lib/theme.ts`)

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/__tests__/theme.test.ts`

**Interfaces:**
- Produces:
  - `type ThemePreference = "light" | "dark" | "system"`
  - `type ResolvedTheme = "light" | "dark"`
  - `const THEME_STORAGE_KEY = "ishqnama-theme"`
  - `const THEME_COLOR: { light: "#004446"; dark: "#00292B" }`
  - `function themeScript(): string`
  - `function useTheme(): { preference: ThemePreference; resolved: ResolvedTheme; setPreference: (p: ThemePreference) => void }`
  - `function setThemePreference(p: ThemePreference): void`
  - `function resetThemeStoreForTests(): void`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/theme.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetThemeStoreForTests,
  setThemePreference,
  THEME_STORAGE_KEY,
  themeScript,
  useTheme,
} from "@/lib/theme";

// Node 25's own experimental localStorage global shadows jsdom's and has no methods, so each test gets an in-memory one.
function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

/** A controllable prefers-color-scheme query. */
function fakeDevice(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: dark,
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.delete(l),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mql));
  return {
    set(next: boolean) {
      mql.matches = next;
      for (const l of listeners) l({ matches: next });
    },
  };
}

const html = () => document.documentElement;
const metaColour = () => document.querySelector('meta[name="theme-color"]')?.getAttribute("content");
const runScript = () => new Function(themeScript())();

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  document.head.innerHTML = '<meta name="theme-color" content="#004446">';
  html().removeAttribute("data-theme");
  html().style.colorScheme = "";
  resetThemeStoreForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("head script", () => {
  it.each([
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
    ["system", false, "light"],
    ["system", true, "dark"],
    [null, true, "dark"],
    ["sepia", false, "light"],
  ])("stored %s on a %s-dark device gives %s", (stored, deviceDark, expected) => {
    fakeDevice(deviceDark);
    if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
    runScript();
    expect(html().getAttribute("data-theme")).toBe(expected);
    expect(html().style.colorScheme).toBe(expected);
    expect(metaColour()).toBe(expected === "dark" ? "#00292B" : "#004446");
  });

  it("treats blocked storage as match my device", () => {
    fakeDevice(true);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    runScript();
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("treats a browser without matchMedia as a light device", () => {
    vi.stubGlobal("matchMedia", undefined);
    runScript();
    expect(html().getAttribute("data-theme")).toBe("light");
  });

  it("does not throw when the theme-color meta is missing", () => {
    fakeDevice(false);
    document.head.innerHTML = "";
    expect(runScript).not.toThrow();
  });
});

describe("theme store", () => {
  it("reads the stored preference and resolves it", () => {
    fakeDevice(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("dark");
    expect(result.current.resolved).toBe("dark");
  });

  it("defaults to match my device", () => {
    fakeDevice(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("system");
    expect(result.current.resolved).toBe("dark");
  });

  it("persists a choice and applies it to the page", () => {
    fakeDevice(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(result.current.resolved).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(html().style.colorScheme).toBe("dark");
    expect(metaColour()).toBe("#00292B");
  });

  it("still switches for this visit when storage is blocked", () => {
    fakeDevice(false);
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => { throw new Error("blocked"); },
    });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(result.current.resolved).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("follows the device while on match my device", () => {
    const device = fakeDevice(false);
    const { result } = renderHook(() => useTheme());
    act(() => device.set(true));
    expect(result.current.resolved).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("ignores the device after an explicit choice", () => {
    const device = fakeDevice(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("light"));
    act(() => device.set(true));
    expect(result.current.resolved).toBe("light");
    expect(html().getAttribute("data-theme")).toBe("light");
  });

  it("follows a choice made in another tab", () => {
    fakeDevice(false);
    const { result } = renderHook(() => useTheme());
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(result.current.preference).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("agrees with the head script for every preference", () => {
    for (const deviceDark of [false, true]) {
      for (const p of ["light", "dark", "system"] as const) {
        fakeDevice(deviceDark);
        localStorage.setItem(THEME_STORAGE_KEY, p);
        runScript();
        const fromScript = [html().getAttribute("data-theme"), html().style.colorScheme, metaColour()];
        html().removeAttribute("data-theme");
        resetThemeStoreForTests();
        setThemePreference(p);
        expect([html().getAttribute("data-theme"), html().style.colorScheme, metaColour()]).toEqual(fromScript);
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/theme"`.

- [ ] **Step 3: Implement `src/lib/theme.ts`**

```ts
import { useSyncExternalStore } from "react";

/**
 * Light, dark or following the device, remembered per browser.
 *
 * themeScript() runs inline in the document head before first paint and sets data-theme,
 * color-scheme and the theme-color meta on <html>, so the prerendered page never flashes the
 * wrong colours. The store below takes over after hydration: it keeps the page in step with
 * the device while the preference is "system", follows choices made in other tabs, and backs
 * useTheme() for the app-bar menu. The two apply the same three changes; the "agrees with the
 * head script" test keeps them in step.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ishqnama-theme";

/** The browser bar colour for each theme: the app bar's chrome colour. */
export const THEME_COLOR = { light: "#004446", dark: "#00292B" } as const;

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Inline script for the document head. It must stay self-contained ES5: it runs before any bundle. */
export function themeScript(): string {
  return `(function(){
var p="system";
try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(s==="light"||s==="dark"||s==="system")p=s;}catch(e){}
var d=p==="dark"||(p==="system"&&typeof window.matchMedia==="function"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);
var t=d?"dark":"light";
var h=document.documentElement;
h.setAttribute("data-theme",t);
h.style.colorScheme=t;
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute("content",d?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)});
})();`;
}

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  } catch {
    return "system";
  }
}

function deviceQuery(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : null;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return deviceQuery()?.matches ? "dark" : "light";
}

function apply(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

const SERVER_STATE: ThemeState = { preference: "system", resolved: "light" };

let state: ThemeState | null = null;
// A choice made while storage is blocked lives here for the rest of the visit.
let sessionPreference: ThemePreference | null = null;
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

function compute(): ThemeState {
  const preference = sessionPreference ?? readPreference();
  return { preference, resolved: resolve(preference) };
}

/** Re-reads storage and the device, applies the result and notifies subscribers of a change. */
function refresh(): void {
  const next = compute();
  apply(next.resolved);
  if (state && state.preference === next.preference && state.resolved === next.resolved) return;
  state = next;
  for (const listener of listeners) listener();
}

function attach(): () => void {
  const query = deviceQuery();
  const onDevice = () => refresh();
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY && e.key !== null) return;
    sessionPreference = null;
    refresh();
  };
  query?.addEventListener?.("change", onDevice);
  window.addEventListener("storage", onStorage);
  return () => {
    query?.removeEventListener?.("change", onDevice);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!detach) {
    detach = attach();
    // Re-apply once after hydration: if Next.js placed the theme-color meta after the head
    // script, the script could not update it.
    apply(getSnapshot().resolved);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
}

// Called during render, so it never notifies: it only fills the first snapshot. The head script
// has already applied the same theme to the page.
function getSnapshot(): ThemeState {
  if (!state) state = compute();
  return state;
}

/** Remembers the choice in this browser (or for this visit when storage is blocked) and applies it. */
export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
    sessionPreference = null;
  } catch {
    sessionPreference = preference;
  }
  refresh();
}

export function useTheme(): ThemeState & { setPreference: (p: ThemePreference) => void } {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
  return { ...current, setPreference: setThemePreference };
}

/** Test-only: forget cached state and listeners so each test starts from storage. */
export function resetThemeStoreForTests(): void {
  detach?.();
  detach = null;
  listeners.clear();
  state = null;
  sessionPreference = null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/theme.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/lib/__tests__/theme.test.ts
git commit -m "Add theme preference head script and store"
```

---

### Task 4: Wire the head script into the root layout

**Files:**
- Modify: `src/app/layout.tsx` (import near line 5; `<html>` at line 60; `<head>` at lines 65–70)

**Interfaces:**
- Consumes: `themeScript()` from Task 3.

- [ ] **Step 1: Add the script and hydration flag**

Add `import { themeScript } from "@/lib/theme";` next to the `pwaManifestScript` import.

On `<html`, add the attribute `suppressHydrationWarning` (after `lang="en"`).

Inside `<head>`, before the existing PWA script comment, add:

```tsx
        {/* Sets data-theme, color-scheme and theme-color from the reader's Light / Dark /
            Match my device choice before first paint, so a dark reader never sees a light
            flash. Inlined for the same reason as the manifest script. See src/lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
```

Leave `viewport.themeColor: "#004446"` as it is: it is the prerendered default that the script and store overwrite.

- [ ] **Step 2: Verify in the built output**

Run: `npm run build`
Expected: succeeds. Then run `grep -c 'ishqnama-theme' out/index.html out/redirect/index.html`. Expected: `1` for each file, which confirms the script also reaches the MSAL bridge page.

- [ ] **Step 3: Verify no flash on the dev server**

Run `npm run dev`. In Chrome DevTools, open Rendering and set "Emulate CSS media feature prefers-color-scheme: dark", then hard-reload `http://localhost:3000/quran/1/`. Expected: the page is dark from the first frame, with no hydration warning in the console. Then run `localStorage.setItem("ishqnama-theme","light")` in the console and reload. Expected: light, even though the device emulation is dark.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "Apply the theme preference in the document head before first paint"
```

---

### Task 5: Copy, icons and the app-bar theme menu

**Files:**
- Create: `src/config/theme-copy.ts`, `src/config/__tests__/theme-copy.test.ts`
- Modify: `src/components/ui/icon.tsx` (the `icons` record)
- Create: `src/components/navigation/theme-menu.tsx`, `src/components/navigation/theme-menu.module.css`, `src/components/navigation/__tests__/theme-menu.test.tsx`
- Modify: `src/components/navigation/app-bar.tsx:51`, `src/components/navigation/app-bar.module.css`

**Interfaces:**
- Consumes: `useTheme`, `ThemePreference` from Task 3.
- Produces: `THEME_MENU_LABEL: string`, `THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: "sun" | "moon" | "monitor" }>`; default export `ThemeMenu`.

- [ ] **Step 1: Write the failing copy test**

Create `src/config/__tests__/theme-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { THEME_MENU_LABEL, THEME_OPTIONS } from "@/config/theme-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
const BANNED = /(system|theme|\bapi\b|server|service|\bmode\b)/i;

const allStrings = [THEME_MENU_LABEL, ...THEME_OPTIONS.map((o) => o.label)];

describe("theme copy", () => {
  it("offers light, dark and match my device, in that order", () => {
    expect(THEME_OPTIONS.map((o) => o.value)).toEqual(["light", "dark", "system"]);
  });

  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string short and in sentence case", () => {
    for (const s of allStrings) {
      expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
      expect(s[0], s).toBe(s[0].toUpperCase());
      for (const word of s.split(/\s+/).slice(1)) expect(word, s).toBe(word.toLowerCase());
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config/__tests__/theme-copy.test.ts`
Expected: FAIL with `Failed to resolve import "@/config/theme-copy"`.

- [ ] **Step 3: Create the copy file**

Create `src/config/theme-copy.ts`:

```ts
import type { ThemePreference } from "@/lib/theme";

/**
 * Reader-facing words for the app-bar appearance menu. Same rule as readiness-copy.ts and
 * sign-in-copy.ts: no technical words ("system", "theme", "mode"), enforced by
 * src/config/__tests__/theme-copy.test.ts.
 */
export const THEME_MENU_LABEL = "Appearance";

export const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: "sun" | "moon" | "monitor";
}> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "Match my device", icon: "monitor" },
];
```

Run: `npx vitest run src/config/__tests__/theme-copy.test.ts`
Expected: PASS.

- [ ] **Step 4: Add the icons**

In `src/components/ui/icon.tsx`, after the `moon` entry, add:

```ts
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  monitor: "M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4",
```

- [ ] **Step 5: Write the failing menu test**

Create `src/components/navigation/__tests__/theme-menu.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setPreference = vi.fn();
let theme = { preference: "system", resolved: "light", setPreference };
vi.mock("@/lib/theme", () => ({ useTheme: () => theme }));

import ThemeMenu from "@/components/navigation/theme-menu";

describe("ThemeMenu", () => {
  beforeEach(() => {
    setPreference.mockReset();
    theme = { preference: "system", resolved: "light", setPreference };
  });

  it("renders its button without any sign-in context", () => {
    render(<ThemeMenu />);
    expect(screen.getByRole("button", { name: "Appearance" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens to three choices with the current one checked", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual(["Light", "Dark", "Match my device"]);
    expect(items.map((i) => i.getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);
  });

  it("applies a choice and closes", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(setPreference).toHaveBeenCalledWith("dark");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape and returns focus to the button", () => {
    render(<ThemeMenu />);
    const button = screen.getByRole("button", { name: "Appearance" });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes on a click outside", () => {
    render(<div><ThemeMenu /><p>outside</p></div>);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows the icon of the theme on screen", () => {
    const { container, rerender } = render(<ThemeMenu />);
    expect(container.querySelector('[data-icon="sun"]')).toBeTruthy();
    theme = { ...theme, resolved: "dark" };
    rerender(<ThemeMenu />);
    expect(container.querySelector('[data-icon="moon"]')).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/navigation/__tests__/theme-menu.test.tsx`
Expected: FAIL with `Failed to resolve import "@/components/navigation/theme-menu"`.

- [ ] **Step 7: Implement the menu**

Create `src/components/navigation/theme-menu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { THEME_MENU_LABEL, THEME_OPTIONS } from "@/config/theme-copy";
import { useTheme } from "@/lib/theme";
import styles from "./theme-menu.module.css";

/** App-bar button for Light / Dark / Match my device. Open to every reader; the choice is kept in this browser. */
export default function ThemeMenu() {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  const icon = resolved === "dark" ? "moon" : "sun";

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={THEME_MENU_LABEL}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span data-icon={icon} className={styles.iconSlot}>
          <Icon name={icon} size={20} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={THEME_MENU_LABEL}
          className={styles.dropdown}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option.value}
              className={styles.item}
              onClick={() => {
                setPreference(option.value);
                close();
              }}
            >
              <Icon name={option.icon} size={18} />
              <span className={styles.itemLabel}>{option.label}</span>
              {preference === option.value && <Icon name="check" size={16} className={styles.check} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

The test's `textContent` expectation needs icons to render no text. `Icon` renders an `<svg>` with a path and no text, so the label is the only text.

Create `src/components/navigation/theme-menu.module.css`:

```css
.wrapper {
  position: relative;
}

.button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--text-on-dark-muted);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.button:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-on-dark);
}

.iconSlot {
  display: flex;
}

.dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  width: 220px;
  background: var(--surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-dropdown);
  padding: var(--space-2);
  z-index: 200;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  font-size: var(--text-base);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.item:hover {
  background: var(--tint-teal-4);
  color: var(--text-primary);
}

.item[aria-checked="true"] {
  color: var(--text-primary);
  font-weight: 600;
}

.itemLabel {
  flex: 1;
  text-align: start;
}

.check {
  color: var(--teal-primary);
}
```

- [ ] **Step 8: Run the menu test**

Run: `npx vitest run src/components/navigation/__tests__/theme-menu.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 9: Place it in the app bar**

In `src/components/navigation/app-bar.tsx`, add `import ThemeMenu from "./theme-menu";`. Then replace line 51, `<UserMenu />`, with:

```tsx
        <div className={styles.actions}>
          <ThemeMenu />
          <UserMenu />
        </div>
```

`.inner` is `justify-content: space-between` across three children, so the wrapper keeps the brand, nav and actions spacing as it is today. In `src/components/navigation/app-bar.module.css`, add:

```css
.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
```

- [ ] **Step 10: Run the suite and the build**

Run: `npm test`
Expected: all pass, including `nav-saved-visible.test.tsx`. If that test fails because `ThemeMenu` calls `useTheme` in an environment without `matchMedia`, it should not: `deviceQuery()` returns `null` when `matchMedia` is missing. Fix the store, not the test.

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 11: Commit**

```bash
git add src/config/theme-copy.ts src/config/__tests__/theme-copy.test.ts src/components/ui/icon.tsx src/components/navigation
git commit -m "Add the appearance menu to the app bar"
```

---

### Task 6: Themed logo

**Files:**
- Create: `src/components/themed-logo.tsx`, `src/components/__tests__/themed-logo.test.tsx`
- Modify: `src/app/globals.css` (a rule under `/* ── Utility ── */`), `src/components/navigation/footer.tsx:25-32`, `src/components/sign-in-prompt-sheet.tsx:98`, `src/components/pwa-install-prompt.tsx:59-63`

**Interfaces:**
- Produces: default export `ThemedLogo({ alt, width, height, className }: { alt: string; width?: number; height?: number; className?: string })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/themed-logo.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThemedLogo from "@/components/themed-logo";

describe("ThemedLogo", () => {
  it("renders the teal logo for light and the gold one for dark", () => {
    const { container } = render(<ThemedLogo alt="Ishqnama" width={32} height={27} className="x" />);
    const [light, dark] = [...container.querySelectorAll("img")];
    expect(light.getAttribute("src")).toBe("/logo-ishqnama.svg");
    expect(light.classList.contains("logo-light")).toBe(true);
    expect(dark.getAttribute("src")).toBe("/logo-ishqnama-gold.svg");
    expect(dark.classList.contains("logo-dark")).toBe(true);
    for (const img of [light, dark]) {
      expect(img.classList.contains("x")).toBe(true);
      expect(img.getAttribute("width")).toBe("32");
    }
  });

  it("gives only one of the pair an accessible name", () => {
    const { container } = render(<ThemedLogo alt="Ishqnama" />);
    const [light, dark] = [...container.querySelectorAll("img")];
    expect(light.getAttribute("alt")).toBe("Ishqnama");
    expect(dark.getAttribute("alt")).toBe("");
    expect(dark.getAttribute("aria-hidden")).toBe("true");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/__tests__/themed-logo.test.tsx`
Expected: FAIL with `Failed to resolve import "@/components/themed-logo"`.

- [ ] **Step 3: Implement**

Create `src/components/themed-logo.tsx`:

```tsx
/**
 * The Ishqnama mark, teal on light pages and gold on dark ones. Both images are rendered and
 * CSS in globals.css shows the one for the current data-theme, so it is right from the first
 * paint and follows live theme changes without a hydration check. The hidden image is
 * display:none, so assistive tech sees only the visible one's alt; the gold one is also
 * marked aria-hidden so the pair never reads twice.
 */
export default function ThemedLogo({
  alt,
  width,
  height,
  className = "",
}: {
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-ishqnama.svg" alt={alt} width={width} height={height} className={`logo-light ${className}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-ishqnama-gold.svg"
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className={`logo-dark ${className}`}
      />
    </>
  );
}
```

In `src/app/globals.css`, under `/* ── Utility ── */`, add:

```css
/* ── Themed logo (see src/components/themed-logo.tsx) ── */
.logo-dark {
  display: none !important;
}

@media screen {
  :root[data-theme="dark"] .logo-light {
    display: none !important;
  }

  :root[data-theme="dark"] .logo-dark {
    display: block !important;
  }
}
```

`!important` is needed because the consumer's module class may set `display`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/themed-logo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Use it at the three call sites**

- `src/components/navigation/footer.tsx`, lines 25–32: replace the `<Image src="/logo-ishqnama.svg" … />` with `<ThemedLogo alt="" width={28} height={28} className={styles.logo} />`. Add `import ThemedLogo from "@/components/themed-logo";`. Remove the `next/image` import if nothing else in the file uses it.
- `src/components/sign-in-prompt-sheet.tsx`, line 98 (and the eslint comment on line 97): replace with `<ThemedLogo alt="" width={32} height={27} className={styles.mark} />`, and add the import.
- `src/components/pwa-install-prompt.tsx`, lines 58–63: replace the eslint comment and `<img … />` with `<ThemedLogo alt="Ishqnama" className={styles.icon} />`, and add the import.

Then check the sign-in sheet's `.markCircle` background: if it is `--gold-wash` or `--surface-*`, the gold logo on its dark value reads well, so change nothing. If it is a literal, Task 2's guard would already have caught it.

- [ ] **Step 6: Run the suite**

Run: `npm test && npm run lint`
Expected: all pass. If an existing sign-in-sheet or footer test queries `img` by role or alt, update it to query the visible `.logo-light` image, because both images are now in the DOM.

- [ ] **Step 7: Commit**

```bash
git add src/components/themed-logo.tsx src/components/__tests__/themed-logo.test.tsx src/app/globals.css src/components/navigation/footer.tsx src/components/sign-in-prompt-sheet.tsx src/components/pwa-install-prompt.tsx
git commit -m "Show the gold logo on dark pages"
```

---

### Task 7: Visual check and documentation

**Files:**
- Modify: `CLAUDE.md` (repo root, the Frontend list, after the **Global loading indicator** bullet)

- [ ] **Step 1: Visual check in both themes**

Run `npm run dev`, which must not share `.next` with a concurrent `npm run build`. Use the appearance menu to switch themes. At 390×844 and 1280×800, check each page in Light and in Dark:

- `/` signed out: the hero, the book (live scene and poster), the gold glow under the book in dark, and the footer logo in gold.
- `/quran/`: the Sura and Juz views, the ruku rails and their hairlines.
- `/quran/2/` in both reading modes: the ruku ع, a juz quarter mark, the verse popup on the raised surface, and `/quran/1/?verse=5` for the flash.
- The settings sheet: segmented control, switches (on uses `--fill-primary`), stepper.
- The sign-in prompt (tap the gear while signed out): the gold logo in dark.
- The share sheet.
- `/saved/` signed out.
- The cold-start ribbon: block `/api/healthz` in DevTools request blocking and reload.
- `/about/`: the MDMS logo and the inspect book.

Expected: in Light, nothing differs from `main` (except the create-bookmark selected-icon wash). In Dark, no element is unreadable, no teal-on-teal text appears, and no white box remains. Fix anything found by adding or adjusting a token in `globals.css`, keeping the guard test green, and re-run `npm test`.

Also check Chrome's print preview in Dark: it should be light.

- [ ] **Step 2: Document in `CLAUDE.md`**

After the **Global loading indicator** bullet in the Frontend list, add:

```markdown
- **Dark mode**: readers choose Light, Dark or Match my device (the default) from the appearance button in the app bar (`src/components/navigation/theme-menu.tsx`), open to everyone and never behind the sign-in prompt. The choice is kept per browser in `localStorage` (`ishqnama-theme`: `light`, `dark` or `system`), not in the account settings. `themeScript()` in `src/lib/theme.ts` is inlined in the root layout's head and sets `data-theme`, `color-scheme` and the `theme-color` meta on `<html>` before first paint (so the static pages never flash, including `/redirect/`); the store in the same file (`useTheme()`) then follows the device while on Match my device and follows other tabs through the `storage` event. The palette is a token swap: `globals.css` keeps the light values in `:root` and redefines them under `@media screen { :root[data-theme="dark"] }` (screen only, so printing stays light). Teal is split into a text role (`--teal-primary`, lightened in dark) and a fill role behind white text (`--fill-primary*`, used by the primary button, active segment and switch), and error likewise (`--color-error` for text, `--fill-danger*` for the confirm dialog's button). Hover backgrounds and hairlines use the `--tint-teal-N` / `--tint-ink-N` scale (N is the alpha in hundredths). Every colour in a CSS module or inline style must be a token: `src/app/__tests__/no-hardcoded-colours.test.ts` fails on raw colours except white, black and gold tints, and `theme-tokens.test.ts` fails when a light colour token has no dark value. The teal logo is rendered through `src/components/themed-logo.tsx`, which renders the teal and gold marks and lets CSS show the one for the theme. The manifest, favicon and OG image stay light. Design in `plans/frontend-dark-mode-spec.md`
```

- [ ] **Step 3: Final verification**

Run from `frontend/`: `npm test && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md src
git commit -m "Document dark mode and polish dark tokens after the visual check"
```
