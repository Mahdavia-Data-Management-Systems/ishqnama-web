# Articles: Noor e Imaan essays at /articles/, for signed-in readers

Design spec, 2026-10-08. The implementation plan that follows this spec goes in
`plans/frontend-articles-plan.md`.

## Context

`.ishqnama/articles/31.html` is an InDesign export (630 KB, Urdu, RTL) of a section of Noor e Imaan holding
23 essays, each opened by a `p.Heading-1` (﴿نسخ﴾, ﴿غزوۂ ہند﴾, ﴿امانت﴾ …). The first is the khatm dua, already
hosted (corrected) at `/nooreimaan/dua/`. The user wants these essays on the site under `/articles`, a section
that will later also hold other Quran-related articles.

Decisions taken with the user:
- One page per essay at `/articles/nooreimaan/<english-slug>/`; `/articles/` is the index.
- Convert once into committed typed data (`.ishqnama/` is gitignored, so CI never sees the source), rendered by
  React with the site's fonts, tokens and dark mode.
- **Signed-in readers only, truly private**: essay text is served by the API behind a token, never compiled
  into the static pages (a static page's text is readable in page source whatever the UI shows).
- Titles and the index are visible to everyone; opening an essay anonymously shows the sign-in prompt
  (site rule: account-only things are shown, never hidden). `/articles/` is disallowed in robots.txt and not in
  the sitemap.
- The dua essay is skipped; the index links to `/nooreimaan/dua/`.
- Only 31.html for now; the index is grouped by source so others can join later.
- "Articles" in the app bar and the mobile bottom nav.
- All UI work follows the frontend-design skill.

## What the source contains (measured)

- Paragraph classes: `body` (621), `table-body` (260, inside tables), `Heading-2` (25, in 2 essays: 5 and 18),
  `Heading-1` (23), one `doa` (dua, skipped), one `arabic` (actually Urdu prose → body), one
  `body-14 ParaOverride-1` holding a stray page number `۴` (dropped).
- Run classes: `urdu`, `Quran-Char` (624), `Arabic-Char` (645), `farsi-text` (19), `english` (2),
  `Heading-1-Char` (title text and its ﴿ ﴾). `CharOverride-*` only tweaks font/size; ignored.
- 85 tables, every row exactly 2 cells: a quotation (usually Arabic) and its Urdu rendering, first cell on the
  right (RTL). Most cells hold one paragraph; six hold 10 to 16 (verse passages), so a cell is a list of
  paragraphs.
- 17 paragraphs carry text outside any `<span>`, and 3 spans have only a `CharOverride-*` class: their kind
  comes from the `lang` attribute (span first, then paragraph): `ur` urdu, `ar` arabic, `fa` farsi, `en`
  english.
- InDesign splits runs mid-word, so adjacent runs of the same kind are merged with no space inserted.
- Text kept as exported (whitespace normalised only); no typesetting corrections, unlike the dua.

## Content pipeline

**Single source for titles**: `frontend/src/data/articles/nooreimaan.json`, hand-written, in book order:
`[{ slug, title /* English */, urduTitle }]`. Imported by the frontend (index, page titles, prev/next,
`generateStaticParams`) and read by the converter.

**Converter** `frontend/scripts/build_nooreimaan_articles.py` (underscored so its unittest can import it) (stdlib `html.parser`; `npm run articles:build`,
input defaults to `../.ishqnama/articles/31.html`). It matches each Heading-1 to the manifest by `urduTitle`
(fails on any essay missing from the manifest or vice versa), and writes one file per essay to
`backend/src/Ishqnama.Application/Articles/NoorEImaan/<slug>.json`:

```ts
type RunKind = "urdu" | "quran" | "arabic" | "farsi" | "english";
type Run = { kind: RunKind; text: string };
type Block =
  | { type: "p"; runs: Run[] }
  | { type: "h2"; id: string; runs: Run[] }   // id = "section-<n>"
  | { type: "pair"; rows: { quote: Run[][]; rendering: Run[][] }[] };  // each cell is a list of paragraphs
// file: { slug, urduTitle, blocks: Block[] }
```

It fails loudly on anything unexpected (unknown class, a row without 2 cells), strips ﴿ ﴾ from headings (the
page draws them), and skips the dua and the page-number paragraph. Output is deterministic (stable key order,
UTF-8 unescaped, trailing newline).

Proposed slugs and English titles (the user corrects them in spec review):

| slug | English title | Urdu |
|---|---|---|
| is-the-quran-connected | Is the Quran a connected discourse? | قرآن مربوط کلام الٰہی ہے یا غیر مرتب صحیفۂ الٰہی؟ |
| repetition-in-the-quran | Is there really repetition in the Quran? | کیا قرآن میں واقعی تکرار ہے؟ |
| naskh | Naskh (abrogation) | نسخ |
| harf-e-zaid | Harf-e-zaid (redundant letters) | حرف زائد |
| istisna-munqati | Istisna munqati (the disjoined exception) | استثناء منقطع |
| jumla-e-mutarida | Jumla-e-mutarida (the parenthetical clause) | جملۂ معترضہ |
| jumla-e-mustanifa | Jumla-e-mustanifa (the resumptive clause) | جملہ مستأنفہ |
| hazf | Hazf (ellipsis) | حذف |
| irab-in-the-quran | Are there errors of i'rab in the Quran? | کیا قرآن میں اعراب کی خطاء ہے |
| mahdi-and-isa | The Mahdi and Isa together | بحث اجتماع مہدی و عیسیٰ علیھما السلام |
| eighteen-ayaat | The eighteen ayaat | اٹھارہ آیتوں کا بیان |
| mahdi-e-maud | Is Syed Muhammad Jaunpuri the promised Mahdi? | کیا حضرت سید محمد جونپوری ہی مہدی موعود ہیں |
| tark-e-dunya | Tark-e-dunya | ترک دنیا |
| talab-e-deedar-e-khuda | Talab-e-deedar-e-khuda | طلب دیدار خدا |
| suhbat-e-sadiqeen | Suhbat-e-sadiqeen | صحبت صادقین |
| zikr-e-kaseer | Zikr-e-kaseer | ذکر کثیر |
| uzlat-anil-khalq | Uzlat anil khalq | عزلت عن الخلق |
| raising-hands-in-dua | Raising the hands in dua | ہاتھ اٹھاکر دعا کرنے کی بحث |
| dua-after-farz-namaz | No raised hands in dua after farz namaz | مہدویوں کا فرض نماز کے بعد ہاتھ اٹھا کر دعا نہ کرنا |
| shab-e-qadr | Shab-e-qadr | شب ِ قدر |
| ghazwa-e-hind | Ghazwa-e-hind | غزوۂ ہند |
| amanat | Amanat | امانت |

## Backend: `GET /api/articles/nooreimaan/{slug}` (authenticated)

- `Ishqnama.Application.csproj`: `<EmbeddedResource Include="Articles\NoorEImaan\*.json" />` (embedded
  resources survive the trimmed publish; `.dockerignore` only drops `*.md`, so JSON ships).
- `Ishqnama.Application/Services/ArticleService.cs` (a concrete service like the others there, no
  interface): on construction reads every manifest resource named `Articles/NoorEImaan/<slug>.json` into a
  `Dictionary<string, string>` slug → raw JSON (validating each parses and its `slug` matches the name).
  `string? GetNoorEImaanEssay(string slug)`, `IReadOnlyCollection<string> NoorEImaanSlugs`. Registered as a
  singleton in `Ishqnama.Api/Program.cs`.
- `Ishqnama.Api/Endpoints/ArticleEndpoints.cs`, mapped from `Program.cs` beside the others:
  `api.MapGet("/articles/nooreimaan/{slug}", GetEssay).RequireAuthorization().WithTags("Articles")`;
  returns the stored JSON verbatim as `application/json; charset=utf-8` (`TypedResults.Text`), or bare
  `TypedResults.NotFound()`. Raw passthrough avoids modelling the block union for the trimmed source-generated
  serializer; no new `IshqnamaJsonContext` entries.
- `Middleware/CacheHeaderMiddleware.cs`: `/api/articles` gets its own policy, `Cache-Control: private,
  no-cache`, keeping the middleware's existing assembly-version ETag (`"v2-<version>-a"`), `Vary:
  Authorization` and 304 short-circuit. The Quran routes keep `public, max-age=2592000, immutable`; the
  middleware chooses the `Cache-Control` value by path rather than only skipping excluded routes.
  - `private`: only the reader's browser may store the text, never a shared cache, which `public` would allow
    even for a request carrying a token.
  - `no-cache`: the browser revalidates on every visit, so an essay corrected later reaches readers with the
    next deploy rather than up to 30 days on, as `immutable` would allow. Unchanged essays cost a 304.
  - The version ETag is correct here because the essays are embedded in the API: their text can only change
    with a deploy, which changes the ETag.
  - The middleware runs after `UseAuthorization()`, so a request without a valid token gets 401 before the
    304 short-circuit can answer it.
  - The browser adds `If-None-Match` itself on revalidation; no frontend change and no CORS preflight.
- Functions host: not extended (no longer deployed; lists set the precedent).
- Tests in `backend/tests/Ishqnama.Application.Tests/ArticleServiceTests.cs`: 22 essays load, known slug
  returns JSON containing its `urduTitle`, unknown slug returns null.
- `backend/CLAUDE.md`: the endpoint, the embedded resources and the cache exclusion.

## Frontend

- **Index** `src/app/articles/page.tsx` (server, static): titles from the manifest, visible to all.
- **Essay** `src/app/articles/nooreimaan/[slug]/page.tsx` (server, `generateStaticParams` from the manifest,
  `generateMetadata` via `pageMetadata()` in `src/lib/page-metadata.ts`): renders the static header (Urdu and
  English title) and `<EssayGate slug>`.
- `src/components/articles/essay-gate.tsx` (client), modelled on `src/components/library-gate.tsx`: spinner
  (`AuthLoading`) until `authSettled`; anonymous → `EmptyState` with `SIGN_IN_COPY.articles` and a sign-in
  action, prompt opened once via `promptSignIn("articles")`; signed in → `<ProtectedRoute>` around
  `<EssayContent slug>`.
- `src/hooks/use-essay.ts` (`useEssay(slug)`): same shape as `src/hooks/use-arabic-verses.ts` (module-level promise cache per
  slug for the visit, dropped on failure, `{ essay, failed }`, retry through `onReady()`), calling
  `getNoorEImaanEssay(slug)` in a new `src/lib/articles-api.ts` built on `authenticatedApiFetch`.
- `EssayContent`: while loading, the reader's placeholder pattern from
  `src/components/scripture/quran-reader-client.tsx` (spinner plus `WARMING_MESSAGE` / `UNREACHABLE_MESSAGE`
  from `src/config/readiness-copy.ts` by `useApiReadiness()`, else "Opening the essay"); on failure "Try
  again". Then `src/components/articles/essay-body.tsx` renders `Block[]`.
- Types for the payload in `src/types/articles.ts` (mirrors the converter's shape).
- Sign-in copy: add `"articles"` to `SignInFeature` in `src/config/sign-in-copy.ts`:
  title "Sign in to read the articles", body "The essays of Noor e Imaan are for signed-in readers." (under
  12 words; passes `sign-in-copy.test.ts`).
- `/articles/nooreimaan/`: 301 to `/articles/` via a route in `public/staticwebapp.config.json`.
- Nav: `{ href: "/articles/", label: "Articles" }` after Quran in `src/components/navigation/app-bar.tsx` and
  `bottom-nav.tsx`; new `article` icon (an open page) in `src/components/ui/icon.tsx`.
- `src/lib/robots.ts`: add `/articles/` to `DISALLOWED_PATHS`. Sitemap unchanged (its test already checks it
  never lists a disallowed path).
- Root `CLAUDE.md`: an **Articles** bullet, `/articles/` in the gated list under **Sign-in prompt**, and in
  **robots.txt**.

## Visual design (frontend-design pass)

Subject: classical Urdu theological prose from a printed book, read by Mahdavi readers, often on phones. Job:
long, comfortable reading that keeps the book's voice, with Quran and Arabic quotations distinguishable at a
glance.

**Colour** (existing tokens only, so dark mode comes free): paper `--surface-page` #EDF5ED, card
`--surface-card` #FFFFFF, ink `--text-primary` #12312F, `--gold` #BEAA30 for ornaments and rules,
`--gold-label` #8A7A1E for headings, `--teal-primary` #004446 for Quran text and links.

**Type**: Jameel Noori Nastaleeq (`--font-urdu`) for all Urdu at `--text-urdu` (24px, ~19px on phones),
`--leading-urdu`, justified with `text-align-last: right` as the book sets it, measure capped by
`--max-width-reader` (760px). Quran runs in PDMS Saleem Quran (`--font-arabic`) in teal; other Arabic in Nafees
Naskh in ink; Farsi stays Nastaleeq. EB Garamond italic (`--font-display`) only for the English title under the
Urdu one, as on the dua page. No all-caps labels, no eyebrows.

**The one bold element: facing quotations.** Each `pair` is the book's two-column translation spread, remade
as a `<figure>`: the quotation (`<blockquote>`) on the right in its own face, the rendering on the left in
Nastaleeq, divided by a single gold vertical hairline, on the card surface with a single gold edge (echoing,
not repeating, the dua page's double rule). At ≤ 600px the halves stack, quotation above rendering, divided by
a short centred gold rule. Everything else stays quiet.

```
ESSAY (desktop)                               INDEX
┌──────────────────────────────────────┐      ┌──────────────────────────────────────┐
│          ﴿  نسخ  ﴾   (gold, 48px)     │      │ Articles                (Garamond)    │
│     Naskh (abrogation)  (italic)      │      │ Essays from Noor e Imaan  (muted)     │
│   From Noor e Imaan (link to About)   │      │                                       │
│ ─────────── contents (if h2s) ─────── │      │ Noor e Imaan                          │
│  Urdu paragraph … justified, RTL …    │      │ ───────────────────────────────────── │
│ ┌───────────────┬───────────────────┐ │      │ Naskh (abrogation)               نسخ  │
│ │ Urdu rendering│ Arabic quotation  │ │      │ ───────────────────────────────────── │
│ └───────────────┴───────────────────┘ │      │ Hazf (ellipsis)                  حذف  │
│  ﴿ پہلی آیت ﴾  h2, gold, right        │      │ …                                     │
│ ───────────────────────────────────── │      │ Dua for completing the Quran  دعاء…  │
│ next essay            previous essay  │      │ (links to /nooreimaan/dua/)           │
│            All articles                │      └──────────────────────────────────────┘
└──────────────────────────────────────┘
ESSAY, signed out: same header, then the site's EmptyState with "Sign in" in place of the text.
```

- The essay header copies the dua page's title treatment (gold Nastaleeq inside ﴿ ﴾ set in the Quran face),
  so the two Noor e Imaan pages read as one book. It is static, so even signed-out readers see what they are
  opening.
- Contents only for essays with `h2`s (2 essays): an RTL list of in-page links to `#section-<n>`.
- Index rows echo the pairs: English title left (Garamond), Urdu title right (Nastaleeq), the whole row one
  link, hairline between rows (`--tint-ink-10`), no cards or shadows. Book order, no numbers. The dua is the
  last row, as in the book. One heading per source ("Noor e Imaan") so later sources append below.
- Prev/next at the foot in book order, named by essay title, plus "All articles"; next essay on the left (RTL).
- No motion. Existing focus style; links teal with the dua page's underline.
- Checked against defaults: card grids, numbered markers and eyebrow labels were considered and rejected; the
  gold-edged facing quotation comes from this book's own layout.

## Testing

- Frontend (vitest): manifest slugs unique and kebab-case, 22 entries, dua absent
  (`src/data/articles/__tests__`); `essay-body` renders runs with `lang` (`ur`/`ar`/`fa`/`en`), the Quran
  class, pairs as `<figure>` with two halves, `h2` ids; `essay-gate` shows the prompt for anonymous readers and
  the content for signed-in ones (mocking MSAL as existing gate tests do); robots test covers `/articles/`;
  sign-in copy test covers the new entry; `no-hardcoded-colours` / `theme-tokens` guard the new CSS.
- Backend (xUnit): `ArticleServiceTests` as above. The `Cache-Control` choice by path is a small pure
  function in the middleware (`CacheControlFor(PathString)`, returning null for excluded routes), but the test
  project only references the Application layer, so it is covered by the verification step below rather than a
  unit test.

## Verification

1. `npm run articles:build` twice: `git diff` empty the second time (deterministic).
2. `dotnet build` + `dotnet test` in `backend/`; `npm test`, `npm run lint`, `npm run build` in `frontend/`;
   `out/articles/nooreimaan/naskh/index.html` exists and contains no essay body text (grep a sentence).
3. API locally (`docker-compose up -d`): `curl` the endpoint without a token → 401, also when sending a
   matching `If-None-Match`; with a token → 200 with `Cache-Control: private, no-cache` and the ETag, and
   repeating with that ETag in `If-None-Match` → 304. A Quran route still returns `public, max-age=2592000,
   immutable`.
4. `npm run dev` against the local API, using Playwright: signed out, `/articles/` lists titles and an essay
   shows the prompt; signed in, `/articles/nooreimaan/naskh/` and `/eighteen-ayaat/` render. Screenshots at
   1280px and 375px, light and dark: Quran face, stacked pairs on mobile, no horizontal scroll, keyboard focus.
5. Spot-check paragraphs against `31.html` in a browser for missing or merged words.
