# Takhreej on tafseer

Design record, 2026-11-22. The step-by-step plan it was built from is
`plans/frontend-takhreej-plan.md`.

## Context

Some Noor e Imaan explanations (tafseer) carry **takhreej**: the books that mention or support
a point. They used to be printed inline, as an underlined list in the middle of the prose. Now
the passage the books are about is washed in light gold, a small open-book button ends it, and
tapping the button opens a sheet headed "Takhreej" that quotes the passage and lists the books.
Readers only need to see the sources.

## The markup (database)

In a segment's `Explanation` HTML each cited passage is

```html
<mark>passage<ins data-takhreej="n"></ins></mark>
```

- The `<mark>` has no class and wraps exactly the passage. The search highlighter's marks always
  carry a class, which is how the two are told apart.
- The `<ins>` is empty, sits last inside the mark, and `n` is the block's number within that
  segment, counting from 1 in text order. One `<ins>` per mark, no nesting.
- A mark may hold only its `<ins>` and no passage text. The reader then shows the button alone,
  with nothing washed, and the sheet has no quote.

## The data (API)

Each `TranslationSegmentDto` carries `takhreej?: TakhreejBlockDto[] | null`:

```ts
interface TakhreejBlockDto { ordinal: number; citations: CitationDto[] }
interface CitationDto {
  title: string;
  author?: string | null;
  authorDeathYearHijri?: number | null;
  reference?: string | null;   // where in the book, as printed
  note?: string | null;        // a remark or quotation after the reference
  url?: string | null;         // the reference's own address, when there is one
}
```

`ordinal` matches the anchor's `data-takhreej`. Anonymous readers get neither `explanation` nor
`takhreej`.

## The frontend

- `src/lib/tafseer-takhreej.ts` is the pure parser. `splitTakhreej(html)` returns prose parts and
  takhreej parts (`passageHtml`, `ordinal`, `inlineLines`) in text order; `flattenTakhreej(html)`
  returns the prose with passages unwrapped and anchors dropped; `citationsFor(part, blocks)`
  picks the segment's block by ordinal; `year(n)` prints a hijri year in Eastern Arabic digits
  with its mark (`HIJRI_MARK`).
- `src/components/scripture/tafseer-html.tsx` (`TafseerHtml`) renders one segment's explanation.
  With nothing cited, or with the reader's setting off, it is the single prose `<span>` the
  reader always rendered. Otherwise each takhreej part is a `<mark>` in the module's `passage`
  class followed by the button. The sheet is the lists' `Sheet`, drawn through a portal on
  `document.body` so it does not inherit the tafseer's direction, font, size and pointer cursor.
- Each book is a list item: title, then author and year, then the reference on its own line,
  then the note. The reference is a link (new tab, `noopener noreferrer`) only when `url` starts
  with `https://`; with a link and no reference, the title is the link. The address is never
  printed. A note is plain text, never markup.
- Call sites: the verse block (`ayah-block.tsx`), the continuous-mode verse popup
  (`quran-reader-client.tsx`) and the bismillah block, which renders one `TafseerHtml` per
  segment because anchor numbers are per segment. The search card flattens the explanation: it
  is one link, so it shows the passage as plain prose with no wash, button or books.
- The tafseer blocks toggle a highlight on a click, so the button stops the click from reaching
  them. A portal keeps its place in the React tree, so the sheet's backdrop stops it as well
  (`components/lists/sheet.tsx`).

## Older responses

Verse responses are cached for up to 30 days, and until the database migration is live the
`<ins>` still holds the citation text, one book per line, often ending in a zero-width joiner.
`splitTakhreej` keeps those lines (`inlineLines`: tags stripped, entities decoded, the joiner
and stray commas removed, empty lines dropped) and the sheet lists them as plain text when the
segment has no structured block for the anchor. They are not parsed into fields. An `<ins>`
outside any mark is read as sources with no passage. An anchor with neither a block nor lines
shows nothing: the passage reads as ordinary prose.

## The reader setting

"Show takhreej on tafseer" (`showTakhreej`) is a switch in the settings sheet's "Reader
settings" section, directly below "Show tafseer". It is on by default for everyone: anonymous
readers, new accounts, and accounts saved before it existed (a settings payload without the
field reads as on, in `mergeSettings` and on the backend). While "Show tafseer" is off the
switch is greyed out and cannot be toggled, and it keeps its saved value, so turning tafseer
back on restores the reader's choice. Off, `TafseerHtml` renders the flattened prose: the
passage text stays, with no wash, button or sheet. There is no query-string override.

## Telemetry

`takhreej-opened` with `route` only. No verse, passage or book is ever sent.

## Non-goals

- ~~No pages for books, no list of every passage a book supports.~~ Reversed on 2026-11-25 by the
  bibliography page, `plans/frontend-bibliography-spec.md`.
- No structured locators: `reference` is free text, shown as printed.
- No links other than a citation's own `url`.
- Takhreej is not searchable by book name; `/api/search` matches the explanation's prose.

## Not yet seen in a browser

The feature was built before the API and database carried the new data, so its looks (the
wash in both themes, the button's size at each text size, the sheet over the verse popup) were
checked by tests only. Step 4 of the plan's Verification is the browser pass still owed.
