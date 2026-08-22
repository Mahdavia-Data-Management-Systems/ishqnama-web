# Ishqnama Design System

> Extracted from `frontend/design/Ishqnama_Design_System.pptx` (12 slides).

---

## Brand Identity

**Ishqnama** — the web and Android product name for **Noor e Imaan** (نورِ ایمان), a tarjuma wa tafseer of the Holy Quran by Syed Meeranji Abid Khundmiri. A printed volume from the Mahdavia tradition, carried onto the web and Android.

Two products share this system:
- **Website** — Home page, Quran reader, sign-in via Microsoft Entra External ID *(live)*
- **Android app** — Tafseer Al Quraan — splash, SURA/JUZ chapter index, reading view

**Core principle:** Reading is never gated behind an account. Signing in only adds last-read position, bookmarks, and favourites.

---

## Colour Palette

Deep teal and gold carry the brand. Everything else is paper, ink, and two manuscript accents held back for illustration.

### Primary Colours

| Token | Hex | Role |
|---|---|---|
| **Teal-900** | `#00292B` | Logo fill, every dark surface, deep backgrounds |
| **Teal-700** | `#004446` | Primary teal, chrome surfaces |
| **Teal-600** | `#107E8D` | Android app bar, accent teal |
| **Gold-500** | `#BEAA30` | Manuscript title gold, mark on light surfaces |
| **Gold-300** | `#F7E497` | Mark on dark surfaces, bright gold accents |
| **Paper** | `#EDF5ED` | Mint-cream page background (like the printed page) |

### Extended Palette

| Hex | Usage |
|---|---|
| `#F4F8F3` | Lighter paper variant (used on some slide backgrounds) |
| `#E8ECEA` | Muted surface / divider background |
| `#DCE7DB` | Secondary surface, section breaks |
| `#22302E` | Body text ink colour |
| `#6B7876` | Tertiary/muted text |
| `#A98A1C` | Overline labels ("THE SOURCE", "WEBSITE", etc.) |
| `#D8BE44` | Ornament gold (stronger variant) |
| `#FBF3D0` | Gold wash / selection highlight |
| `#FFFFFF` | Card surfaces |

### Gradients

| Name | Definition | Usage |
|---|---|---|
| **Splash** | `linear-gradient(135deg, #0A5A5F 0%, #004446 48%, #00292B 100%)` | Title slide, dark hero sections |
| **Chrome** | `linear-gradient(135deg, #004446 0%, #00292B 100%)` | Nav bar, toolbar (simplified 2-stop) |

### Colour Rules

- Status colours stay desaturated — no bright reds/greens
- Gold at 7–10% alpha for ornament overlays (`rgba(190, 170, 48, 0.08)` to `0.10`)
- Teal-900 is never used for text — only for fills and backgrounds

### CSS Custom Properties (Implemented)

```css
--surface-page: #EDF5ED;
--surface-card: #FFFFFF;
--surface-chrome: #004446;
--surface-chrome-deep: #00292B;
--surface-overlay: rgba(0, 41, 43, 0.55);
--surface-selection: #FBF3D0;

--gold: #BEAA30;
--gold-bright: #F7E497;
--gold-wash: #FBF3D0;
--gold-label: #8A7A1E;

--teal-primary: #004446;
--teal-accent: #107E8D;

--text-primary: #12312F;
--text-secondary: rgba(18, 49, 47, 0.72);
--text-tertiary: rgba(18, 49, 47, 0.55);
--text-on-dark: #FFFFFF;
--text-on-dark-muted: rgba(255, 255, 255, 0.78);
--text-on-dark-subtle: rgba(255, 255, 255, 0.55);

--ornament-gold: rgba(190, 170, 48, 0.08);
--ornament-gold-strong: rgba(190, 170, 48, 0.10);
```

---

## Typography

### Four Scripts

The design system handles four scripts simultaneously. Scripture sets the scale, not the interface.

