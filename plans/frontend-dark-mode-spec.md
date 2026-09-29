# Frontend dark mode

Design spec, 2026-09-29. The implementation plan that follows this spec goes in
`plans/frontend-dark-mode-plan.md`.

## Context

Ishqnama has one light palette. Readers use the Quran reader at night and in dim rooms, and
most phones and computers now offer a dark setting that apps are expected to follow. The site
has no `prefers-color-scheme`, `data-theme` or `color-scheme` handling anywhere.

The starting point is favourable: every core colour is a CSS custom property in the `:root`
block of `frontend/src/app/globals.css`, styling is CSS Modules plus `globals.css` and
`ornaments.css`, and there is no UI library with its own theme. The obstacles are:

1. About 100 hardcoded colour literals across roughly 37 `*.module.css` files (and two inline
   styles in `quran-reader-client.tsx` and `auth-loading.tsx`), mostly teal or ink tints such as
   `rgba(0,68,70,.03–.2)` and `rgba(18,49,47,.06–.2)` for hover backgrounds and borders, plus a
   few literal `#fff` surfaces. These would look wrong on a dark page.
2. `--teal-primary` is used 12 times as a text colour and 3 times as a fill behind white text
   (`ui/button` primary, `ui/segmented-control` active, `ui/switch` on). No single dark value
   serves both.
3. `--color-error`, `--color-error-hover` and `--color-surface-hover` are referenced with
   fallbacks but never defined.
4. The teal logo `public/logo-ishqnama.svg` (footer, sign-in sheet, PWA install prompt) would be
   nearly invisible on a dark page.
5. `viewport.themeColor` in `layout.tsx` is a single value.
6. Anonymous readers cannot open the settings sheet (the reader-toolbar gear goes through the
   sign-in prompt and the user menu appears only after sign-in), so a theme control in the sheet
   would be out of their reach.

## Goals

- Readers choose **Light**, **Dark** or **Match my device**; the default is Match my device.
- The choice applies before first paint on every page, including the static prerendered HTML and
  the `/redirect/` MSAL bridge, so a dark reader never sees a light flash.
- With Match my device, the open page follows the device switching live.
- The control is available to every reader, signed in or not, and never goes through the sign-in
  gate.
- Light mode is pixel-identical to today.
- The dark palette keeps the brand recognisable: deep teal night, gold unchanged.

## Non-goals

- Syncing the choice to the account. It is stored per browser only; a reader who picks Dark on
  their phone picks it again on their laptop. No backend or `UserSettingsDto` change.
- A theme setting in the settings sheet.
- A separate sepia or reading-only palette.
- Theming the installed PWA splash screen, the favicon or the Open Graph image.
- Changes to the book model's lighting, the served `.glb` or the poster image.

## Decisions

| Question | Decision |
|---|---|
| Purpose | Both night reading comfort and following the device: default Match my device, with a Light / Dark override |
| Storage | `localStorage` per browser, key `ishqnama-theme`, values `light`, `dark`, `system` |
| Palette | "Deep teal night" (mockup A): dark teal page and cards, lightened teal accents, gold unchanged |
| Control | An icon button in the app bar for everyone, opening a three-item menu |
| Mechanism | Token swap under `:root[data-theme="dark"]`, set on `<html>` by an inline head script |

Rejected mechanisms: the CSS `light-dark()` function (needs Safari 17.5+, so older iPhones would
need this mechanism as a fallback anyway) and per-component `[data-theme=dark]` overrides (spreads
the palette across about 40 files).

## Design

### 1. Palette and tokens

`globals.css` keeps today's `:root` as the light theme. A new `:root[data-theme="dark"]` block
redefines the same tokens. Token names used by components do not change, except for the new
tokens listed below.

**Surfaces**

| Token | Light (today) | Dark |
|---|---|---|
| `--surface-page` | `#EDF5ED` | `#0A1C1C` |
| `--surface-card` | `#FFFFFF` | `#102828` |
| `--surface-chrome` | `#004446` | `#00292B` |
| `--surface-chrome-deep` | `#00292B` | `#001A1B` |
| `--surface-overlay` | `rgba(0,41,43,.55)` | `rgba(0,0,0,.6)` |
| `--surface-selection` | `#FBF3D0` | `rgba(205,185,68,.16)` |

