# Takhreej (tafseer citations): passages, icons and a popup

**Status (2026-11-05): planned, not started.** The data side (Part B) is being worked out in `ishqnama-db` alongside other changes; revisit the verse list, B1–B3 and the parser tolerances in A2 once the seed files have the new markup, before implementing.

## Context

Some Noor e Imaan explanations (tafseer) carry **takhreej**: the books that mention or support a point. In the source data (`ishqnama-db/database/scripts/seed/*-ur.sql`) each is an `<ins>…</ins>` block with one citation per line (`title، author death-year`, e.g. `جامع البيان، ابن جرير الطبري ٣١٠ه‍`). There are 19 blocks, all Urdu (2:146, 2:187, 3:135, 4:23, 4:130, 11:114, 27:44, 33:37 ×5, 33:38, 33:53 seg 3, 33:69, 38:34, 66:3, 68:1, 68:9); two are empty (33:69, 68:9), one is a single inline citation (33:37), and the format is irregular (trailing ASCII commas in 27:44, `</ins>` at the start of the next line, mid-line or ending the text, `ه` with and without the ZWJ). The same books recur across blocks with spelling drift.

The owner's target markup, being applied in the db repo now: every `<ins>` sits inside a `<mark>` that wraps the **passage** the takhreej is for, with the `<ins>` at the passage's end:

```html
This is a tafseer explanation that has takhreej. <mark>Some text <ins>Book 1, Author - YYYY</ins> </mark> from this segment also mentioned in other books.
```

