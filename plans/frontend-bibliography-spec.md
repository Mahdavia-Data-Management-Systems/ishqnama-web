# Bibliography: a brace map of every takhreej citation

Design record, 2026-11-25; redesigned as a brace map 2026-11-28.

## Context

Takhreej (the books that support a tafseer passage) was only visible one passage at a time, from
the open-book button in the reader. `/bibliography/` shows all of it as one map that fills the
screen. It began as circles in a force-directed layout, which drifted as they settled; it is now
a **brace map**, a fixed tree read right to left: the eras the authors died in, an era's authors,
an author's books, then the chapters, rukus, ayaat and citations that use a book. Shapes never
move unless the reader opens or closes a branch; the reader zooms and pans to look around. At
the time of writing: 65 books by 53 authors, 1,434 citations, on 222 verses in 66 chapters, all
on the Urdu (Arabic script) translation.

This reverses the takhreej spec's non-goal "No pages for books".

## Decisions

- **Access**: everyone sees the eras, authors and books with their counts. Opening a book needs an account;
  an anonymous tap opens the sign-in prompt (`useSignInGate("bibliography")`). Takhreej is part of
  the tafseer, which is the members' feature.
- **Navigation**: a "Bibliography" link in the footer only, hidden for now (commented out in `footerLinks`
  in `footer.tsx`); the page still opens at its address.
- **One response**: the page reads everything from one route, so a book's id always comes from
  the same response as the citations that use it (`BookId` is a serial and may change on a reseed).
- **Eras**: `0-400`, `401-600`, `601-910` and `911-present` hijri, by the author's death year
  (`eraOf` in `bibliography-graph.ts`). A Mahdavi book (`kind` `mahdavi`) with no year goes in
  `911-present`: Hazrat Imam Mahdi ahs departed in 910 hijri and every Mahdavi book was written
  after. Any other book with no year (none today) goes under a fifth shape, "Year not recorded",
  drawn only when such a book exists.
- **Authors** are grouped by the exact `author` string; there is no author id. A book with no
  author sits among its era's authors, drawn as a book, and opens straight to its chapters.
- **Direction**: right to left, like the names. Eras on the right, groups open leftward.
- **Library**: no library draws a brace map; in every candidate the brace is a hand-drawn path.
  So the map is our own: a small layout of our own (`layoutTree`), `d3-zoom` with `d3-selection`
  (ISC, about 17 KB) for zoom and pan, HTML buttons for the shapes and one SVG layer for the
  braces. It replaced `force-graph` (about 65 KB). The layout first ran on `@antv/hierarchy`'s
  `compactBox`; that was dropped the same day, because a tidy-tree library stacks a group in one
  column and cannot set it in several (see **Layout**), and with one branch open per level the
  map is a row of groups that needs no tree algorithm.

### Libraries considered (2026-11-28)

| Option | Why not |
|---|---|
| `@xyflow/react` 13 (React Flow) | Runner-up: zoom, pan and fit built in, very active. But about 86 KB, its edge system goes unused (braces drawn in an overlay), animation still ours, and its expand/collapse example is paid |
| `markmap-view` | Animated expand and fit out of the box, but braces only through an undocumented hook, shapes are not React components, weak keyboard support |
| `react-d3-tree` | One fixed size for every shape; long Arabic titles and groups of 30 do not fit |
| `mind-elixir`, `simple-mind-map`, `jsMind` | Editors, not viewers; their bracket shapes sit on the far side of a group |
| AntV G6, Cytoscape | Canvas drawing: web fonts, theming and screen readers are hard; G6 is about 390 KB |
| GoJS | Commercial, watermarked without a licence |
| `reaflow` | Stale, about 800 KB, depends on an EPL/GPL layout engine |

## API: `GET /api/bibliography` (API only)

Anonymous, with the citations stripped unless the request carries a valid token, like the
explanations on verse routes.

```json
[{ "bookId": 1, "title": "…", "author": "…", "authorDeathYearHijri": 774, "kind": null,
   "citationCount": 204,
   "citations": [{ "chapterNumber": 2, "verseNumber": 102, "rukuId": 13,
                   "reference": "…", "note": "…", "url": null }] }]
```

- Books most cited first; a book nothing cites is left out. Citations in reading order (chapter,
  verse, segment, then their order in the tafseer). `citations` is `null` for anonymous callers
  (`StripCitations` in `Api/Helpers/AuthExtensions.cs`).
- `DtoMappings.ToBibliography` builds it from the segments with their citations attached and a
  (chapter, verse) → ruku lookup. `CachedQuranReadOnlyRepository` builds it once at load.
- Gets the default 30-day immutable cache with `Vary: Authorization` and the `-a`/`-u` ETag.
- The signed-in response is about 400 KB before compression, mostly the notes.

## Page

| File | Role |
|---|---|
| `src/app/bibliography/page.tsx` | Fetch, selection state, placeholder, trail, citation sheet |
| `src/app/bibliography/layout.tsx` | Metadata |
| `src/components/bibliography/bibliography-map.tsx` | Measures, places and draws the shapes and braces; brings a change into view |
| `src/components/bibliography/use-pan-zoom.ts` | The only file that touches `d3-zoom`: gestures and moving the view |
| `src/components/bibliography/brace-map.module.css` | The shapes, by kind and state |
| `src/lib/bibliography-graph.ts` | Pure: eras, and the tree that shows for the open branch |
| `src/lib/bibliography-layout.ts` | Pure: where each shape sits and the brace paths |
| `src/hooks/use-bibliography.ts` | One request per kind of reader, retry on `onReady` |
| `src/components/scripture/citation-list.tsx` | The citation lines, shared with the reader's takhreej sheet |
| `src/config/bibliography-copy.ts` | Reader copy, era names included |

