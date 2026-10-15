# Articles: essays in other languages

**Status: postponed indefinitely (reviewed with the user 2026-10-14; not scheduled).** The design
below is settled as far as the review went, but it is not approved for implementation; revisit it
before starting. The recordings work it was once paired with is in
`plans/articles-recordings-spec.md` and is being implemented on its own; when this work resumes,
check what that work changed in `EssayContent` and `EssayReader` first.

## Context

The 22 Noor e Imaan essays are Urdu-only: one committed JSON file per essay, embedded in the API
and served verbatim to signed-in readers (`GET /api/articles/nooreimaan/{slug}`), rendered by
`EssayBody` under a reader toolbar that hides the Quran reader's language control
(`plans/frontend-articles-spec.md`). An essay should be readable in English as well as Urdu (Hindi
may follow). The translations are produced by a person and committed as JSON beside the Urdu
files, with the same privacy (API only, behind a token) and caching as the originals.

Decisions taken with the user: committed JSON translations (no editor UI); English only for now; a
translation is its own text, not a block-for-block mirror of the Urdu; the essay opens in the
reader's saved translation language and the toolbar switch changes the page only, never the saved
setting; the switch is shown only when an essay has more than one language.

## Data

- **Translation file** `backend/src/Ishqnama.Application/Articles/NoorEImaan/<slug>.english.json`:
  `{ slug, language: "english", urduTitle, title, blocks }`. `blocks` is the same `Block[]` type as
  the Urdu file (`p`, `h2`, `pair`, with the same `RunKind`s; `plans/frontend-articles-spec.md`), but
  the translation is its own text, not a block-for-block mirror of the original: the translator may
  merge, split, reorder or leave out paragraphs, write their own headings (with their own `h2` ids)
  and set a quotation as a `pair` row or inline, whichever reads best in English. Prose runs are
  `kind: "english"`; Quranic and Arabic quotations are `quran` / `arabic` runs copied verbatim, never
  translated (a convention, not something the check enforces). The Urdu file stays `<slug>.json`
  with no `language` field (it is the original, not a translation), so nothing existing moves.
- **Translator workflow**: start from a copy of `<slug>.json` or an empty file, write the English,
  run `npm run articles:check`. New `frontend/scripts/check_nooreimaan_translations.py` (stdlib,
  unittest file beside it, added to `articles:test`) checks every `<slug>.<language>.json` as a
  document in its own right, never against the Urdu text: it parses; `slug` and `language` match
  the file name and `<slug>.json` exists; `urduTitle` equals the original's and `title` is
  non-empty; every block is a known type with the fields of its shape (a `pair` row has both cells,
  each cell a list of paragraphs); every run has a known kind and non-empty text; `h2` ids are
  `[a-z0-9-]+` and unique within the file. It also checks the frontend manifest's `languages`
  (below) lists exactly the translations that exist on disk. The same checks run over the Urdu
  files too, so the converter's output is covered as well.
- **Converter** `build_nooreimaan_articles.py` (`main`, lines 193-194) currently deletes
  `OUT_DIR/*.json`; change it to delete only files with no language suffix (`<slug>.json`), so a
  rebuild never removes translations. Unit test for that.
- **Manifest** `frontend/src/data/articles/nooreimaan.json`: an entry may carry
  `"languages": ["english"]` (absent means Urdu only). `src/data/articles/nooreimaan.ts` exposes
  `essayLanguages(slug): EssayLanguage[]` (always starting with `"urdu"`). A vitest in
  `src/data/articles/__tests__/` reads the backend folder with `fs` (the way the ruku snapshot test
  checks data) and fails if the manifest and the files disagree.

## Backend

- `ArticleService`: key essays by `(slug, language)`. Resource names are
  `Articles/NoorEImaan/<slug>.json` (urdu) or `<slug>.<language>.json`; the constructor checks the
  declared `slug` and `language` match the name. `GetNoorEImaanEssay(slug, language = "urdu")`;
  content ETag per resource as today.
- `ArticleEndpoints`: `GET /articles/nooreimaan/{slug}?lang=` (default `urdu`); 404 when the essay
  or that language does not exist; same ETag/304 handling. No change to the cache middleware
  (`/api/articles` is already `private, no-cache`).
- Tests in `ArticleServiceTests`: an English essay loads under its language, a missing language
  returns null, ETags differ between the Urdu and English of one slug, `lang` is case-sensitive.
- Backend `CLAUDE.md`: the `lang` query and the file naming.

## Frontend

- **Types** `src/types/articles.ts`: `EssayLanguage = "urdu" | "english"`; `EssayDto` gains
  `language?: EssayLanguage` and `title?: string`; `EssayMeta` gains `languages?: EssayLanguage[]`.
- **API** `src/lib/articles-api.ts`: `getNoorEImaanEssay(slug, language)` adds `?lang=` for any
  language but Urdu. **Hook** `src/hooks/use-essay.ts`: `useEssay(slug, language)`, cache keyed
  `${slug}/${language}`.