Each citation is to carry four things: **title**, **author**, **reference in the book** (page, chapter, hadith number…) and **year** (the author's death year, hijri; the `٣١٠ه‍` already in the data), plus an optional **note** (the bracketed remark or quoted passage after the reference) and an optional **link** to that reference on the internet.

Today the four renderers inject the HTML raw with `dangerouslySetInnerHTML`, so readers see the book list underlined inline. The owner wants: the passage visibly marked, a small icon at its end in place of the `<ins>`, and a tap on the icon opening a popup headed **"Takhreej"** that lists the books. Readers only need to see the sources; nothing richer (no book pages), except that a citation may link out to the reference on the internet when the data has an address for it (`Url`, B1).

Decisions taken with the owner:
- **Persistence: tables, not text.** Books and citations get their own tables (B1); the explanation keeps `<mark>` around the passage and an empty, numbered `<ins>` anchor at its end, so the prose never depends on surrogate keys. (Replaces the earlier "markup template only" idea.)
- **The API returns the structured takhreej** on each segment (Part C); the frontend reads it and falls back to parsing citation text out of the `<ins>` while a reader's cached response (`immutable`, 30 days, constant ETag) still carries the old inline form.
- Local testing uses `backend/docker-compose.local-db.yml`, which builds Postgres from the sibling `ishqnama-db` repo's plain `Dockerfile` (explanations as written, `<mark>` and `<ins>` included). The obfuscated `:dev` image needs no change for this feature (B3).
- Wording: heading "Takhreej", icon label "Show takhreej".

Three parts: **A** frontend (`ishqnama-web/frontend/src`), **B** database (`ishqnama-db`), **C** API (`ishqnama-web/backend`). B first (it defines the markup), then C, then A; A's fallback parser means A can also ship before C if wanted.

Verified facts the design relies on:
- The tafseer containers (`.tafseer` in `ayah-block.module.css`, `.popupTafseerItem` in `quran-reader-client.module.css`, `.explanation` in `bismillah-block.module.css`) don't set `white-space`, so newlines collapse.
- All three containers have an `onClick` that toggles a highlight (`ayah-block.tsx:243`, `quran-reader-client.tsx:547`, the bismillah wrapper at `quran-reader-client.tsx:346`), so the icon button must `stopPropagation`.
- React synthetic events bubble through the React tree even from a portal, so the sheet overlay's close click also needs `stopPropagation`.
- The search highlighter already injects `<mark class="…">` (`ayah-block.tsx:36-46`, `search-result-card.tsx:24-36`); a takhreej `<mark>` has no class, which is how the two are told apart. Parsing happens before highlighting, so highlighting never sees a takhreej mark.
- The search card is one `<Link>`; a button inside it is wrong, so the snippet unwraps the passage and drops the `<ins>` instead.
- The HTML otherwise contains only `<span lang="ar|ur|fa|en">`; `<mark>` may contain such spans but is never nested in another `<mark>`.

---

## Part B: database (`ishqnama-db`)

### B1. Schema (`database/scripts/seed/001-schema.sql`)
```sql
CREATE TABLE "Books" (
  "BookId"               SERIAL PRIMARY KEY,
  "Title"                TEXT NOT NULL,          -- جامع البيان
  "Author"               TEXT NULL,              -- ابن جرير الطبري; NULL when the book is known by its title alone
  "AuthorDeathYearHijri" SMALLINT NULL,          -- 310; the UI renders ٣١٠ه‍
  "Kind"                 TEXT NULL,              -- 'tafsir' | 'hadith' | …, optional, for grouping or an icon later
  CONSTRAINT "UQ_Books_Title_Author" UNIQUE ("Title", "Author")
);

CREATE TABLE "TranslationSegmentCitations" (
  "CitationId"           SERIAL PRIMARY KEY,
  "TranslationSegmentId" INT NOT NULL REFERENCES "TranslationSegments" ON DELETE CASCADE,
  "BlockOrdinal"         SMALLINT NOT NULL,      -- which anchor in the explanation: 1, 2, 3 …
  "SortOrder"            SMALLINT NOT NULL,      -- order within the block
  "BookId"               INT NOT NULL REFERENCES "Books",
  "Reference"            TEXT NULL,              -- as printed: 'ج ٢ ص ٢٧٣', 'حديث ٣٤٥٢'
  "Note"                 TEXT NULL,              -- the bracketed note or quoted passage after the reference: 'عن ابن عباس', '«قد فعلت»'
  "Url"                  TEXT NULL,              -- link to this reference on the internet, when one exists
  UNIQUE ("TranslationSegmentId", "BlockOrdinal", "SortOrder")
);
CREATE INDEX ON "TranslationSegmentCitations" ("TranslationSegmentId");
```
`Reference` stays free text: locators differ by book kind and are only displayed. `Note` (owner's decision, 2026-11-22) holds whatever follows the locator in a citation line: the bracketed remarks (narrator, edition, "عند ٣٣:٥١") and any quoted passage, stored without the outer brackets, several remarks joined with `؛ `. The migration script splits a line at ` — `, then takes the text up to the first ` (` as `Reference` and the rest as `Note`; edition remarks such as `(ط التركي)` go to `Note` with the others, and the owner reviews the drafted rows. `Url` (owner's decision, 2026-11-22) holds the address of the citation itself (the page or hadith, not the book's home page), so it sits on the citation row, not on `Books`; it is NULL for most rows. It must be an absolute `https://` address. The migration leaves it empty for every row (the addresses in today's lines are dropped, see the migration rules in B2).

### B2. Markup template in `Explanation`
```html
…میں نہیں جانتا کہ عورتوں نے کیا کیا ہے۔ <mark>اس پر حضرت عمر ؓ نے …<ins data-takhreej="1"></ins></mark> …
```
- `<mark>` wraps exactly the passage; `<ins data-takhreej="n"></ins>` is empty and sits last inside it; `n` is the block's ordinal within that segment's explanation (1-based, in text order). One `<ins>` per `<mark>`, no nesting. A `<mark>` may hold only its `<ins>` and no passage text (4:23, 38:34 today): the reader then shows the book icon alone, with nothing highlighted, and the sheet leaves out the passage quote.
- Document the template in the db repo's `CLAUDE.md`. Keep files LF.
- Migration of the 17 non-empty blocks: a one-off script drafts `Books` rows (dedupe by title+author after normalising `ه`/`ه‍` and spacing around `،`) and citation rows from the current lines, then the owner wraps each passage in `<mark>` by hand (only a reader of the text can say where the passage starts) and replaces the block with the anchor. Delete the two empty `<ins></ins>` (33:69, 68:9). New seed files `0NN-seed-books.sql` and `0NN-seed-translation-segment-citations.sql`, numbered after `010-seed-translations.sql` and before the segment files only if the FK order needs it (citations reference segments, so they must run **after** `100-…`; name them `101-…`, `102-…`).

Migration rules settled with the owner on 2026-11-22 (the data then had 717 marks, 1,433 citation lines and 128 distinct book headings for about 66 books):
- **One row per book, under its formal title.** Variant headings merge into one `Books` row named as the owner's original lists named it (`الجامع لأحكام القرآن، القرطبي`, not `تفسير القرطبي`; `تفسير القرآن العظيم، ابن كثير`; `معالم التنزيل، البغوي`; `جامع البيان، ابن جرير الطبري`). The script works from a hand-reviewed merge table (variant heading → book), never from fuzzy matching; an unknown heading fails the run.
- **Author and year belong to the book.** Each book takes them once, from the lines that give them, so a line that names only `صحيح البخاري` still shows `البخاري ٢٥٦ه`. A collection no line gives an author for (`مسند أحمد`) has `Author` NULL. Mahdavi sources (انصاف نامہ, نقلیات, شواہد الولایت, توضیحات) have no year.
- **Tags come out of the title.** `(مہدوی مصدر)` sets `Books."Kind"` to `mahdavi` and is not stored as text; a language tag (`فارسی`) and an edition tag (`ط. التركي`, `طيبة`, `ط التأصيل`) move to that citation's `Note`.
- **No web addresses from the current data.** The 94 `search.hadith-mcp.org` addresses and the wording `«في ترقيم القاعدة المستعملة»` (198 lines) are dropped; the reference keeps the hadith number alone (`رقم ٦٩٣٠`). `Url` starts empty for every row and is filled by hand later with addresses readers should be sent to.

Merge table answers from the owner (2026-11-22; the reviewed table itself, variant heading → book, is to be committed beside the migration script in `ishqnama-db`):
- `جامع الترمذي، الترمذي ٢٧٩ه` (not `سنن الترمذي`); `تفسير ابن عربي، ابن عربي ٦٣٨ه` for all five Ibn Arabi headings, the `(المنسوب)` and `(مصدر المشروع)` tags dropped; `لباب التأويل في معاني التنزيل، الخازن ٧٤١ه` (standard spelling).
- `نقلیات` and `نقلیات میاں عبدالرشید` are one book: title `نقلیات`, author `حضرت بندگی میاں عبدالرشیدؓ`. The two lines headed `حاشیہ ٧٩٨` are filed under it as `نقل ١٩٦` and `نقل ٢٥٦` and the heading is dropped (a footnote number from the working file, not a book; the owner is to confirm against the text).
- Mahdavi authors carry their honorifics in `Author`: `حضرت بندگی میاں عبدالرشیدؓ` (نقلیات), `حضرت بندگی میاں سید برہان الدینؒ` (شواہد الولایت), `حضرت بندگی میراں سید محمودؓ` (توضیحات). `انصاف نامہ` and `حاشیہ انصاف نامہ` have no author in the data and show their title alone.
- The five انصاف نامہ references written as `سطر N من ملف النص` (lines of a working text file) are dropped: `Reference` is NULL for those rows and the quoted saying stays in `Note`. The proper numbers can be added by hand later.
- `البحر المحيط، أبو حيان الغرناطي ٧٤٥ه`; `مرآة الزمان في تواريخ الأعيان، سبط ابن الجوزي ٦٥٤ه`.
- `الأربعون النووية، النووي ٦٧٦ه` is its own book. The one line headed `صحيح مسلم / الأربعون النووية` becomes two citations: `صحيح مسلم` with reference `ح٨` and `الأربعون النووية` with reference `رقم ٢`.
### B3. `:dev` image: no change
Local development runs the database from the sibling repo through `backend/docker-compose.local-db.yml` (`docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d`), which builds `database/Dockerfile`, the seed files as they stand, so the `<mark>`/`<ins data-takhreej>` markup and the two new tables are there with no extra work. `999-obfuscate-explanations.sql` and `Dockerfile.dev` stay as they are: in the `:dev` image the anchors vanish with the obfuscated prose, so no icons show there (the citation rows still load and the API still returns `takhreej`, which the frontend ignores without an anchor). Nothing in the `:dev` image needs to carry the feature.

## Part C: API (`ishqnama-web/backend`)

- Domain: `Book` and `TranslationSegmentCitation` entities; EF configurations beside `TranslationSegmentConfiguration.cs`; `TranslationSegment.Citations` navigation.
- `CachedQuranReadOnlyRepository`: load both tables into memory with the segments (one extra query each at warm-up); `MapVersesWithTranslations` / `GetVerseAsync` group a segment's citations by `BlockOrdinal`, ordered by `SortOrder`.
- DTOs (`Application/Dtos/VerseDto.cs`): `TranslationSegmentDto` gains `IReadOnlyList<TakhreejBlockDto>? Takhreej` (null when none); `TakhreejBlockDto(int Ordinal, IReadOnlyList<CitationDto> Citations)`; `CitationDto(string Title, string? Author, int? AuthorDeathYearHijri, string? Reference, string? Note, string? Url)`. Add both records to `Api/Json/IshqnamaJsonContext.cs` (trimmed publish). `DtoMappings.ToDto` maps them; test in `tests/Ishqnama.Application.Tests` (ordering by ordinal and sort order, null when empty).
- `StripExplanations` in **both** `Api/Helpers/AuthExtensions.cs` and `Functions/Helpers/AuthExtensions.cs`: also `Takhreej = null` for anonymous readers (citations are part of the explanation).
- `CacheHeaderMiddleware` (both hosts): ETag prefix `v2-` → `v3-`. Cached `immutable` responses still live up to 30 days; the frontend fallback in A2 covers them.
- Search: unchanged (matches raw `Explanation`; book names stop matching, which is fine; `/api/search` returns the full explanation HTML, so the search card must cope with the new markup — A6).
- `SearchResultDto` does not need takhreej.
- `backend/CLAUDE.md`: a paragraph on the two tables, the anchor convention and the strip rule.
- User settings: `ShowTakhreej` (default `true`) on `UserSettingsDto`, `UserSettings` and the Cosmos mappings, for the reader setting in A7.

## Part A: frontend (`ishqnama-web/frontend/src`)

### A1. `lib/highlight-html.ts` (new) — pure refactor first
Move the identical private `highlightHtml`/`escapeRegExp` from `components/scripture/ayah-block.tsx:20-46` and `components/search-result-card.tsx:24-36` into one module: `escapeRegExp(s)`, `highlightHtml(html, query, markClass)` (with the `if (!query) return html` guard). Both components import it and keep their JSX `highlightText`. Test `lib/__tests__/highlight-html.test.ts`: case-insensitive match, tags untouched, regex metacharacters, empty query returns input.

### A2. `lib/tafseer-takhreej.ts` (new parser, pure)
```ts
export interface Citation { title: string; author?: string; authorDeathYearHijri?: number; reference?: string; note?: string; url?: string }
export type TafseerPart =
  | { kind: "html"; html: string }
  | { kind: "takhreej"; passageHtml: string; ordinal?: number; inlineLines?: string[] };
export function splitTakhreej(html: string): TafseerPart[];
export function flattenTakhreej(html: string): string;   // passage unwrapped, <ins> dropped: for the search snippet
export function citationsFor(part, blocks?: TakhreejBlockDto[]): Citation[] | string[];
```
- Match `/<mark>([\s\S]*?)<\/mark>/g` (no class: the search `<mark class>` is never in the input because parsing runs first). Inside, find `/<ins\b([^>]*)>([\s\S]*?)<\/ins>/`; `passageHtml` is the mark's inner HTML with the `<ins>` removed; `ordinal` from `data-takhreej="n"` when present; `inlineLines` from the `<ins>` text when it is non-empty (old form: strip tags, decode `&amp; &lt; &gt; &quot; &#39; &nbsp;`, split `/\r?\n/`, trim whitespace and leading/trailing `,`/`،`, drop empties). A `<mark>` with no `<ins>` is kept as prose (no icon). A bare `<ins>` outside any `<mark>` (today's data) becomes a takhreej part with an empty passage, so A still works on the current seed. An `<ins>` with neither ordinal nor lines vanishes.
- Prose parts verbatim; no `<mark>`/`<ins>` → `[{ kind: "html", html }]`; `""` → `[]`.
- `citationsFor`: when the segment's `takhreej` array (from C) has the ordinal, return its `Citation[]`; else the `inlineLines` (string[]) so an old cached response still shows something.