**Text**

| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#12312F` | `#E4EEE9` |
| `--text-secondary` | `rgba(18,49,47,.72)` | `rgba(228,238,233,.70)` |
| `--text-tertiary` | `rgba(18,49,47,.55)` | `rgba(228,238,233,.52)` |
| `--text-on-dark`, `-muted`, `-subtle` | unchanged | unchanged |

**Gold**

| Token | Light | Dark |
|---|---|---|
| `--gold` | `#BEAA30` | `#BEAA30` |
| `--gold-bright` | `#F7E497` | `#F7E497` |
| `--gold-wash` | `#FBF3D0` | `rgba(205,185,68,.16)` |
| `--gold-label` | `#8A7A1E` | `#D8C766` |
| `--makki` | `#8A7A1E` | `#D8C766` |

**Teal, split into text and fill roles**

| Token | Light | Dark | Role |
|---|---|---|---|
| `--teal-primary` | `#004446` | `#5FB8BE` | text, links, icons, borders |
| `--teal-hover` | `#003234` | `#7CC8CD` | hover on teal text |
| `--teal-press` | `#002526` | `#4FA5AB` | press on teal text |
| `--teal-accent` | `#107E8D` | `#6CC7CE` | focus outlines |
| `--madani` | `#004446` | `#5FB8BE` | follows `--teal-primary` |
| `--fill-primary` (new) | `#004446` | `#1F7C82` | fill behind `--text-on-dark` |
| `--fill-primary-hover` (new) | `#003234` | `#248A91` | |
| `--fill-primary-press` (new) | `#002526` | `#1A6D72` | |

`ui/button` primary, `ui/segmented-control` active and `ui/switch` on move from
`--teal-primary`/`--teal-hover`/`--teal-press` to the `--fill-primary*` tokens. White on
`#1F7C82` is about 4.6:1.

**New tokens that replace the hardcoded literals**

| Token | Light (equals the literal it replaces) | Dark |
|---|---|---|
| `--tint-teal-N` (N = 3, 4, 6, 7, 8, 10, 12, 14, 15, 20) | `rgba(0,68,70,N/100)` | `rgba(255,255,255,N/100)` |
| `--tint-ink-N` (N = 6, 8, 10, 12, 20) | `rgba(18,49,47,N/100)` | `rgba(228,238,233,N/100)` |
| `--surface-raised` | `#FFFFFF` | `#153232` |
| `--badge-madani-bg` | `#EFF7F8` | `rgba(95,184,190,.14)` |
| `--ribbon-shadow` | `rgba(0,68,70,.18)` | `rgba(0,0,0,.45)` |
| `--color-error` | `#C0392B` | `#EF8A80` |
| `--fill-danger` (new) | `#C0392B` | `#B3372B` |
| `--fill-danger-hover` (new) | `#A93226` | `#9E3026` |
| `--color-surface-hover` | `rgba(255,255,255,.04)` | `rgba(255,255,255,.05)` |
| `--book-glow` | `rgba(0,41,43,.35)` | `rgba(190,170,48,.12)` |

The tint scale is named by alpha rather than by role (hover, hairline), because the codebase
uses eleven distinct teal alphas and five ink alphas across roles; one token per literal keeps
light mode pixel-identical. The one accepted light-mode change is the stray
`rgba(180,141,61,.1)` in `create-bookmark-dialog.module.css`, which becomes the gold tint
`rgba(190,170,48,.1)`. Literals that are the same in both themes by design stay as literals and
are allowed by the guard test: white tints (on the always-dark chrome), black (shadows and
masks) and gold tints (see Testing).

The dark block sits inside `@media screen`, so printing always uses the light values (this
replaces a separate print override).