| Script | Font | Usage | Min Size | Line Height |
|---|---|---|---|---|
| **Quranic Arabic** | PDMS Saleem Quran | Ayah text | 26px (never below) | 2.15 |
| **Urdu** | Jameel Noori Nastaleeq | Translation/tafseer | 19px (never below) | 2.35 |
| **Hindi** | Noto Serif Devanagari | Hindi translation | — | — |
| **Latin (display)** | EB Garamond | Headings, titles, section names | — | — |
| **Latin (body)** | Source Sans 3 | Body text, UI labels, descriptions | — | — |
| **Latin (prose)** | Noto Serif | Longer descriptions, literary text | — | — |
| **Monospace** | Courier New | Code labels, technical annotations | — | — |

### Font Roles (from the deck)

- **EB Garamond** — Display/heading font. Used for slide titles (48pt), section headings (33pt), and product names. Always paired with teal-700 (`#004446`) on light surfaces or paper (`#EDF5ED`) on dark surfaces.
- **Source Sans 3** — Body/UI font. Used for overline labels (21pt, uppercase, gold `#A98A1C`), body descriptions (25.5pt), muted captions (21pt, `#6B7876`), and component labels.
- **Noto Serif** — Prose font. Used for longer descriptive text (25.5pt) and editorial copy. Colour is typically `#22302E` (body ink) or `#6B7876` (muted).
- **Jameel Noori Nastaleeq** — Urdu script. Used for the Urdu brand name نورِ ایمان (39pt, gold `#BEAA30`) and Urdu translation text.
- **PDMS Saleem Quran** — Quranic Arabic. Used for ayah display (39pt in deck examples), always in `#00292B` (teal-900).
- **Noto Serif Devanagari** — Hindi script. Substituted freely; used for Hindi translation (27pt).

### Type Scale

```
48pt — Page/slide titles (EB Garamond)
39pt — Quranic Arabic display, Urdu brand name
33pt — Section headings (EB Garamond)
31.5pt — Urdu body text
27pt — Hindi text, Latin transliteration
25.5pt — Body paragraphs (Source Sans 3 / Noto Serif)
21pt — Overline labels, captions, muted text
18pt — Monospace annotations, code labels
```

### CSS Font Stacks (Implemented)

```css
--font-display: var(--font-eb-garamond), 'Noto Serif', Georgia, serif;
--font-body: var(--font-source-sans), 'Segoe UI', system-ui, sans-serif;
--font-arabic: 'PDMS Saleem Quran', 'Nafees Web Naskh', 'Traditional Arabic', serif;
--font-urdu: 'Jameel Noori Nastaleeq', 'Nafees Web Naskh', 'Urdu Typesetting', serif;
--font-hindi: var(--font-noto-serif-devanagari), serif;
--font-mono: 'Courier New', 'Courier', monospace;
```

### Font Loading

- **Google Fonts** (EB Garamond, Source Sans 3, Noto Serif, Noto Serif Devanagari): loaded via `next/font/google` with CSS variable injection
- **Local fonts** (PDMS Saleem Quran, Jameel Noori Nastaleeq, Jameel Noori Nastaleeq Kasheeda, Nafees Web Naskh): `@font-face` declarations in `globals.css`, served from `/fonts/`

---

## Ornament

CSS only — no raster art, no photography. Gold at 7–10% alpha, and a single mihrab hairline per screen.

### Patterns (Implemented in `ornaments.css`)

| Pattern | Class | Description |
|---|---|---|
| **Girih lattice** | `.ornament-girih` | Repeating linear gradients at 0/60/120°, 28px spacing, gold at 8% alpha |
| **Diagonal lattice** | `.ornament-diagonal` | 45/-45° cross-hatch, 32px spacing, gold at 8% alpha |
| **Paper tint** | `.ornament-paper-tint` | Subtle gold wash overlay at 10% alpha |
| **Mihrab arch** | `.ornament-mihrab` | Single CSS border arch at top centre, max 320px wide (60vw on mobile), 160px tall |

### Ornament Rules

- All patterns use `::before` / `::after` pseudo-elements with `pointer-events: none`
- Children get `position: relative; z-index: 1` to sit above the ornament
- Only **one** mihrab hairline per screen
- Gold at 7–10% alpha only — never solid gold as a background

---

## Component Inventory

Twenty-seven components in five groups, derived from the two products' real surfaces.

### Core
`Icon` · `Button` · `IconButton` · `Badge` · `Card`

### Scripture
`AyahBlock` · `BismillahBlock` · `SuraHeader` · `SuraListItem` · `ChapterNav`