Test `lib/__tests__/tafseer-takhreej.test.ts` with real samples: mark + numbered anchor; mark + inline lines (old form) with `</ins>` on its own line, mid-line and at the end; `\r\n`; trailing ASCII comma stripped, inner `،` kept; empty `<ins></ins>` inside and outside a mark; bare `<ins>` without a mark; `<span lang>` inside the passage kept, inside the `<ins>` stripped; several blocks in one explanation; none; empty string; `flattenTakhreej` returns prose with the passage text kept and no `mark`/`ins`.

### A3. Copy, icon, telemetry
- `config/tafseer-copy.ts`: `TAFSEER_COPY = { takhreej: "Takhreej", showTakhreej: "Show takhreej", passage: "About this passage" } as const` + `config/__tests__/tafseer-copy.test.ts` modelled on `audio-copy.test.ts` (non-empty, banned technical words incl. `html|tag|popup|modal`, under twelve words, sentence case). The `year(n)` formatter (Eastern Arabic digits + `ه‍`) lives in `lib/tafseer-takhreej.ts`, not copy.
- `components/ui/icon.tsx`: add `bookOpen: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"` (Feather's open book).
- `lib/telemetry-events.ts`: add `"takhreej-opened"` with `{ route }` only (same shape as `recording-played`; no verse or citation text). Extend any exhaustive event-name list in `lib/__tests__/telemetry*.test.ts`.
- `types/api.ts`: `TranslationSegmentDto.takhreej?: TakhreejBlockDto[]`, `TakhreejBlockDto { ordinal; citations: CitationDto[] }`, `CitationDto { title; author?; authorDeathYearHijri?; reference?; note?; url? }`; carry it onto `DisplaySegment` in `hooks/use-chapter-verses.ts` (`toDisplayVerse`, shared by the juz and ruku hooks).

### A4. `components/lists/sheet.tsx` — one line
Overlay `onClick={onClose}` → `onClick={(e) => { e.stopPropagation(); onClose(); }}`, consistent with the panel already stopping propagation. Run the existing list/sheet tests.

### A5. `components/scripture/tafseer-html.tsx` + `tafseer-html.module.css` (new)
`TafseerHtml({ html, takhreej?, showTakhreej?, highlightQuery?, markClassName? })` (`showTakhreej` is the reader setting from A7): `useMemo(() => splitTakhreej(html), [html])`; `html` parts → `<span dangerouslySetInnerHTML>` (through `highlightHtml` when both `highlightQuery` and `markClassName` are given); `takhreej` parts → `<TakhreejPassage>`: a `<mark className={styles.passage}>` holding the passage HTML (highlighted the same way) followed by the `TakhreejButton`. With no blocks it renders exactly the single span the call sites render today, so the `:global(span[lang=…])` descendant rules under `.tafseer` / `.popupTafseerItem` / `.explanation` keep applying.

`TakhreejButton({ passageHtml, citations })` (state per button; `const close = useCallback(() => setOpen(false), [])` so `Sheet` doesn't re-register its Escape listener):
- `<button type="button" className={styles.button} aria-label={TAFSEER_COPY.showTakhreej} aria-haspopup="dialog" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(true); trackEvent("takhreej-opened", { route }) }}><Icon name="bookOpen" className={styles.icon} /></button>`; `stopPropagation` covers mouse, touch and keyboard.
- While open: `createPortal(<Sheet onClose={close} title={TAFSEER_COPY.takhreej}>…</Sheet>, document.body)` (my call: rendered in place it would inherit the tafseer div's `dir`, `lang`, inline `fontSize`, `color`, `text-align: justify` and `cursor: pointer`, flipping the sheet header; the portal keeps the sheet in the site's own chrome). Body: when the passage is non-empty, a quote block (`<blockquote dir="rtl" lang="ur">` in `--font-urdu`, the passage HTML, muted) so the reader sees what the books are about; then `<ol dir="rtl" lang="ar">` of citations, one `<li>` each: title in `--font-arabic` `--text-primary`, then author and `year(n)` muted on the same line, then the reference on its own line if present. When the citation has a `url` (and it starts with `https://`; anything else is ignored), the reference line is a link to it, `target="_blank" rel="noopener noreferrer"`, with the reference text as the link text (the title when there is no reference); the address itself is never printed. A `note` follows on its own line under the reference, muted and smaller (`.note`), as plain text (React-escaped, never `dangerouslySetInnerHTML`). Old-form `string[]` lines render as plain `<li>` text. `Sheet` locks scroll (counted; fine over the continuous-mode verse popup at z-index 101), handles Escape and backdrop, and returns focus to the button.

CSS (tokens only; `no-hardcoded-colours.test.ts` allows gold tints): `.passage { background: color-mix(in srgb, var(--gold) 12%, transparent); border-radius: 2px; padding-inline: 0.1em; color: inherit }` (a wash like `.segHighlight` at 15%, lighter so the two stack readably; must not look like the search `<mark>`, which is the caller's `searchHighlight` class). `.button` inline-flex, `vertical-align: -0.15em`, `margin-inline-start: 0.15em`, no border, transparent, `color: var(--gold)`, hover `var(--tint-teal-6)`, focus-visible `2px solid var(--teal-accent)`; `.icon { width: 1em; height: 1em }` so it scales with the tafseer size. Sheet body: `.quote` muted `--text-tertiary`, `--leading-urdu`; `.list` `--text-lg`, `--leading-arabic`, `text-align: start`, `padding-block: var(--space-1)` per item; `.meta` (author, year) `--text-secondary` `--text-sm`; `.reference` `--text-sm` (as a link: `--teal-primary`, underlined on hover, the same focus ring as the button); `.note` `--text-tertiary` `--text-sm`, `--leading-arabic`.

Test `components/scripture/__tests__/tafseer-html.test.tsx`: button count equals blocks (none without), passage rendered inside a `mark` with `styles.passage`, `aria-label` "Show takhreej"; click doesn't fire a parent `<div onClick={spy}>`; dialog `getByRole("dialog", { name: "Takhreej" })` shows the passage quote and the citations in order (title, author, `٣١٠ه‍`, reference); a citation with an `https://` `url` renders its reference as a link with `target="_blank"` and `rel="noopener noreferrer"`, one without a `url` (or with a non-https one) renders plain text; a `note` shows under its reference and one holding `<b>` shows the characters, not bold text; overlay click closes without firing the spy; Escape closes and `document.activeElement === button`; with `takhreej` prop absent and inline lines present, the lines are listed; `highlightQuery` marks prose and passage text but never citation text; `trackEvent` (mocked) called once with only `route`.

### A6. Call sites (minimal diffs)
- `components/scripture/ayah-block.tsx:246` → `<TafseerHtml html={seg.explanation} takhreej={seg.takhreej} highlightQuery={highlightQuery} markClassName={styles.searchHighlight} />`; delete the private helpers (A1).
- `components/scripture/quran-reader-client.tsx:550` → `<TafseerHtml html={seg.explanation} takhreej={seg.takhreej} />`. Line 284 joins bismillah segment explanations with `" "`: ordinals are per segment, so join the `takhreej` arrays too and pass them with their segment index, or (simpler) render one `TafseerHtml` per segment inside `BismillahBlock` — choose the latter: `BismillahBlock` takes `segments?: DisplaySegment[]` instead of one `explanation` string.
- `components/scripture/bismillah-block.tsx:52-64`: drop `dangerouslySetInnerHTML`; render a `TafseerHtml` per segment.
- `components/search-result-card.tsx:153` → `highlightHtml(trimHtmlAroundQuery(flattenTakhreej(result.explanation), query), query, styles.highlight)`: the passage stays as plain prose, no `<mark>` or button inside the link.
- Tests: `ayah-block.test.tsx` case (explanation with a block + `showTafseer`: the button exists, clicking it leaves the tafseer div without `styles.segHighlight`); new `components/__tests__/search-result-card.test.tsx` (block → no button, no `mark` without the highlight class, no citation text, passage text present, prose highlighted).

### A7. Reader setting "Show takhreej on tafseer" (owner's decision, 2026-11-22)
A boolean reader setting `showTakhreej`, **true by default for everyone** (anonymous readers, new accounts, and accounts saved before the setting existed), saved with the reader's other settings.
- `types/user.ts` (`UserSettings.showTakhreej: boolean`) and `context/reader-settings-context.tsx`: add it to `DEFAULT_SETTINGS` (`true`), the `updateSettings` patch merge, the context value and the props handed to the sheet (`showTakhreej`, `onTakhreejChange`), exactly as `showTafseer` is carried. A settings GET from before the backend change has no such field: read it as `true` (`?? true`), never as `false`.
- `components/settings-sheet.tsx`, "Reader settings" section: a second `styles.group` directly below "Show tafseer" holding `<Switch label="Show takhreej on tafseer" checked={showTakhreej} onChange={onTakhreejChange} disabled={!showTafseer} className={styles.switchRow} />`. While "Show tafseer" is off the row is greyed out and cannot be toggled (native `disabled` on the switch's input, so it also leaves the tab order, plus a muted label); it keeps showing its saved value, which is not changed by turning tafseer off, so turning tafseer back on restores the reader's choice. If `components/ui/switch.tsx` has no `disabled` prop, add one (input `disabled`, `aria-disabled`, a `.disabled` style from tokens: `--text-tertiary` label, reduced opacity on the track, `cursor: not-allowed`).
- Rendering: `TafseerHtml` takes `showTakhreej?: boolean` (default `true`). When `false` it renders `flattenTakhreej(html)` as the single prose span: the passage reads as ordinary tafseer with no wash, no icon and no sheet. The three call sites (A6) pass `useReaderSettings().showTakhreej`. The reader's `?tafseer=` query override stays as it is; takhreej has no query override.
- Backend (same change set as Part C): `UserSettingsDto` gains `bool ShowTakhreej = true` after `RecitationSpeed` (a defaulted parameter, so a save from an older client leaves it on), `UserSettings.ShowTakhreej { get; set; } = true` (a stored document without the field reads as `true`), and both mappings in `CosmosUserDataRepository`. `backend/CLAUDE.md` needs no route change.
- Tests: `settings-sheet.test.tsx` (the switch sits after "Show tafseer" in the Reader settings section; disabled when `showTafseer` is false and enabled when true; toggling calls `onTakhreejChange`); `reader-settings-context.test.tsx` (`DEFAULT_SETTINGS.showTakhreej` is `true`; a server payload without the field yields `true`; a change is saved in the PUT body); `tafseer-html.test.tsx` (`showTakhreej={false}`: no button, no `mark`, passage text still present); a backend test that `UserSettingsDto` deserialised without `showTakhreej` has it `true`.

### A8. Docs
- `CLAUDE.md` frontend section: a **Takhreej** bullet (the `showTakhreej` reader setting and its dependence on "Show tafseer", the `<mark>`/`<ins data-takhreej>` convention, `splitTakhreej` and the inline-lines fallback, `TafseerHtml`, copy file, the search-card flatten, the sheet-overlay propagation rule, testing locally with `docker-compose.local-db.yml` since the `:dev` image shows no icons).
- `plans/frontend-takhreej-spec.md`: short design record (context, B2 template, C DTO shape, non-goals: no book pages, no structured locators; the only link is a citation's own `Url`).
- `plans/tech-debt.md` row + `plans/tafseer-takhreej-data-issues.md`: unmarked parenthetical citations outside any `<ins>` (`(تفسیرابن عربی صفحہ ۵۴ )` juz 1, `(تفسیر شیخ کبیر صفحہ ۱۰)` juz 7, `(ترمذی )`/`(مسلم )` juz 12, `(تفسیر ابن عربی جلد دوم صفحہ ۲۷۳)` juz 27) that could become citation rows later.

Sequence: A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8, tests green after each step.

## Verification
1. DB: start the local database (`cd backend && docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d`); `SELECT count(*) FROM "TranslationSegmentCitations"` matches the hand migration; the `<ins data-takhreej>` anchors in `TranslationSegments."Explanation"` equal the distinct `(TranslationSegmentId, BlockOrdinal)` pairs. `Dockerfile.dev` is unchanged, so it needs no check beyond still building.
2. Backend: `dotnet test`; `GET /api/chapters/2/verses/146?translationId=2` with a token returns `takhreej[0].citations` (7 rows for 2:146 since the older lists were dropped on 2026-11-22, each with `reference`, and `note`/`url` where the data has them) and without a token has `explanation` and `takhreej` null; ETag starts `v3-`.
3. Frontend: `npm test` (new tests plus `no-hardcoded-colours`, `theme-tokens`, sheet/list and recitation tests), `npm run lint`, `npm run build`.
4. Local run: `cd backend && docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d` (builds Postgres from the sibling `ishqnama-db` checkout, takhreej markup included; plain `docker-compose up -d` pulls the obfuscated `:dev` and shows no icons), `npm run dev`, sign in, open `/quran/2/?verse=146&mode=verse` with tafseer on. Check with Chrome DevTools MCP: the passage carries the gold wash with the open-book icon at its end; tapping opens the "Takhreej" sheet with the passage quote and the books (title, author, year, reference), rtl, and the tafseer highlight did not toggle; Escape/backdrop close it and focus returns; the same in continuous mode's verse popup (`/quran/33/?verse=37`, five icons, sheet over the popup) and on the bismillah block; `/search/` for a word from 2:146's passage shows the passage as plain text with the search highlight, no icon, no book names; dark mode; 33:69 and 68:9 show no icon; in Settings → Reader settings, "Show takhreej on tafseer" sits under "Show tafseer", is on by default, turning it off removes every wash and icon while the passage text stays, it survives a reload, and it greys out (keeping its value) while "Show tafseer" is off. Then clear site data for the API origin and reload to check the fallback path with a stale response is no longer needed (and keep one old cached response to see the inline-lines fallback list).