### Behaviour

- **Home**: the four eras in a column, named "Early Works", "Middle Classical", "Late Pre-Mahdavia"
  and "Mahdavia". Under each name, on one small line, its years and its number of books
  ("601 to 910 hijri · 12 books"); the first reads "Before 400 hijri" (it holds years up to and
  including 400). An era with no books still shows. The eras are all drawn as wide as the widest
  (every other shape is as wide as its text). The trail shows an era by its name alone.
- **Marks**: a shape's kind shows at its right: a calendar on an era, a person on an author, a
  book on a book, and the ain (ع) the mushaf prints at a ruku's end on a ruku. Chapters, ayaat
  and citations have none.
- **One branch at a time**: era → its authors, oldest first, each with their year → an author's
  books, each with its citation count → the chapters that cite a book → the rukus of a chapter →
  the ayaat of a ruku. Picking a sibling swaps the branch; picking an open shape closes it. At
  every level the siblings of the open shape dim and stay selectable. A Mahdavi book has a gold
  spine.
- **An open ayah** shows every citation on it from every book. The open book's own come first,
  named by their reference; those of other books are dimmed, named by their book, and still open
  their details.
- **A citation** opens the lists' `Sheet`, headed "Takhreej" over the verse reference, with the
  book, author and year, reference and note through `CitationList` (so the `https://`-only link
  rule is shared with the reader), "From another book" for a dimmed one, and "Open this ayah"
  linking to `/quran/<c>/?verse=<v>`.
- **Layout** (`layoutTree`): a row of groups, right to left. Only one shape is open per level,
  so each group sits to the left of the whole group before it, level with the shape it hangs
  from. The same tree and sizes always give the same picture.
- **Columns of eight**: a group of more than 8 (`ROWS_PER_COLUMN`) is set in columns of 8, filled
  top to bottom and then leftward, all hanging from one top line; the last column holds what is
  left. A column's shapes share their right edge. So a group of 23 shapes is three columns,
  about a screen tall, instead of one column of 23.
- **Braces** (`bracePath`): one path per group, its spine in the gap between the two groups,
  curling to the first and last of the group's nearest column, its point facing the shape's
  height. When the shape is in an inner column of its own group, the brace still stands left of
  that whole group, and the shape is told apart by its fill. A group of one gets a short tie.
- **Measuring**: a shape's size depends on its text, so a new shape is first rendered out of
  sight (`.measure`), sized in a layout effect before the browser paints, then placed. The map
  keeps its last arrangement until every new shape has a size, so nothing jumps. Sizes are taken
  again when a font finishes arriving (`document.fonts` `loadingdone`).
- **Re-flow**: every selection lays the whole visible tree out again. Shapes already showing
  glide to their new places (CSS `transition` on `transform`); new shapes and changed braces fade
  in where they belong. Under reduced motion nothing glides or fades.
- **View**: the wheel and a pinch zoom (0.25x to 2x), a drag pans; a press that moves under 4 px
  is still a tap. After a change the view eases (350 ms) to show the whole map while its text
  stays at least 0.6x its natural size, otherwise to the newest group with the shape it hangs
  from, never above natural size. "Show everything" fits the whole map on demand. The view moves
  without easing under reduced motion, and the reader's own gesture cancels a move in progress.
- **Keyboard and screen readers**: every shape is a `<button>` in reading order, with
  `aria-expanded` on those that open and its full name (label and count) as its accessible name;
  focusing one off screen slides the map just far enough to show it. The panel's trail (All eras
  › era › author › book › chapter › ruku › ayah, each a button) steps back up the branch. The
  earlier clipped list of choices is gone: it would now repeat the same buttons.
- **Theme**: shapes and braces are styled with tokens in the CSS module; nothing reads colours in
  script.
- **Screen**: `<main>` is exactly the viewport under the app bar (less the phone bottom nav and
  the recording bar), with `flex: 0 0 auto` because `globals.css` lets a page's main grow. The
  footer is left out on this route.
- **Cold start**: the reader's placeholder and messages; the hook retries on `onReady`.
- **Telemetry**: `bibliography-citation-opened` with `route` only. No book or verse is sent.

## Known gaps

- A reader whose stored sign-in has expired and cannot be renewed silently still counts as signed
  in, but receives the anonymous response; tapping a book then does nothing until the session
  renewal clears or refreshes the account.
- Sources written as plain bracketed prose (see `plans/tafseer-takhreej-data-issues.md`) are not
  citation rows, so they are not on the map.
- If takhreej is added to another translation, a book's count will add the rows of every
  translation.
- Authors are matched by name, so one author written two ways shows as two (today
  `ابن جرير الطبري` and `الطبري`; see below).
- There is no search.
- The deeper levels (chapter to citation) were checked by unit tests and, in the browser, only
  signed out; they need a signed-in pass.

## One author under two names

`جامع البيان` gives its author as `ابن جرير الطبري` and `تاريخ الرسل والملوك` as `الطبري`, both
with year 310: the same person, shown as two authors in the 0-400 era. Fix in `ishqnama-db`
(`101-seed-books.sql`) by using one spelling; no frontend change is needed. `النسفي` (710) and
`أبو حفص النسفي` (537) are different people and are right as they are.