### Navigation
`AppBar` · `AppBarLink` · `TabBar` · `UserMenu` · `SectionHeading`

### Reader Tools
`ReaderToolbar` · `SettingsSheet` · `SegmentedControl` · `FontSizeStepper` · `SearchField` · `Switch`

### Account
`SignInCard` · `ContinueReadingCard` · `SavedVerseCard` · `EmptyState`

---

## Page Specifications

### Quran Reader (Website)

Arabic first, then the reader's chosen translation. Every tool for readability sits in one sticky strip.

**Reader toolbar features:**
- Language switch — اردو · हिन्दी · English
- Six fixed text-size steps: 85%, 100%, 115%, 130%, 145%, 160%
- Show or hide the translation entirely
- Bookmark and share, per verse

### Home Page (Website)

- Signed-in: reader's own position first → saved verses → full index of 114 chapters
- Signed-out: personal sections replaced by a single invitation to sign in — never a wall

### Android App (Tafseer Al Quraan)

- Teal-600 (`#107E8D`) app bar
- Uppercase SURA / JUZ tabs
- Row per chapter: ordinal, transliteration, Makki or Madani, verse count, Arabic name
- *Note: Recreated from one marketing screenshot — no app source or Figma file was available*

---

## Spacing & Layout

### Spacing Scale (Implemented)

```
--space-1:  0.25rem   (4px)
--space-2:  0.5rem    (8px)
--space-3:  0.75rem   (12px)
--space-4:  1rem      (16px)
--space-5:  1.25rem   (20px)
--space-6:  1.5rem    (24px)
--space-8:  2rem      (32px)
--space-10: 2.5rem    (40px)
--space-12: 3rem      (48px)
--space-16: 4rem      (64px)
--space-20: 5rem      (80px)
```

### Layout Tokens

```
--max-width-page:   1140px
--max-width-reader: 760px
--header-height:    60px
--toolbar-height:   56px
```

### Border Radius

```
--radius-sm:   6px
--radius-md:   10px
--radius-lg:   16px
--radius-pill: 9999px
```

---

## Elevation

```css
--shadow-card:       0 1px 3px rgba(0,68,70,0.08), 0 1px 2px rgba(0,68,70,0.04);
--shadow-card-hover: 0 4px 12px rgba(0,68,70,0.12), 0 2px 4px rgba(0,68,70,0.06);
--shadow-dropdown:   0 8px 24px rgba(0,68,70,0.16), 0 2px 8px rgba(0,68,70,0.08);
--shadow-modal:      0 16px 48px rgba(0,68,70,0.2), 0 4px 16px rgba(0,68,70,0.1);
```

All shadows use teal-tinted rgba (based on `#004446`) — never pure black.

---

## Motion

```css
--duration-fast:   120ms
--duration-normal: 200ms
--duration-slow:   350ms
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out:     cubic-bezier(0.45, 0, 0.55, 1)
```

Press scale: `.pressable` class applies `transform: scale(0.985)` on `:active`.

Reduced motion: all durations set to `0ms`, `scroll-behavior: auto`.

---

## Content Rules

### Three Names, Always
`al-Fātiḥah · الفاتحة · سورہ الفاتحة` — Never anglicised to "The Opening" in the interface.

### Sentence Case
Everywhere. Uppercase belongs to the wordmark and small structural labels only.

### No Emoji
The only decorative glyph in the product is the Quranic verse separator `۝`.

### Attribution by Name
The product never speaks as "we" about religious matters. Credit goes to the author.

### Copy Length
Interface copy runs under twelve words. Empty states state one fact and offer one action, with no apology.

---

## Substitutions to Confirm

Items chosen as stand-ins during design — to be confirmed or replaced:

| Area | Current Choice | Notes |
|---|---|---|
| **Icons** | 21-glyph Lucide subset | Legacy site's icon set was not reachable |
| **Hindi & English faces** | Noto Serif Devanagari, EB Garamond, Source Sans 3 | Chosen freely as invited |
| **Colour values** | Sampled from supplied artwork | Not from a stylesheet — may need fine-tuning |
| **Verse text** | Only al-Fātiḥah is real data | Hindi and English lines are placeholders — do not ship them |

**What would make this exact:** the legacy site's CSS, the real icon set, and a sample of the actual Hindi and English translation text.