- **Choice of language**: an essay opens in the reader's saved translation language, `lang` from
  `useReaderSettings()`, when the essay has it, else Urdu (an Urdu-only essay for an English
  reader, or any essay for a Hindi reader until a Hindi translation exists). The toolbar's language
  control then switches the language of the page only: it is local state, like the essay's font
  size, and is never written to the settings, so it does not change the Quran translation and
  leaves no trace on the account. Nothing is stored per browser either. The next essay, and this
  one on reload, open from the saved setting again. No telemetry event: the switch is a page
  action, not a preference.
- **`EssayReader`** (`src/components/articles/essay-reader.tsx`) owns that state:
  `useState(effectiveOf(savedLang))`, keyed by `slug` from the page so a different essay starts
  afresh. It takes `slug` and `languages` (from the manifest) instead of `children`, renders
  `<EssayGate slug language />` itself, and passes `lang` / `onLangChange` (the local setter) /
  new `langOptions={languages}` to `ReaderToolbar` only when the essay has more than one language;
  an Urdu-only essay shows no language control at all, as today. The control shows the page's
  language, so a Hindi reader sees اردو selected rather than nothing. `rtl={language === "urdu"}`
  so the arrows follow the reading direction.
- **`ReaderToolbar`** (`src/components/reader-toolbar.tsx`): new optional `langOptions?:
  TranslationLang[]` filtering the existing `langOptions` list (default: all three), so the essay
  shows only اردو | English. Essay language names reuse those labels; `EssayLanguage` is a subset of
  `TranslationLang`, so no new control.
- **`EssayGate`** passes `language` through to **`EssayContent`**, which calls
  `useEssay(slug, language)` and renders `<EssayBody blocks language />`.
- **`EssayBody`** (`src/components/articles/essay-body.tsx` + `.module.css`): takes `language`.
  The wrapper gets `lang`/`dir` for the language (`en`/`ltr`) and `data-language`. `Runs` takes the
  base kind: a run of the base kind is bare text; every other run is a `<span lang dir>` (`ltr` for
  english, `rtl` for urdu/quran/arabic/farsi), so Arabic and Urdu inside an English paragraph keep
  their direction and face (`.urdu` class: `--font-urdu`). CSS for `.body[data-language="english"]`:
  `--font-display`, `calc(1.1875rem * var(--essay-scale))` (Garamond runs small), `--leading-relaxed`,
  `text-align: start` with `text-align-last: auto` on paragraphs and renderings; the inline
  `.english` shrink to 0.8em applies only in the Urdu essay. `.quote` gets `dir="rtl"` always (it is
  Arabic in both). Headings keep the gold rule; the ﴿ ﴾ brackets are drawn only for Urdu. The pair
  layout already uses logical properties, so in LTR the gold edge and the quotation sit on the left
  without CSS changes. Colours: existing tokens only (`no-hardcoded-colours` test).
- **Essay page** `src/app/articles/nooreimaan/[slug]/page.tsx`: passes `slug` and
  `essayLanguages(slug)` to `EssayReader`. Header, sticky bar, share, metadata and foot unchanged.
- **Index** `src/app/articles/page.tsx`: essays with a translation show a small muted
  "Also in English" under the English title.
- Hindi later: a `<slug>.hindi.json`, a manifest entry, `"hindi"` in `EssayLanguage`, and one CSS
  rule for `--font-hindi`.
- Root `CLAUDE.md`: extend the **Articles** bullet (languages, the check script).

## Files

Backend: `Services/ArticleService.cs`, `Endpoints/ArticleEndpoints.cs`,
`tests/.../ArticleServiceTests.cs`.

Frontend: `types/articles.ts`, `lib/articles-api.ts`, `hooks/use-essay.ts`,
`components/reader-toolbar.tsx`, `components/articles/{essay-reader,essay-gate,essay-content,
essay-body}.tsx` and css, `app/articles/page.tsx`, `app/articles/nooreimaan/[slug]/page.tsx`,
`data/articles/nooreimaan.{json,ts}`, `scripts/check_nooreimaan_translations.py` (new),
`scripts/build_nooreimaan_articles.py`, `package.json` scripts, tests beside each.

## Verification

1. `npm run articles:test` (converter, translation check), `npm test`, `npm run lint`,
   `npm run build` in `frontend/`; `dotnet build` and `dotnet test` in `backend/`.
2. Put a short sample translation in place (one essay, a few blocks is enough to exercise p, h2
   and pair); `npm run articles:check` passes, and fails on an unknown run kind, an empty run, a
   duplicate `h2` id, a `pair` row missing a cell, or a manifest `languages` entry with no file
   (and vice versa).
3. API locally (`docker-compose up -d`): `?lang=english` returns the translation with its own
   ETag and 304 on revalidation; `?lang=hindi` → 404.
4. `npm run dev` with Playwright, signed in: the essay toolbar shows اردو | English only for the
   translated essay; English renders LTR in Garamond with Arabic quotations RTL and the pair's gold
   edge on the left; switching sends no settings PUT, the next essay and a reload open in the saved
   language again, and the Quran reader's translation is unchanged; Urdu-only essays show no
   control; with Hindi saved, the translated essay opens in Urdu with اردو selected. Screenshots at
   1280 and 375 px, light and dark.
