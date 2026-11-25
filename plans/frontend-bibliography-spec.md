# Bibliography: a map of every takhreej citation

Design record, 2026-11-25.

## Context

Takhreej (the books that support a tafseer passage) was only visible one passage at a time, from
the open-book button in the reader. `/bibliography/` shows all of it as one map that fills the
screen: a circle per book, sized by how often it is cited, opening into the chapters, rukus, ayaat
and citations that use it. At the time of writing: 65 books, 1,434 citations, on 222 verses in 66
chapters, all on the Urdu (Arabic script) translation.

This reverses the takhreej spec's non-goal "No pages for books".

## Decisions

- **Access**: everyone sees the book circles and their counts. Opening a book needs an account;
  an anonymous tap opens the sign-in prompt (`useSignInGate("bibliography")`). Takhreej is part of
  the tafseer, which is the members' feature.
- **Navigation**: a "Bibliography" link in the footer only.
- **One response**: the page reads everything from one route, so a book's id always comes from
  the same response as the citations that use it (`BookId` is a serial and may change on a reseed).
- **Library**: `force-graph` (vasturiano, MIT), a 2D canvas force-directed graph with pan, zoom,
  drag and click hit-testing. The tree-style mind map libraries (markmap, mind-elixir) draw text
  boxes in a fixed tree and do not fit circles sized by a value. About 65 KB gzipped, in a chunk
  loaded only by this page after mount.

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
| `src/app/bibliography/page.tsx` | Fetch, selection state, placeholder, trail, list of choices, citation sheet |
| `src/app/bibliography/layout.tsx` | Metadata |
| `src/components/bibliography/bibliography-map.tsx` | The canvas box: imports the scene after mount, sizes it, passes graphs and theme changes |
| `src/components/bibliography/map-scene.ts` | The only file that touches `force-graph` |
| `src/lib/bibliography-graph.ts` | Pure: which circles and lines show for the open branch |
| `src/hooks/use-bibliography.ts` | One request per kind of reader, retry on `onReady` |
| `src/components/scripture/citation-list.tsx` | The citation lines, shared with the reader's takhreej sheet |
| `src/config/bibliography-copy.ts` | Reader copy |

### Behaviour

- **Home**: every book as a circle whose area follows its citation count (`bookRadius`, radius ∝
  √count with a floor). The count is inside; the title is inside too when it fits, otherwise
  under the circle. A `kind` of `mahdavi` gets a heavier ring.
- **One branch at a time**: book → the chapters that cite it → the rukus of a chapter → the ayaat
  of a ruku. Picking a sibling swaps the branch; picking an open circle closes it. At every level
  the siblings of the open circle dim and stay clickable.
- **An open ayah** shows every citation on it from every book. The open book's own are drawn at
  full strength, named by their reference; those of other books are dimmed, on a dashed line,
  named by their book, and still open their details.
- **A citation** opens the lists' `Sheet`, headed "Takhreej" over the verse reference, with the
  book, author and year, reference and note through `CitationList` (so the `https://`-only link
  rule is shared with the reader), "From another book" for a dimmed one, and "Open this ayah"
  linking to `/quran/<c>/?verse=<v>`.
- **No overlap, quick to rest**: circles never overlap, and they stop moving about 0.6 s after
  a change. The books may move: an opening branch pushes its neighbours aside, and they gather
  again when it closes. The no-overlap force (`pushApart` in `map-scene.ts`) moves positions
  directly, several passes a tick, keeping every pair of centres at least both radii plus 18
  units apart (room for the label under each), so overlaps are gone within a few frames. When the
  layout stops, the same passes run until no pair overlaps, as a guarantee. The books are laid
  out before the first frame (`FIRST_LAYOUT_TICKS`), so the map opens at rest; a later change is
  partly worked out before it is drawn (`CHANGE_LAYOUT_TICKS`) and may move for at most
  `REST_MS` (500). New circles start just beyond the circle they hang from, on the side away
  from that one's own parent. A dragged circle stays where it was put and the others make room.
- **View**: 220 ms after a change the view eases (400 ms) to the open branch (everything at
  home; a book and its chapters; deeper, the open chapter and all under it), capped at 3× so a
  small branch is not blown up, with a touch-up once the circles stop only when it is noticeably
  off. "Show everything" does it on demand. Under reduced motion each layout is worked out in
  full before it is drawn and the view moves without easing.
- **Layout forces**: a gentle pull of the books to the middle, the no-overlap force, and the
  library's link and charge forces, with fast decay (`d3AlphaDecay` 0.06, `d3VelocityDecay` 0.55).
- **Labels** are drawn in a pass after all circles, over a thin outline in the page colour, so a
  neighbour never covers one.
- **Beyond the canvas**: a canvas is a picture to a keyboard or a screen reader. The panel carries
  a trail (All books › book › chapter › ruku › ayah, each a button) and a list of the current
  level's choices as real buttons, clipped out of sight until focus is inside it. Both drive the
  same selection as the canvas.
- **Theme**: the scene reads colour tokens with `getComputedStyle` and re-reads them when
  `useTheme().resolved` changes. No colour literals.
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
