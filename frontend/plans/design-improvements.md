# Design Improvements Plan

**Status: 9 of 10 IMPLEMENTED** — Only #10 (Page Background Warmth) remains unimplemented.

## Context

Ishqnama is a Quranic reading web app (Noor e Imaan tafseer) being redeveloped from [ishqnama.com](https://ishqnama.com). The existing site is minimal — white background, basic grid of 114 chapter cards, simple reader. The new frontend (`frontend/`) already has a strong foundation: teal + gold palette, EB Garamond display type, dedicated Arabic/Urdu font stacks, and a well-structured token system in CSS custom properties.

The design deck (`frontend/design/Ishqnama_Quran_Website_Redevelopment.pptx`) specifies 8 screens with a premium, literary aesthetic. Key principles from the deck: "Reading is never gated," the signed-out home "leads with the volume and the index," and the reader has two modes (verse-by-verse and continuous) with a gold-wash selection in continuous mode.

This plan implements 10 visual design improvements identified during review, prioritized by impact.

---

## Changes

### 1. Mobile Bottom Navigation (P0) — IMPLEMENTED

**Problem:** Nav links are `display: none` below 640px with no replacement. Mobile users cannot navigate.

**Files:**
- **Create** `src/components/navigation/bottom-nav.tsx`
- **Create** `src/components/navigation/bottom-nav.module.css`
- **Modify** `src/app/layout.tsx` — import and render `<BottomNav />` after `{children}`
- **Modify** `src/app/globals.css` — add `padding-bottom: 56px` on mobile to prevent content overlap

**Details:**
- 4 tabs: Home (`home`), Chapters (`book`), Search (`search`), Saved (`bookmark`) — all icons exist in `src/components/ui/icon.tsx`
- `position: fixed; bottom: 0; z-index: 90` on mobile, `display: none` above 640px
- 56px height, `--surface-card` background, hairline top border
- Active tab: `--teal-primary`, inactive: `--text-tertiary`
- Use `usePathname()` for active detection (exact match for `/`, `startsWith` for others)
- **Hide on sura reader pages** (`/quran/\d+/`) by returning `null` — `ReaderToolbar` already occupies `sticky bottom: 0; z-index: 50` on those pages
- Labels: 10px `--font-body`, weight 600

### 2. Google Fonts → next/font (P0) — IMPLEMENTED

**Problem:** `globals.css` line 2 uses render-blocking `@import url(...)` for Google Fonts.

**Files:**
- **Modify** `src/app/layout.tsx` — add `next/font/google` imports for EB Garamond, Source Sans 3, Noto Serif, Noto Serif Devanagari with `variable` option; apply variable classes to `<html>`
- **Modify** `src/app/globals.css` — delete `@import` line; update `--font-display`, `--font-body`, `--font-hindi` to use `var(--font-eb-garamond)`, `var(--font-source-sans)`, `var(--font-noto-serif-devanagari)`

**Details:**
- `next/font/google` downloads fonts at build time and self-hosts them — works with `output: "export"`
- Each font gets a `variable` CSS custom property name (e.g., `--font-eb-garamond`)
- Local `@font-face` declarations for PDMS Saleem Quran, Jameel Noori Nastaleeq, Nafees Web Naskh remain unchanged
- Font config:
  - `EB_Garamond`: subsets `["latin"]`, weights `["400","500","600","700"]`, styles `["normal","italic"]`
  - `Source_Sans_3`: subsets `["latin"]`, weights `["300","400","500","600","700"]`, styles `["normal","italic"]`
  - `Noto_Serif`: subsets `["latin"]`, weights `["400","700"]`, styles `["normal","italic"]`
  - `Noto_Serif_Devanagari`: subsets `["devanagari"]`, weights `["400","700"]`

### 3. Home Hero Redesign (P1) — IMPLEMENTED

**Problem:** Unauthenticated hero is plain centered text — forgettable. The design deck says the signed-out home "leads with the volume and the index."

**Files:**
- **Modify** `src/app/page.tsx` — replace `welcome` div with a gradient hero card featuring Bismillah, headline, description, and CTA
- **Modify** `src/app/page.module.css` — replace `.welcome*` styles with `.heroCard`, `.bismillah`, `.heroTitle`, `.heroBody`, `.heroCta`

**Details:**
- Hero card: `--gradient-splash` background, `--radius-lg`, generous padding
- Bismillah in `--font-arabic` at `--text-3xl`, white, centered — the first thing visitors see
- Headline "The Quran, with meaning" in `--font-display`, `--gold-bright`
- Description in `--text-on-dark-muted`
- CTA pill button "Start reading" → `/quran/` with `--gold` background, dark text
- Add `import Link from "next/link"` (not currently imported in page.tsx)
- Mobile: reduce Bismillah and title to `--text-2xl`, tighter padding

### 4. Selection Styling + Smooth Scroll (P1 — 2-minute win) — IMPLEMENTED

**Files:**
- **Modify** `src/app/globals.css`

**Add:**
```css
::selection { background: var(--surface-selection); color: var(--text-primary); }
html { scroll-behavior: smooth; }
```
Inside existing `@media (prefers-reduced-motion: reduce)`:
```css
html { scroll-behavior: auto; }
```

### 5. Theme Color + Favicon (P1) — IMPLEMENTED

**Problem:** No favicon, no theme-color meta tag. Browser shows blank tab icon.

**Files:**
- **Modify** `src/app/layout.tsx` — add `icons` and `other` to metadata export

**Details:**
```tsx
export const metadata: Metadata = {
  title: "Ishqnama",
  description: "Ishqnama — Quranic verses, translations and explanations",
  icons: { icon: "/logo-ishqnama.svg" },
  other: { "theme-color": "#004446" },
};
```

### 6. Footer (P1) — IMPLEMENTED

**Problem:** Static pages end abruptly with no navigation at the bottom.

**Files:**
- **Create** `src/components/navigation/footer.tsx` (server component, no `"use client"`)
- **Create** `src/components/navigation/footer.module.css`
- **Modify** `src/app/layout.tsx` — import and render `<Footer />` between `{children}` and `<BottomNav />`

**Details:**
- Logo mark (small, 28px, 35% opacity), links row (About, Contact, Terms, Privacy), tagline "Noor e Imaan — نورِ ایمان"
- `--text-tertiary` text, hairline top border, `--max-width-page` centered
- Links: `--text-sm`, `--text-tertiary` → `--text-primary` on hover
- Tagline: `--font-display` italic

### 7. Bismillah Block Elevation (P2) — IMPLEMENTED

**Problem:** The Bismillah appears 113 times but has no visual distinction — just centered text with padding.

**Files:**
- **Modify** `src/components/scripture/bismillah-block.module.css` — add `--gold-wash` background, `--radius-md`, horizontal padding, margin
- **Modify** `src/components/scripture/bismillah-block.tsx` — add a decorative divider element

### 8. Gradient-Splash Restraint (P2) — IMPLEMENTED

**Problem:** Same gradient on nav bar, continue-reading card, sura header, reader toolbar → dilutes the signature.

**Files:**
- **Modify** `src/components/navigation/app-bar.module.css` — change `background: var(--gradient-splash)` to `background: var(--surface-chrome)`

### 9. Sura List Differentiation (P2) — IMPLEMENTED

**Problem:** 114 identical white cards — hard to scan.

**Files:**
- **Modify** `src/components/scripture/sura-list-item.module.css` — add `.makki` and `.madani` classes
- **Modify** `src/components/scripture/sura-list-item.tsx` — apply class based on `revelationType` prop

### 10. Page Background Warmth (P3) — NOT IMPLEMENTED

**Problem:** `--surface-page: #EDF5ED` leans minty/clinical rather than warm/literary.

**Files:**
- **Modify** `src/app/globals.css` — change `--surface-page` from `#EDF5ED` to `#F0F3EA`

---

## Implementation Order

```
Phase 1 — CSS-only quick wins (no component changes):
  [4] Selection styling + smooth scroll    (globals.css)
  [10] Page background warmth              (globals.css)
  [8] Gradient restraint                   (app-bar.module.css)

Phase 2 — layout.tsx changes (coordinate together):
  [2] Font migration                       (layout.tsx + globals.css)
  [5] Theme color + favicon                (layout.tsx)

Phase 3 — New components + layout.tsx:
  [6] Footer                               (new files + layout.tsx)
  [1] Mobile bottom nav                    (new files + layout.tsx + globals.css)

Phase 4 — Content/component changes:
  [3] Home hero redesign                   (page.tsx + page.module.css)
  [9] Sura list differentiation            (sura-list-item.tsx + .module.css)
  [7] Bismillah block elevation            (bismillah-block.tsx + .module.css)
```

---

## Cleanup

Delete temp file `frontend/design/extract.ps1` (created during planning research).
