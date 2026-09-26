# Ruku rails in the Quran index

## Context

The Quran index (`frontend/src/components/scripture/quran-index.tsx`, used on `/quran/` and at the foot of the home page) lists chapters and ajza. Readers can only reach a single ruku from inside the reader, although every ruku already has its own page (`/quran/<sura>/ruku/<rankInChapter>/`, `/quran/juz/<juz>/ruku/<rankInJuz>/`). This change adds a horizontally scrolling rail of ruku marks to each list item, so readers can jump straight to a passage.

**What the user asked for:**
- Each chapter item shows its rukus, but only when the chapter has more than one. Each juz item shows its rukus.
- The rail scrolls horizontally and is part of the list item's card.
- Every ruku is drawn as a ruku mark (ع). The user chose the **full reader mark**: rank in chapter above, verse count in the middle, rank in juz below.
- Numbers are Urdu by default for anonymous readers, and the saved language setting for signed-in readers.

**Assumptions:** tapping a mark opens that ruku's page. In the juz rail, a hairline divider separates rukus from different chapters, because the chapter rank restarts at ١. Juz 1 includes al-Fātiḥah with rank in juz 0, so its mark shows ٠ at the bottom, as the data does.

No data fetching is added: all 556 rukus are already static in `src/data/rukus.ts`.

## Design

### Language
Read `lang` from `useReaderSettings()` (`src/context/reader-settings-context.tsx`, provider mounted in `app-shell.tsx` so it is available on the home page too). It already works the way the user wants: `DEFAULT_SETTINGS.lang` is `"urdu"`, anonymous readers keep that default, and signed-in readers get their saved value. `QuranIndex` reads it once and passes `lang` to each list item. `RukuMark` already localises its numbers with `localizeNumber()` from `src/lib/translation-map.ts`.

### New `src/components/scripture/ruku-rail.tsx` (+ `ruku-rail.module.css`)
- Props: `rukus: RukuDto[]`, `hrefFor: (r) => string`, `lang`, `label` (for `aria-label`, e.g. "Rukus of Al-Baqarah"), and `separateChapters?: boolean` (used by the juz rail).
- It renders a `<ul>` of `<li><Link>` tiles, each holding the existing `RukuMark` with `rankInChapter`, `verseCount`, `rankInJuz` and `lang`. Each link gets the accessible name "Ruku <n>, <count> verses". For the juz rail it becomes "<chapter name>, ruku <n>, <count> verses", using the chapter name from `src/data/suras.ts`.
- It follows the home page rail's behaviour (`src/app/page.module.css` `.rail`): flex row, `overflow-x: auto`, `scroll-snap-type: x mandatory`, hidden scrollbar and `overscroll-behavior-x: contain`. `useDragToScroll` (`src/lib/use-drag-to-scroll.ts`) is attached through a callback ref held in state, as the bookmarks rail does. Like the bookmarks rail, it deliberately does **not** use `useWheelToHorizontal`, because a vertical list with 115 wheel-hijacking rails would trap the page scroll.
- The rail bleeds to the card's inner edges with negative margins that match the card padding, and a `mask-image` fades the trailing edge so marks visibly continue. It is `dir="ltr"` so rank 1 starts at the left, matching the list's reading order.
- The visual treatment (tile size, gold ع in the brand `--gold`, a quiet teal hover or active wash, a visible focus ring, a hairline between header and rail) is finalised with the **frontend-design** skill during implementation, using the existing tokens in the list item CSS. Nothing in the rail says "loading", "API" and so on. It is static.
- `RukuMark` positions its numbers absolutely with offsets tuned for the reader. If they do not sit cleanly inside a rail tile, add an optional `className` prop to `RukuMark`'s wrapper so the rail can set its size, and leave reader usage unchanged. Number size uses the existing `fontScale` prop, not a new mechanism.

### List items become cards with a link header plus a rail
A rail full of links cannot sit inside the current `<Link>` wrapper, because nested `<a>` is invalid. So `SuraListItem` and `JuzListItem` change like this:
- The outer element becomes a `<div className={styles.item}>` that keeps the card look: background, shadow, radius and the Makki/Madani left border. It switches to a column layout.
- The existing row (number, names, meta and Arabic side) moves unchanged into a `<Link className={styles.header}>`, which keeps the press-scale `:active`. Hover shadow stays on the card.
- Below the header: `SuraListItem` renders `<RukuRail>` only when `rukusInChapter(number).length > 1`, with `hrefFor = r => /quran/${number}/ruku/${r.rankInChapter}/`. `JuzListItem` always renders it (`rukusInJuz`, `hrefFor = r => /quran/juz/${juzNumber}/ruku/${r.rankInJuz}/`, `separateChapters`).
- Both accept a new `lang` prop. The helpers come from `src/data/rukus.ts`, and search filtering in `QuranIndex` is unchanged.

### Files
- `frontend/src/components/scripture/ruku-rail.tsx`, `ruku-rail.module.css`: new
- `frontend/src/components/scripture/sura-list-item.tsx`, `juz-list-item.tsx`, `sura-list-item.module.css`: card and header split, plus the rail
- `frontend/src/components/scripture/quran-index.tsx`: read `lang` and pass it down
- `frontend/src/components/scripture/ruku-mark.tsx`: only if an optional `className` turns out to be needed
- `CLAUDE.md`: one bullet describing the index ruku rails
- `plans/frontend-index-ruku-rail-plan.md`: a copy of this plan, per the repository's plans convention

## Verification

- **Unit tests (Vitest)**, in `src/components/scripture/__tests__/ruku-rail.test.tsx` and list-item tests:
  - Al-Baqarah renders 40 ruku links with the correct hrefs.
  - Al-Fātiḥah (one ruku) renders no rail.
  - Juz 1 links use `/quran/juz/1/ruku/0/` onward.
  - `lang="urdu"` renders Eastern Arabic digits (٤٠), `lang="english"` renders Latin digits, and `lang="hindi"` renders Devanagari digits.
  - A drag does not follow a link, which is already covered by the hook's tests.
- Run `npm test`, `npm run lint` and `npm run build`.
- Run `npm run dev` and check `/quran/` and `/` in the browser (Playwright or Chrome DevTools MCP) at phone and desktop widths:
  - rails scroll with touch and mouse drag, and a vertical wheel still scrolls the page
  - the mark's numbers are aligned
  - Urdu digits show when signed out
  - Juz view dividers appear between chapters
  - keyboard Tab reaches the header link and then each ruku with a visible focus ring
  - take screenshots in light and dark themes