The light values of `--color-error` and `--color-surface-hover` are the fallbacks their call
sites already use (`#c0392b` and `rgba(255,255,255,.04)`), so defining them changes nothing in
light. Error is split like teal: `--color-error` stays the text and border colour (bookmark
tile, create-bookmark dialog), and the confirm dialog's destructive button, which is a fill
behind white text, moves from `--color-error`/`--color-error-hover` to `--fill-danger`/
`--fill-danger-hover`. `--color-error-hover` is then unused and is not defined.

**Shadows** (`--shadow-card`, `--shadow-card-hover`, `--shadow-dropdown`, `--shadow-modal`) keep
their light values and become black-based in dark (`rgba(0,0,0,.35)` to `rgba(0,0,0,.5)` at the
same offsets and blurs), because teal shadows vanish on a teal page.

**Ornaments** (`--ornament-gold`, `--ornament-gold-strong`) and `--gradient-splash` are unchanged.
The dark teal panels (home hero, sura header, continue-reading card) keep their gradient in both
themes; they are lighter than the dark page, so they remain distinct.

**Printing**: the dark block is scoped to `@media screen`, so printed pages always use the light
values regardless of `data-theme`.

### 2. Theme script, store and control

**`frontend/src/lib/theme.ts`** exports:

- `THEME_STORAGE_KEY = "ishqnama-theme"`, the `ThemePreference` type (`"light" | "dark" |
  "system"`) and `ResolvedTheme` (`"light" | "dark"`).
- `THEME_COLOR = { light: "#004446", dark: "#00292B" }`.
- `themeScript(): string`, an inline script for the document head. It reads the key from
  `localStorage` inside `try/catch` (any other value, or a throw, means `system`), resolves
  `system` with `matchMedia("(prefers-color-scheme: dark)")`, and sets `data-theme` and
  `style.colorScheme` on `document.documentElement` and the `content` of
  `<meta name="theme-color">`.
- `useTheme(): { preference, resolved, setPreference }`, backed by a module-level store with
  `useSyncExternalStore`, as `src/lib/api-readiness.ts` is. The store:
  - initialises from `localStorage` and `matchMedia` on the client and reports
    `{ preference: "system", resolved: "light" }` on the server snapshot;
  - `setPreference(p)` writes `localStorage` (swallowing a throw), applies the same three DOM
    updates as the head script, and notifies subscribers;
  - listens to the `matchMedia` `change` event and re-applies while the preference is `system`;
  - listens to the `storage` event for the key, so other open tabs follow.

The DOM-applying code is written once and used by both the head script (serialised with
`Function.prototype.toString`, or kept as one source string) and the store, so the two cannot
drift.

**`frontend/src/app/layout.tsx`** renders `<script dangerouslySetInnerHTML={{ __html:
themeScript() }} />` in the head next to `pwaManifestScript()`, adds `suppressHydrationWarning`
to `<html>` (the script sets attributes React did not render), and keeps
`viewport.themeColor: "#004446"` as the prerendered default that the script overrides.

**`frontend/src/components/navigation/theme-menu.tsx`**: an icon button rendered in
`app-bar.tsx` immediately before `<UserMenu />`, for every reader.

- The icon follows `resolved`: the existing `moon` icon in dark, a new `sun` icon in light.
  `aria-label` "Appearance", `aria-haspopup="menu"`, `aria-expanded`.
- It opens a dropdown styled like the user menu's with three `menuitemradio` items, the current
  preference checked: **Light**, **Dark**, **Match my device** (new `monitor` icon).
- Choosing an item calls `setPreference` and closes the menu. An outside click or Escape closes
  it; Escape returns focus to the button.
- One 40px icon button, sized to fit the phone app bar beside the sign-in button or avatar.

**`frontend/src/config/theme-copy.ts`** holds the button label and the three item labels, under
the same non-technical rule as `readiness-copy.ts` and `sign-in-copy.ts` (no "system", "theme",
"API", "server" and the like).

**`frontend/src/components/ui/icon.tsx`** gains `sun` and `monitor`.

### 3. Edge cases

- **Teal logo.** A `ThemedLogo` component (`src/components/themed-logo.tsx`) replaces the three
  `<img src="/logo-ishqnama.svg">` uses in `footer.tsx`, `sign-in-prompt-sheet.tsx` and
  `pwa-install-prompt.tsx`. It renders both images: the teal `logo-ishqnama.svg` and the gold
  `logo-ishqnama-gold.svg`, and a global rule shows the gold one only under `[data-theme=dark]`
  and the teal one otherwise. Being CSS-driven, it is correct from the first paint, needs no
  hydration check, and follows live theme changes. The favicon stays teal.
- **MDMS logo** (`public/images/mdms-logo.webp`, About page): checked while planning; its gold
  and green artwork has a filled white centre and reads on dark, so it needs no plate.
- **Book model and poster.** The poster is transparent (RGBA) and `book-scene.ts` renders with
  `alpha: true`, so both sit on the dark page unchanged. The teal radial glow in
  `book-model.module.css` moves to `--book-glow`.
- **Gold chrome details.** The loading rail, warm-up ribbon, ruku ع, sajdah and juz quarter marks
  use `--gold` and chrome surfaces, which do not change in value. They need only a visual check.
- **Arabic and translation text.** Colour comes from `--text-primary` and `--text-secondary`; no
  font change. Urdu at `--text-secondary` on `--surface-card` is about 9:1.
- **Selection and the `?verse=` flash** use `--surface-selection` and `--gold-wash`, subtle in
  dark at .16 alpha.
- **Manifest.** `public/manifest.json` stays light (`background_color #EDF5ED`,
  `theme_color #004446`); a manifest cannot follow a per-browser preference. The live status bar
  follows the `theme-color` meta. An installed app's splash screen stays light, which is accepted.
- **OG image.** Unchanged.
- **`/redirect/` bridge.** The head script is in the root layout, so the bridge page is themed and
  the popup or iframe never flashes white.
- **Inline styles.** The two inline `rgba(0,68,70,0.08)` borders in `quran-reader-client.tsx` and
  the colours in `auth-loading.tsx` move to CSS module classes using the tokens.

## Testing

Unit tests (Vitest, jsdom). Tests that touch `localStorage` use the in-memory `vi.stubGlobal`
stub, because Node 25's experimental `localStorage` global shadows jsdom's.

- `src/lib/__tests__/theme.test.ts`
  - The head script, run with `new Function(themeScript())()` against stubbed `localStorage` and
    `matchMedia`, sets `data-theme`, `colorScheme` and the `theme-color` meta for each stored
    value, for an unknown value, and when `localStorage` throws.
  - `setPreference` persists, updates `<html>` and notifies.
  - With `system`, a `matchMedia` change flips `resolved`; with `light` or `dark` it does not.
  - A `storage` event for the key updates the store.
- `src/components/navigation/__tests__/theme-menu.test.tsx`
  - Renders for an anonymous reader, with no sign-in prompt involved.
  - Opens to three items with the current preference checked.
  - Choosing an item calls `setPreference` and closes; Escape closes and restores focus.
  - The icon follows `resolved`.
- `src/config/__tests__/theme-copy.test.ts`: the copy contains none of the banned technical words.
- `src/app/__tests__/theme-tokens.test.ts`: parses `globals.css` and checks that every colour
  custom property defined in the light `:root` is also defined in `:root[data-theme="dark"]`.
- `src/app/__tests__/no-hardcoded-colours.test.ts`: scans `src/**/*.module.css` and fails on
  `#hex`, `rgb(` or `rgba(` literals outside an explicit allowlist of theme-independent values.

Visual check on the dev server in Chrome, light and dark, at phone and desktop widths: signed-out
home (hero and book), Quran index with ruku rails, a sura reader in both reading modes with a
ruku mark, a quarter mark and a `?verse=` flash, the settings, sign-in and share sheets, `/saved/`
skeletons, the cold-start ribbon, and About. Light screenshots are taken before and after the
tokenising and compared, to confirm light mode is unchanged.

## Documentation

- A **Dark mode** bullet in `CLAUDE.md` under Frontend: the three preferences, the storage key,
  the head script and store in `src/lib/theme.ts`, the `:root[data-theme="dark"]` token block,
  the text/fill teal split, the rule that new colours must be tokens (enforced by the guard test),
  and the `ThemedLogo` swap.
