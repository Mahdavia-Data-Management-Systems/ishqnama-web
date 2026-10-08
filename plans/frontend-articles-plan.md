# Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host the 22 Noor e Imaan essays from `.ishqnama/articles/31.html` at `/articles/nooreimaan/<slug>/`, readable only by signed-in readers, with a public index at `/articles/`.

**Architecture:** A one-off Python converter turns the InDesign export into one JSON file per essay, embedded in the .NET Application assembly and served verbatim by an authenticated `GET /api/articles/nooreimaan/{slug}` with `Cache-Control: private, no-cache`. The static Next.js pages carry only titles (from a hand-written manifest); a client gate shows the sign-in prompt to anonymous readers and fetches and renders the essay for signed-in ones.

**Tech Stack:** Python 3 stdlib (`html.parser`, `unittest`), .NET 9 Minimal API + xUnit, Next.js 15 static export, React 19, MSAL React, Vitest + Testing Library, CSS modules on the `globals.css` tokens.

**Spec:** `plans/frontend-articles-spec.md`

## Global Constraints

- Essay text must never be compiled into the static site: no essay JSON imported by any frontend module; only the manifest (`slug`, `title`, `urduTitle`).
- Every colour in a CSS module is a token from `src/app/globals.css` (`no-hardcoded-colours.test.ts` fails otherwise).
- Reader-facing copy: sentence case, no "service", "API", "server", "account", "log in", "authenticate", "session"; sign-in copy under 12 words.
- Account-only things are shown to everyone; an anonymous reader gets the sign-in prompt, never a hidden control or a dead click.
- The Azure footprint stays at $0: no new resources.
- Commit messages never mention Claude and carry no Co-Authored-By trailer.
- Work on a branch `feature/articles`, not `main`.
- The Quran routes keep `Cache-Control: public, max-age=2592000, immutable`; only `/api/articles` gets `private, no-cache`.
- Slugs, in book order (also the file names of the embedded JSON): `is-the-quran-connected`, `repetition-in-the-quran`, `naskh`, `harf-e-zaid`, `istisna-munqati`, `jumla-e-mutarida`, `jumla-e-mustanifa`, `hazf`, `irab-in-the-quran`, `mahdi-and-isa`, `eighteen-ayaat`, `mahdi-e-maud`, `tark-e-dunya`, `talab-e-deedar-e-khuda`, `suhbat-e-sadiqeen`, `zikr-e-kaseer`, `uzlat-anil-khalq`, `raising-hands-in-dua`, `dua-after-farz-namaz`, `shab-e-qadr`, `ghazwa-e-hind`, `amanat`.

## Review Focus

1. **A request without a token but with a valid `If-None-Match`** must get 401, not 304: the cache middleware's 304 shortcut runs after `UseAuthorization()`. Pinned by the curl checks in Task 4.
2. **Moving from one essay to the next with prev/next** must never show the previous essay's text under the new title: `useEssay` resets to loading when the slug changes. Pinned in Task 5.
3. **A signed-in reader arriving during a cold start, or after a 500**: placeholder with the warming copy, automatic retry on `ready`, and a working "Try again" even when the API is already ready (where `onReady` never fires). Pinned in Tasks 5 and 7.
4. **Mixed-direction text**: an English run inside an RTL Urdu paragraph keeps its own direction (`dir="ltr"`), and the Quran and Arabic runs carry `lang="ar"`. Pinned in Task 6.
5. **The built site leaks no essay text**: `out/articles/nooreimaan/naskh/index.html` and its RSC payload contain the title but no body sentence. Pinned in Task 8's build check.

---

### Task 0: Branch

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feature/articles
```

---

### Task 1: Article types and the essay manifest

**Files:**
- Create: `frontend/src/types/articles.ts`
- Create: `frontend/src/data/articles/nooreimaan.json`
- Create: `frontend/src/data/articles/nooreimaan.ts`
- Test: `frontend/src/data/articles/__tests__/nooreimaan.test.ts`

**Interfaces:**
- Produces: types `RunKind`, `Run`, `PairRow`, `Block`, `EssayDto`, `EssayMeta`; `NOOR_E_IMAAN_ESSAYS: readonly EssayMeta[]`, `NOOR_E_IMAAN_ESSAY_BY_SLUG: Map<string, EssayMeta>`, `essayPath(slug: string): string`, `essayNeighbours(slug: string): { previous: EssayMeta | null; next: EssayMeta | null }`. The JSON file is read by Task 2's converter.

- [ ] **Step 1: Write the types**

`frontend/src/types/articles.ts`:

```ts
/**
 * The shape of an essay as `GET /api/articles/nooreimaan/{slug}` returns it, written by
 * `scripts/build_nooreimaan_articles.py` and served verbatim by the API.
 */
export type RunKind = "urdu" | "quran" | "arabic" | "farsi" | "english";

export interface Run {
  kind: RunKind;
  text: string;
}

/** One row of the book's two-column translation tables; each cell is a list of paragraphs. */
export interface PairRow {
  quote: Run[][];
  rendering: Run[][];
}

export type Block =
  | { type: "p"; runs: Run[] }
  | { type: "h2"; id: string; runs: Run[] }
  | { type: "pair"; rows: PairRow[] };

export interface EssayDto {
  slug: string;
  urduTitle: string;
  blocks: Block[];
}

/** What the static pages know about an essay: never its text. */
export interface EssayMeta {
  slug: string;
  title: string;
  urduTitle: string;
}
```

- [ ] **Step 2: Write the manifest**

`frontend/src/data/articles/nooreimaan.json` (the `urduTitle` strings are exactly as in the source, including the space in `تکرار ہے ؟` and the kasra in `شب ِ قدر`; the converter matches on them):

```json
[
  { "slug": "is-the-quran-connected", "title": "Is the Quran a connected discourse?", "urduTitle": "قرآن مربوط کلام الٰہی ہے یا غیر مرتب صحیفۂ الٰہی؟" },
  { "slug": "repetition-in-the-quran", "title": "Is there really repetition in the Quran?", "urduTitle": "کیا قرآن میں واقعی تکرار ہے ؟" },
  { "slug": "naskh", "title": "Naskh (abrogation)", "urduTitle": "نسخ" },
  { "slug": "harf-e-zaid", "title": "Harf-e-zaid (redundant letters)", "urduTitle": "حرف زائد" },
  { "slug": "istisna-munqati", "title": "Istisna munqati (the disjoined exception)", "urduTitle": "استثناء منقطع" },
  { "slug": "jumla-e-mutarida", "title": "Jumla-e-mutarida (the parenthetical clause)", "urduTitle": "جملۂ معترضہ" },
  { "slug": "jumla-e-mustanifa", "title": "Jumla-e-mustanifa (the resumptive clause)", "urduTitle": "جملہ مستأنفہ" },
  { "slug": "hazf", "title": "Hazf (ellipsis)", "urduTitle": "حذف" },
  { "slug": "irab-in-the-quran", "title": "Are there errors of i'rab in the Quran?", "urduTitle": "کیا قرآن میں اعراب کی خطاء ہے" },
  { "slug": "mahdi-and-isa", "title": "The Mahdi and Isa together", "urduTitle": "بحث اجتماع مہدی و عیسیٰ علیھما السلام" },
  { "slug": "eighteen-ayaat", "title": "The eighteen ayaat", "urduTitle": "اٹھارہ آیتوں کا بیان" },
  { "slug": "mahdi-e-maud", "title": "Is Syed Muhammad Jaunpuri the promised Mahdi?", "urduTitle": "کیا حضرت سید محمد جونپوری ہی مہدی موعود ہیں" },
  { "slug": "tark-e-dunya", "title": "Tark-e-dunya", "urduTitle": "ترک دنیا" },
  { "slug": "talab-e-deedar-e-khuda", "title": "Talab-e-deedar-e-khuda", "urduTitle": "طلب دیدار خدا" },
  { "slug": "suhbat-e-sadiqeen", "title": "Suhbat-e-sadiqeen", "urduTitle": "صحبت صادقین" },
  { "slug": "zikr-e-kaseer", "title": "Zikr-e-kaseer", "urduTitle": "ذکر کثیر" },
  { "slug": "uzlat-anil-khalq", "title": "Uzlat anil khalq", "urduTitle": "عزلت عن الخلق" },
  { "slug": "raising-hands-in-dua", "title": "Raising the hands in dua", "urduTitle": "ہاتھ اٹھاکر دعا کرنے کی بحث" },
  { "slug": "dua-after-farz-namaz", "title": "No raised hands in dua after farz namaz", "urduTitle": "مہدویوں کا فرض نماز کے بعد ہاتھ اٹھا کر دعا نہ کرنا" },
  { "slug": "shab-e-qadr", "title": "Shab-e-qadr", "urduTitle": "شب ِ قدر" },
  { "slug": "ghazwa-e-hind", "title": "Ghazwa-e-hind", "urduTitle": "غزوۂ ہند" },
  { "slug": "amanat", "title": "Amanat", "urduTitle": "امانت" }
]
```

- [ ] **Step 3: Write the failing test**

`frontend/src/data/articles/__tests__/nooreimaan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  NOOR_E_IMAAN_ESSAYS,
  NOOR_E_IMAAN_ESSAY_BY_SLUG,
  essayNeighbours,
  essayPath,
} from "@/data/articles/nooreimaan";

describe("Noor e Imaan essay manifest", () => {
  it("lists the 22 essays in book order, from the Quran's coherence to amanat", () => {
    expect(NOOR_E_IMAAN_ESSAYS).toHaveLength(22);
    expect(NOOR_E_IMAAN_ESSAYS[0].slug).toBe("is-the-quran-connected");
    expect(NOOR_E_IMAAN_ESSAYS[21].slug).toBe("amanat");
  });

  it("gives every essay a unique kebab-case slug and a unique Urdu title", () => {
    const slugs = NOOR_E_IMAAN_ESSAYS.map((e) => e.slug);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(NOOR_E_IMAAN_ESSAYS.map((e) => e.urduTitle)).size).toBe(22);
  });

  it("leaves out the dua, which has its own page", () => {
    expect(NOOR_E_IMAAN_ESSAYS.some((e) => e.urduTitle.includes("دعاء ختم"))).toBe(false);
  });

  it("looks essays up by slug and builds their paths", () => {
    expect(NOOR_E_IMAAN_ESSAY_BY_SLUG.get("naskh")?.urduTitle).toBe("نسخ");
    expect(essayPath("naskh")).toBe("/articles/nooreimaan/naskh/");
  });

  it("finds neighbours in book order, with none past either end", () => {
    expect(essayNeighbours("is-the-quran-connected")).toEqual({
      previous: null,
      next: NOOR_E_IMAAN_ESSAYS[1],
    });
    expect(essayNeighbours("amanat")).toEqual({ previous: NOOR_E_IMAAN_ESSAYS[20], next: null });
    expect(essayNeighbours("missing")).toEqual({ previous: null, next: null });
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `cd frontend && npx vitest run src/data/articles`
Expected: FAIL, cannot resolve `@/data/articles/nooreimaan`.

- [ ] **Step 5: Write the module**

`frontend/src/data/articles/nooreimaan.ts`:

```ts
import manifest from "./nooreimaan.json";
import type { EssayMeta } from "@/types/articles";

/**
 * The essays of Noor e Imaan, in book order. The titles live in JSON so that
 * `scripts/build_nooreimaan_articles.py` reads the same list; the essays' text is served by the
 * API to signed-in readers and is never part of the static site.
 */
export const NOOR_E_IMAAN_ESSAYS: readonly EssayMeta[] = manifest;

export const NOOR_E_IMAAN_ESSAY_BY_SLUG = new Map(NOOR_E_IMAAN_ESSAYS.map((e) => [e.slug, e]));

export function essayPath(slug: string): string {
  return `/articles/nooreimaan/${slug}/`;
}

/** The essays either side in book order, or null past either end. */
export function essayNeighbours(slug: string): { previous: EssayMeta | null; next: EssayMeta | null } {
  const i = NOOR_E_IMAAN_ESSAYS.findIndex((e) => e.slug === slug);
  if (i < 0) return { previous: null, next: null };
  return {
    previous: i > 0 ? NOOR_E_IMAAN_ESSAYS[i - 1] : null,
    next: i < NOOR_E_IMAAN_ESSAYS.length - 1 ? NOOR_E_IMAAN_ESSAYS[i + 1] : null,
  };
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/data/articles`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/articles.ts frontend/src/data/articles
git commit -m "Add the Noor e Imaan essay manifest and article types"
```

---

### Task 2: The converter and the generated essays

**Files:**
- Create: `frontend/scripts/build_nooreimaan_articles.py`
- Create: `frontend/scripts/test_build_nooreimaan_articles.py`
- Modify: `frontend/package.json` (scripts)
- Create (generated): `backend/src/Ishqnama.Application/Articles/NoorEImaan/*.json` (22 files)

**Interfaces:**
- Consumes: `frontend/src/data/articles/nooreimaan.json` (Task 1).
- Produces: `<slug>.json` files shaped as `EssayDto` (Task 1 types), read by Task 3.

- [ ] **Step 1: Write the failing tests**

`frontend/scripts/test_build_nooreimaan_articles.py`:

```python
"""Tests for build_nooreimaan_articles. Run from frontend/: python -m unittest discover -s scripts -p "test_*.py" """
import unittest

from build_nooreimaan_articles import convert

MANIFEST = [{"slug": "naskh", "title": "Naskh", "urduTitle": "نسخ"}]


def doc(body: str) -> str:
    return f'<html><head><title>31</title></head><body><div dir="rtl">{body}</div></body></html>'


def heading(title: str) -> str:
    return (
        '<p class="Heading-1" lang="ur-PK"><span class="Heading-1-Char" lang="en-US">﴿</span>'
        f'<span class="Heading-1-Char" lang="en-US">{title}</span>'
        '<span class="Heading-1-Char" lang="en-US">﴾</span></p>'
    )


def blocks(body: str):
    return convert(doc(heading("نسخ") + body), MANIFEST)[0]["blocks"]


class ConvertTests(unittest.TestCase):
    def test_merges_runs_split_mid_word_and_trims_the_ends(self):
        out = blocks(
            '<p class="body" lang="ur-PK"><span class="urdu" lang="ur-PK"> قرآ</span>'
            '<span class="urdu" lang="ur-PK">ن  میں </span>'
            '<span class="Quran-Char" lang="ar-SA"> إِنَّمَا </span></p>'
        )
        self.assertEqual(
            out,
            [{"type": "p", "runs": [{"kind": "urdu", "text": "قرآن میں "}, {"kind": "quran", "text": "إِنَّمَا"}]}],
        )

    def test_takes_the_kind_from_lang_when_the_class_says_nothing(self):
        out = blocks(
            '<p class="body" lang="ur-PK">(احزاب)<span class="CharOverride-8" lang="ar-SA">النازعات</span>'
            '<span class="farsi-text" lang="fa-IR">فارسی</span><span class="english CharOverride-9" lang="en-GB">Al Fauz</span></p>'
        )
        self.assertEqual(
            [r["kind"] for r in out[0]["runs"]], ["urdu", "arabic", "farsi", "english"]
        )

    def test_numbers_subheadings_and_strips_their_ornaments(self):
        out = blocks(
            '<p class="Heading-2" lang="ur-PK"><span class="urdu" lang="ur-PK">﴿پہلی آیت﴾</span></p>'
            '<p class="Heading-2" lang="ur-PK"><span class="urdu" lang="ur-PK">﴿دوسری آیت﴾</span></p>'
        )
        self.assertEqual(
            out,
            [
                {"type": "h2", "id": "section-1", "runs": [{"kind": "urdu", "text": "پہلی آیت"}]},
                {"type": "h2", "id": "section-2", "runs": [{"kind": "urdu", "text": "دوسری آیت"}]},
            ],
        )

    def test_turns_a_two_column_table_into_a_pair_of_paragraph_lists(self):
        out = blocks(
            '<table class="nooreimaan"><colgroup><col /><col /></colgroup><tbody><tr>'
            '<td><p class="table-body" lang="ur-PK"><span class="Arabic-Char" lang="ar-SA">ولم يراع</span></p></td>'
            '<td><p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">اور</span></p>'
            '<p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">دوسرا</span></p></td>'
            "</tr></tbody></table>"
        )
        self.assertEqual(
            out,
            [{
                "type": "pair",
                "rows": [{
                    "quote": [[{"kind": "arabic", "text": "ولم يراع"}]],
                    "rendering": [[{"kind": "urdu", "text": "اور"}], [{"kind": "urdu", "text": "دوسرا"}]],
                }],
            }],
        )

    def test_drops_the_page_number_and_skips_the_dua_essay(self):
        source = doc(
            heading("دعاء ختم القران")
            + '<p class="doa" lang="ar-SA"><span class="Arabic-Char" lang="ar-SA">صَدَقَ</span></p>'
            + heading("نسخ")
            + '<p class="body" lang="ur-PK"><span class="urdu" lang="ur-PK">متن</span></p>'
            + '<p class="body-14 ParaOverride-1" lang="ur-PK"><span class="Arabic-Char CharOverride-10" lang="ar-SA">۴</span></p>'
        )
        self.assertEqual(
            convert(source, MANIFEST),
            [{"slug": "naskh", "urduTitle": "نسخ", "blocks": [{"type": "p", "runs": [{"kind": "urdu", "text": "متن"}]}]}],
        )

    def test_fails_on_an_unknown_paragraph_class(self):
        with self.assertRaisesRegex(ValueError, "unknown paragraph class"):
            blocks('<p class="caption" lang="ur-PK"><span class="urdu" lang="ur-PK">x</span></p>')

    def test_fails_on_a_row_without_two_cells(self):
        with self.assertRaisesRegex(ValueError, "3 cells"):
            blocks(
                "<table><tbody><tr>"
                + '<td><p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">x</span></p></td>' * 3
                + "</tr></tbody></table>"
            )

    def test_fails_on_an_empty_cell(self):
        with self.assertRaisesRegex(ValueError, "empty table cell"):
            blocks(
                '<table><tbody><tr><td></td><td><p class="table-body" lang="ur-PK">'
                '<span class="urdu" lang="ur-PK">x</span></p></td></tr></tbody></table>'
            )

    def test_fails_when_the_source_and_the_manifest_disagree(self):
        with self.assertRaisesRegex(ValueError, "manifest"):
            convert(doc(heading("حذف")), MANIFEST)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd frontend && python -m unittest discover -s scripts -p "test_*.py"`
Expected: FAIL with `ModuleNotFoundError: No module named 'build_nooreimaan_articles'`.

- [ ] **Step 3: Write the converter**

`frontend/scripts/build_nooreimaan_articles.py`:

```python
"""Converts the InDesign HTML export of Noor e Imaan's essays (31.html) into one JSON file per essay,
which the API embeds and serves to signed-in readers.

Titles and slugs come from src/data/articles/nooreimaan.json, in book order; the dua essay is skipped
(it lives, corrected, at /nooreimaan/dua/). The text is kept as exported: InDesign's runs are merged and
whitespace collapsed, nothing else. Anything unrecognised fails the run rather than being guessed at.

Usage, from frontend/: npm run articles:build [-- path/to/31.html]
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

FRONTEND = Path(__file__).resolve().parent.parent
MANIFEST = FRONTEND / "src" / "data" / "articles" / "nooreimaan.json"
OUT_DIR = FRONTEND.parent / "backend" / "src" / "Ishqnama.Application" / "Articles" / "NoorEImaan"
DEFAULT_SOURCE = FRONTEND.parent / ".ishqnama" / "articles" / "31.html"

SKIPPED_ESSAYS = {"دعاء ختم القران"}
SPAN_KINDS = {
    "urdu": "urdu",
    "Heading-1-Char": "urdu",
    "Quran-Char": "quran",
    "Arabic-Char": "arabic",
    "farsi-text": "farsi",
    "english": "english",
}
LANG_KINDS = {"ur": "urdu", "ar": "arabic", "fa": "farsi", "en": "english"}
BODY_CLASSES = {"body", "arabic", "table-body"}  # "arabic" is one paragraph of Urdu prose
SKIPPED_CLASSES = {"doa", "body-14"}  # the dua; a stray page number
ORNAMENTS = str.maketrans("", "", "﴿﴾")


def kind_for(classes: list[str], lang: str | None) -> str:
    for c in classes:
        if c in SPAN_KINDS:
            return SPAN_KINDS[c]
    prefix = (lang or "").split("-")[0]
    if prefix in LANG_KINDS:
        return LANG_KINDS[prefix]
    raise ValueError(f"no run kind for classes {classes} and lang {lang!r}")


def merge(runs: list[tuple[str, str]]) -> list[dict]:
    """Joins neighbouring runs of one kind (InDesign splits them mid-word), collapses whitespace and
    trims the paragraph's ends."""
    merged: list[dict] = []
    for kind, text in runs:
        if merged and merged[-1]["kind"] == kind:
            merged[-1]["text"] += text
        else:
            merged.append({"kind": kind, "text": text})
    for run in merged:
        run["text"] = re.sub(r"\s+", " ", run["text"])
    for a, b in zip(merged, merged[1:]):
        if a["text"].endswith(" ") and b["text"].startswith(" "):
            b["text"] = b["text"][1:]
    if merged:
        merged[0]["text"] = merged[0]["text"].lstrip()
        merged[-1]["text"] = merged[-1]["text"].rstrip()
    kept = [(r["kind"], r["text"]) for r in merged if r["text"]]
    if len(kept) < len(merged):
        return merge(kept)  # dropping an empty run can leave two runs of one kind side by side
    return [{"kind": k, "text": t} for k, t in kept]


class ExportParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.essays: list[dict] = []
        self.in_body = False
        self.para: dict | None = None
        self.spans: list[str] = []
        self.table: list[list[list[list[dict]]]] | None = None  # rows > cells > paragraphs > runs

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if tag == "body":
            self.in_body = True
        elif tag == "p":
            if self.para is not None:
                raise ValueError("nested <p>")
            self.para = {"cls": classes[0] if classes else "", "lang": a.get("lang"), "runs": []}
        elif tag == "span":
            if self.para is None:
                raise ValueError("<span> outside a paragraph")
            self.spans.append(kind_for(classes, a.get("lang")))
        elif tag == "table":
            self.table = []
        elif tag == "tr":
            self.table.append([])
        elif tag == "td":
            self.table[-1].append([])

    def handle_endtag(self, tag):
        if tag == "span":
            self.spans.pop()
        elif tag == "p":
            self.end_paragraph()
        elif tag == "table":
            self.end_table()

    def handle_data(self, data):
        if not self.in_body:
            return
        if self.para is None:
            if data.strip():
                raise ValueError(f"text outside a paragraph: {data[:40]!r}")
            return
        kind = self.spans[-1] if self.spans else kind_for([], self.para["lang"])
        self.para["runs"].append((kind, data))

    def end_paragraph(self):
        para, self.para = self.para, None
        cls = para["cls"]
        if cls in SKIPPED_CLASSES:
            return
        if cls == "Heading-1":
            title = "".join(text for _, text in para["runs"]).translate(ORNAMENTS)
            self.essays.append({"urduTitle": re.sub(r"\s+", " ", title).strip(), "blocks": [], "sections": 0})
            return
        if not self.essays:
            raise ValueError("text before the first essay heading")
        essay = self.essays[-1]
        if cls == "Heading-2":
            essay["sections"] += 1
            runs = merge([(kind, text.translate(ORNAMENTS)) for kind, text in para["runs"]])
            essay["blocks"].append({"type": "h2", "id": f"section-{essay['sections']}", "runs": runs})
            return
        if cls not in BODY_CLASSES:
            raise ValueError(f"unknown paragraph class {cls!r}")
        runs = merge(para["runs"])
        if not runs:
            return
        if self.table is not None:
            self.table[-1][-1].append(runs)
        else:
            essay["blocks"].append({"type": "p", "runs": runs})

    def end_table(self):
        rows, self.table = self.table, None
        pair = []
        for row in rows:
            if len(row) != 2:
                raise ValueError(f"table row with {len(row)} cells")
            if not row[0] or not row[1]:
                raise ValueError("empty table cell")
            pair.append({"quote": row[0], "rendering": row[1]})
        self.essays[-1]["blocks"].append({"type": "pair", "rows": pair})


def convert(source_html: str, manifest: list[dict]) -> list[dict]:
    parser = ExportParser()
    parser.feed(source_html)
    parser.close()
    essays = [e for e in parser.essays if e["urduTitle"] not in SKIPPED_ESSAYS]
    found = [e["urduTitle"] for e in essays]
    expected = [m["urduTitle"] for m in manifest]
    if found != expected:
        raise ValueError(f"the source's essays and the manifest disagree:\n  source:   {found}\n  manifest: {expected}")
    return [
        {"slug": m["slug"], "urduTitle": m["urduTitle"], "blocks": e["blocks"]}
        for m, e in zip(manifest, essays)
    ]


def main(argv: list[str]) -> None:
    source = Path(argv[1]) if len(argv) > 1 else DEFAULT_SOURCE
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    essays = convert(source.read_text(encoding="utf-8"), manifest)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()
    for essay in essays:
        text = json.dumps(essay, ensure_ascii=False, indent=1) + "\n"
        (OUT_DIR / f"{essay['slug']}.json").write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {len(essays)} essays to {OUT_DIR}")


if __name__ == "__main__":
    main(sys.argv)
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd frontend && python -m unittest discover -s scripts -p "test_*.py"`
Expected: `Ran 9 tests ... OK`.

- [ ] **Step 5: Add the npm scripts**

In `frontend/package.json` `scripts`, after `"fonts:build"`:

```json
    "articles:build": "python scripts/build_nooreimaan_articles.py",
    "articles:test": "python -m unittest discover -s scripts -p \"test_*.py\""
```

- [ ] **Step 6: Generate the essays from the real source**

Run: `cd frontend && npm run articles:build`
Expected: `Wrote 22 essays to ...\backend\src\Ishqnama.Application\Articles\NoorEImaan`. If it raises, the source has a shape the spec did not record: stop and report the message instead of loosening the check.

- [ ] **Step 7: Check the output is deterministic and sane**

Run:
```bash
cd frontend && npm run articles:build && git status --short ../backend/src/Ishqnama.Application/Articles | wc -l
python -c "import json,glob; fs=glob.glob('../backend/src/Ishqnama.Application/Articles/NoorEImaan/*.json'); print(len(fs)); e=json.load(open([f for f in fs if f.endswith('eighteen-ayaat.json')][0],encoding='utf-8')); print(sum(b['type']=='h2' for b in e['blocks']), sum(b['type']=='pair' for b in e['blocks']))"
```
Expected: 22 untracked files the first time; the second run rewrites identical bytes (after `git add`, `git diff --stat` on that folder is empty). `eighteen-ayaat` prints `18 18` (18 subheadings, 18 tables, matching the measurements in the spec).

- [ ] **Step 8: Commit**

```bash
git add frontend/scripts/build_nooreimaan_articles.py frontend/scripts/test_build_nooreimaan_articles.py frontend/package.json backend/src/Ishqnama.Application/Articles
git commit -m "Convert the Noor e Imaan essays from the InDesign export into JSON for the API"
```

---

### Task 3: ArticleService with embedded essays

**Files:**
- Modify: `backend/src/Ishqnama.Application/Ishqnama.Application.csproj`
- Create: `backend/src/Ishqnama.Application/Services/ArticleService.cs`
- Test: `backend/tests/Ishqnama.Application.Tests/ArticleServiceTests.cs`

**Interfaces:**
- Consumes: the 22 JSON files from Task 2.
- Produces: `public sealed class ArticleService` with `public ArticleService()`, `IReadOnlyCollection<string> NoorEImaanSlugs`, `string? GetNoorEImaanEssay(string slug)`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Ishqnama.Application.Tests/ArticleServiceTests.cs`:

```csharp
using System.Text.Json;
using Ishqnama.Application.Services;

namespace Ishqnama.Application.Tests;

public sealed class ArticleServiceTests
{
    private readonly ArticleService _service = new();

    [Fact]
    public void Embeds_all_twenty_two_essays()
        => Assert.Equal(22, _service.NoorEImaanSlugs.Count);

    [Fact]
    public void Returns_an_essay_by_its_slug()
    {
        var json = _service.GetNoorEImaanEssay("naskh");

        Assert.NotNull(json);
        using var doc = JsonDocument.Parse(json!);
        Assert.Equal("naskh", doc.RootElement.GetProperty("slug").GetString());
        Assert.Equal("نسخ", doc.RootElement.GetProperty("urduTitle").GetString());
        Assert.True(doc.RootElement.GetProperty("blocks").GetArrayLength() > 0);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("NASKH")]
    [InlineData("../naskh")]
    [InlineData("")]
    public void Unknown_slugs_are_not_found(string slug)
        => Assert.Null(_service.GetNoorEImaanEssay(slug));
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd backend && dotnet test --filter ArticleServiceTests`
Expected: build error, `ArticleService` not found.

- [ ] **Step 3: Embed the essays**

In `backend/src/Ishqnama.Application/Ishqnama.Application.csproj`, after the `ProjectReference` item group:

```xml
  <ItemGroup>
    <!-- Generated by frontend/scripts/build_nooreimaan_articles.py; embedded so the trimmed publish keeps them -->
    <EmbeddedResource Include="Articles\NoorEImaan\*.json" LogicalName="Articles/NoorEImaan/%(Filename)%(Extension)" />
  </ItemGroup>
```

- [ ] **Step 4: Write the service**

`backend/src/Ishqnama.Application/Services/ArticleService.cs`:

```csharp
using System.Text.Json;

namespace Ishqnama.Application.Services;

/// <summary>
/// The Noor e Imaan essays, embedded in this assembly as JSON by
/// <c>frontend/scripts/build_nooreimaan_articles.py</c>. Each is served verbatim, so the block
/// shape belongs to the converter and the frontend's <c>src/types/articles.ts</c>, not to C# types.
/// </summary>
public sealed class ArticleService
{
    private const string Prefix = "Articles/NoorEImaan/";
    private const string Suffix = ".json";

    private readonly Dictionary<string, string> _essays = new(StringComparer.Ordinal);

    public ArticleService()
    {
        var assembly = typeof(ArticleService).Assembly;
        foreach (var name in assembly.GetManifestResourceNames())
        {
            if (!name.StartsWith(Prefix, StringComparison.Ordinal) || !name.EndsWith(Suffix, StringComparison.Ordinal))
                continue;

            var slug = name[Prefix.Length..^Suffix.Length];
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var reader = new StreamReader(stream);
            var json = reader.ReadToEnd();

            using var doc = JsonDocument.Parse(json);
            var declared = doc.RootElement.GetProperty("slug").GetString();
            if (declared != slug)
                throw new InvalidOperationException($"Essay resource '{name}' declares slug '{declared}'.");

            _essays[slug] = json;
        }
    }

    public IReadOnlyCollection<string> NoorEImaanSlugs => _essays.Keys;

    /// <summary>The essay's JSON, or null when no essay has that slug.</summary>
    public string? GetNoorEImaanEssay(string slug) => _essays.GetValueOrDefault(slug);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd backend && dotnet test --filter ArticleServiceTests`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/Ishqnama.Application/Ishqnama.Application.csproj backend/src/Ishqnama.Application/Services/ArticleService.cs backend/tests/Ishqnama.Application.Tests/ArticleServiceTests.cs
git commit -m "Embed the Noor e Imaan essays in the Application layer"
```

---

### Task 4: The authenticated endpoint and its cache policy

**Files:**
- Create: `backend/src/Ishqnama.Api/Endpoints/ArticleEndpoints.cs`
- Modify: `backend/src/Ishqnama.Api/Program.cs` (service registration near line 62, mapping near line 201)
- Modify: `backend/src/Ishqnama.Api/Middleware/CacheHeaderMiddleware.cs`
- Modify: `backend/CLAUDE.md`

**Interfaces:**
- Consumes: `ArticleService` (Task 3).
- Produces: `GET /api/articles/nooreimaan/{slug}`: 200 `application/json; charset=utf-8` with an `EssayDto` body, 404 unknown slug, 401 without a valid token; headers `Cache-Control: private, no-cache`, `ETag: "v2-<version>-a"`, `Vary: Authorization`.

- [ ] **Step 1: Write the endpoint**

`backend/src/Ishqnama.Api/Endpoints/ArticleEndpoints.cs`:

```csharp
using System.Text;
using Ishqnama.Application.Services;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Ishqnama.Api.Endpoints;

internal static class ArticleEndpoints
{
    public static RouteGroupBuilder MapArticleEndpoints(this RouteGroupBuilder api)
    {
        // Signed-in readers only: the essays are not in the static site, so this is the only way to read them.
        api.MapGet("/articles/nooreimaan/{slug}", GetNoorEImaanEssay).RequireAuthorization().WithTags("Articles");
        return api;
    }

    private static Results<ContentHttpResult, NotFound> GetNoorEImaanEssay(string slug, ArticleService articles)
    {
        var json = articles.GetNoorEImaanEssay(slug);
        return json is null
            ? TypedResults.NotFound()
            : TypedResults.Text(json, "application/json", Encoding.UTF8);
    }
}
```

- [ ] **Step 2: Register and map it**

In `backend/src/Ishqnama.Api/Program.cs`, after `builder.Services.AddScoped<VerseListService>();`:

```csharp
builder.Services.AddSingleton<ArticleService>();
```

and after `api.MapVerseListEndpoints();`:

```csharp
api.MapArticleEndpoints();
```

- [ ] **Step 3: Give `/api/articles` its own cache policy**

Replace the body of `backend/src/Ishqnama.Api/Middleware/CacheHeaderMiddleware.cs` with:

```csharp
using System.Reflection;
using Ishqnama.Api.Helpers;

namespace Ishqnama.Api.Middleware;

/// <summary>
/// Caching for the read-only routes: assembly-version ETag, <c>Vary: Authorization</c> (tafseer is
/// stripped for anonymous callers, so the two audiences must never share a cache entry) and a 304
/// short-circuit on <c>If-None-Match</c>. The Quran routes are long-lived and immutable. The
/// members-only essays are <c>private, no-cache</c>: only the reader's browser keeps them, and it
/// rechecks each visit, so a corrected essay arrives with the next deploy (the ETag changes with the
/// version, the only way their embedded text can change). This runs after UseAuthorization(), so a
/// request without a valid token gets 401 before the 304 short-circuit can answer it.
/// User-data routes, published verse lists (edited live by their owners) and health probes are
/// excluded.
/// </summary>
public sealed class CacheHeaderMiddleware(RequestDelegate next)
{
    private const string QuranCacheControl = "public, max-age=2592000, immutable";
    private const string MembersCacheControl = "private, no-cache";

    private static readonly string BaseVersion =
        typeof(CacheHeaderMiddleware).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? "0";

    private static readonly string AuthenticatedEtag = $"\"v2-{BaseVersion}-a\"";
    private static readonly string UnauthenticatedEtag = $"\"v2-{BaseVersion}-u\"";

    /// <summary>The Cache-Control for a request path, or null for routes this middleware leaves alone.</summary>
    internal static string? CacheControlFor(PathString path)
    {
        if (!path.StartsWithSegments("/api")
            || path.StartsWithSegments("/api/user")
            || path.StartsWithSegments("/api/lists")
            || path.StartsWithSegments("/api/healthz"))
            return null;

        return path.StartsWithSegments("/api/articles") ? MembersCacheControl : QuranCacheControl;
    }

    public Task InvokeAsync(HttpContext context)
    {
        var cacheControl = CacheControlFor(context.Request.Path);
        if (cacheControl is null)
            return next(context);

        var etag = context.User.IsAuthenticated() ? AuthenticatedEtag : UnauthenticatedEtag;

        // Short-circuit: return 304 if the ETag matches (skip endpoint execution)
        if (context.Request.Headers.IfNoneMatch.ToString() == etag)
        {
            context.Response.StatusCode = StatusCodes.Status304NotModified;
            ApplyHeaders(context.Response, etag, cacheControl);
            return Task.CompletedTask;
        }

        // Headers must be set before the endpoint starts writing the body. Server errors are
        // skipped so a failure is never cached.
        context.Response.OnStarting(static state =>
        {
            var (response, tag, control) = ((HttpResponse, string, string))state;
            if (response.StatusCode < StatusCodes.Status500InternalServerError)
                ApplyHeaders(response, tag, control);
            return Task.CompletedTask;
        }, (context.Response, etag, cacheControl));

        return next(context);
    }

    private static void ApplyHeaders(HttpResponse response, string etag, string cacheControl)
    {
        response.Headers.CacheControl = cacheControl;
        response.Headers.ETag = etag;
        response.Headers.Vary = "Authorization";
    }
}
```

- [ ] **Step 4: Build and run the backend tests**

Run: `cd backend && dotnet build && dotnet test`
Expected: build succeeds with no new trim warnings; all tests pass.

- [ ] **Step 5: Check the route without a token**

Run: `cd backend && docker-compose up -d`, wait for `curl -s http://localhost:5081/api/healthz` to answer, then:

```bash
curl -si http://localhost:5081/api/articles/nooreimaan/naskh | head -1
ETAG=$(curl -si http://localhost:5081/api/chapters/1 | grep -i '^etag' | cut -d' ' -f2 | tr -d '\r')
curl -si -H "If-None-Match: ${ETAG/-u/-a}" http://localhost:5081/api/articles/nooreimaan/naskh | head -1
curl -si http://localhost:5081/api/chapters/1 | grep -i cache-control
```

Expected: `401` for both article requests (the second sends the authenticated ETag a cached reader would hold); the chapter route still shows `public, max-age=2592000, immutable`. The signed-in 200 / 304 checks run in Task 10 through the browser, which holds a real token.

- [ ] **Step 6: Document it in `backend/CLAUDE.md`**

Add the route to the endpoint list (beside search, marked API only, signed-in), and a paragraph: the essays are embedded JSON in `Ishqnama.Application/Articles/NoorEImaan/`, generated by `frontend/scripts/build_nooreimaan_articles.py` (`npm run articles:build`), loaded by the singleton `ArticleService` and served verbatim; `CacheHeaderMiddleware.CacheControlFor` gives `/api/articles` `private, no-cache` with the version ETag, and why.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "Serve the Noor e Imaan essays to signed-in readers with a private, revalidated cache"
```

---

### Task 5: Fetching an essay

**Files:**
- Create: `frontend/src/lib/articles-api.ts`
- Create: `frontend/src/hooks/use-essay.ts`
- Test: `frontend/src/hooks/__tests__/use-essay.test.ts`

**Interfaces:**
- Consumes: `authenticatedApiFetch` (`src/lib/api-client.ts`), `onReady` (`src/lib/api-readiness.ts`), `EssayDto` (Task 1).
- Produces: `getNoorEImaanEssay(slug: string, signal?: AbortSignal): Promise<EssayDto>`; `useEssay(slug: string): { essay: EssayDto | null; failed: boolean; retry: () => void }`; `clearEssayCache(): void` (tests).

- [ ] **Step 1: Write the failing test**

`frontend/src/hooks/__tests__/use-essay.test.ts`:

```ts
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEssayCache, useEssay } from "@/hooks/use-essay";
import { getNoorEImaanEssay } from "@/lib/articles-api";
import type { EssayDto } from "@/types/articles";

vi.mock("@/lib/articles-api", () => ({ getNoorEImaanEssay: vi.fn() }));
const ready = vi.hoisted(() => ({ callbacks: [] as (() => void)[] }));
vi.mock("@/lib/api-readiness", () => ({
  onReady: (cb: () => void) => {
    ready.callbacks.push(cb);
    return () => {
      ready.callbacks = ready.callbacks.filter((c) => c !== cb);
    };
  },
}));

const mockedGet = vi.mocked(getNoorEImaanEssay);
const essay = (slug: string): EssayDto => ({ slug, urduTitle: slug, blocks: [] });

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useEssay", () => {
  beforeEach(() => {
    ready.callbacks = [];
    clearEssayCache();
    mockedGet.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads the essay", async () => {
    mockedGet.mockResolvedValue(essay("naskh"));
    const { result } = renderHook(() => useEssay("naskh"));
    expect(result.current.essay).toBeNull();
    await flush();
    expect(result.current).toMatchObject({ essay: essay("naskh"), failed: false });
  });

  it("never shows the previous essay while the next one loads", async () => {
    mockedGet.mockResolvedValueOnce(essay("naskh"));
    const { result, rerender } = renderHook(({ slug }) => useEssay(slug), { initialProps: { slug: "naskh" } });
    await flush();
    mockedGet.mockReturnValueOnce(new Promise(() => {}));
    rerender({ slug: "hazf" });
    expect(result.current.essay).toBeNull();
  });

  it("retries on the next ready transition after a failure, without caching the failure", async () => {
    mockedGet.mockRejectedValueOnce(new Error("cold")).mockResolvedValueOnce(essay("naskh"));
    const { result } = renderHook(() => useEssay("naskh"));
    await flush();
    expect(result.current.failed).toBe(true);
    expect(ready.callbacks).toHaveLength(1);
    act(() => ready.callbacks[0]());
    await flush();
    expect(result.current).toMatchObject({ essay: essay("naskh"), failed: false });
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it("retries on demand when the failure came while already ready", async () => {
    mockedGet.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(essay("naskh"));
    const { result } = renderHook(() => useEssay("naskh"));
    await flush();
    act(() => result.current.retry());
    await flush();
    expect(result.current.essay).toEqual(essay("naskh"));
  });

  it("shares one request for the visit", async () => {
    mockedGet.mockResolvedValue(essay("naskh"));
    renderHook(() => useEssay("naskh"));
    renderHook(() => useEssay("naskh"));
    await flush();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && npx vitest run src/hooks/__tests__/use-essay.test.ts`
Expected: FAIL, cannot resolve `@/hooks/use-essay`.

- [ ] **Step 3: Write the API call and the hook**

`frontend/src/lib/articles-api.ts`:

```ts
import { authenticatedApiFetch } from "./api-client";
import type { EssayDto } from "@/types/articles";

/** One Noor e Imaan essay. Signed-in readers only, so the text never ships in the static pages. */
export function getNoorEImaanEssay(slug: string, signal?: AbortSignal): Promise<EssayDto> {
  return authenticatedApiFetch<EssayDto>(`/articles/nooreimaan/${encodeURIComponent(slug)}`, { signal });
}
```

`frontend/src/hooks/use-essay.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { onReady } from "@/lib/api-readiness";
import { getNoorEImaanEssay } from "@/lib/articles-api";
import type { EssayDto } from "@/types/articles";

/**
 * Essays kept for the visit, so going back to one shows it at once. The browser also keeps the
 * response (private, revalidated each visit with a 304 when unchanged).
 */
const cache = new Map<string, Promise<EssayDto>>();

function load(slug: string): Promise<EssayDto> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = getNoorEImaanEssay(slug);
    // A failed request must not stay cached, or a cold start would break the essay for the visit
    pending.catch(() => cache.delete(slug));
    cache.set(slug, pending);
  }
  return pending;
}

export interface EssayState {
  essay: EssayDto | null;
  failed: boolean;
  /** Tries again now; for a failure while the API was already ready, when onReady never fires. */
  retry: () => void;
}

/** The essay at `slug`; retries on the next ready transition after a failure. */
export function useEssay(slug: string): EssayState {
  const [state, setState] = useState<{ essay: EssayDto | null; failed: boolean }>({ essay: null, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let unregister: (() => void) | null = null;
    setState({ essay: null, failed: false });

    const run = () => {
      load(slug).then(
        (essay) => {
          if (!cancelled) setState({ essay, failed: false });
        },
        () => {
          if (cancelled) return;
          setState({ essay: null, failed: true });
          unregister = onReady(() => {
            unregister = null;
            run();
          });
        },
      );
    };
    run();

    return () => {
      cancelled = true;
      unregister?.();
    };
  }, [slug, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/** For tests. */
export function clearEssayCache() {
  cache.clear();
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `cd frontend && npx vitest run src/hooks/__tests__/use-essay.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/articles-api.ts frontend/src/hooks/use-essay.ts frontend/src/hooks/__tests__/use-essay.test.ts
git commit -m "Fetch Noor e Imaan essays for signed-in readers"
```

---

### Task 6: Rendering an essay

Follow the frontend-design skill for this task's visual work: the facing quotation is the page's one bold element; everything else stays quiet. Take screenshots in Task 10 and adjust spacing there.

**Files:**
- Create: `frontend/src/components/articles/essay-body.tsx`
- Create: `frontend/src/components/articles/essay-body.module.css`
- Test: `frontend/src/components/articles/__tests__/essay-body.test.tsx`

**Interfaces:**
- Consumes: `Block`, `Run`, `PairRow`, `RunKind` (Task 1).
- Produces: `default function EssayBody({ blocks }: { blocks: Block[] })`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/articles/__tests__/essay-body.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EssayBody from "@/components/articles/essay-body";
import type { Block } from "@/types/articles";

const BLOCKS: Block[] = [
  { type: "h2", id: "section-1", runs: [{ kind: "urdu", text: "پہلی آیت" }] },
  {
    type: "p",
    runs: [
      { kind: "urdu", text: "قرآن میں " },
      { kind: "quran", text: "إِنَّمَا" },
      { kind: "arabic", text: "الفوز الکبیر" },
      { kind: "farsi", text: "فارسی" },
      { kind: "english", text: "Al-Fauz, p. 4" },
    ],
  },
  {
    type: "pair",
    rows: [
      {
        quote: [[{ kind: "arabic", text: "ولم يراع" }]],
        rendering: [[{ kind: "urdu", text: "اور" }], [{ kind: "urdu", text: "دوسرا" }]],
      },
    ],
  },
];

describe("EssayBody", () => {
  afterEach(cleanup);

  it("sets the essay as right-to-left Urdu", () => {
    const { container } = render(<EssayBody blocks={BLOCKS} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute("lang")).toBe("ur");
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("marks each run's language, and keeps English left-to-right", () => {
    render(<EssayBody blocks={BLOCKS} />);
    const quran = screen.getByText("إِنَّمَا");
    expect(quran.getAttribute("lang")).toBe("ar");
    expect(quran.dataset.kind).toBe("quran");
    expect(screen.getByText("الفوز الکبیر").dataset.kind).toBe("arabic");
    expect(screen.getByText("فارسی").getAttribute("lang")).toBe("fa");
    const english = screen.getByText("Al-Fauz, p. 4");
    expect(english.getAttribute("lang")).toBe("en");
    expect(english.getAttribute("dir")).toBe("ltr");
  });

  it("gives subheadings their ids and lists them in a contents nav", () => {
    render(<EssayBody blocks={BLOCKS} />);
    expect(screen.getByRole("heading", { level: 2, name: "پہلی آیت" }).id).toBe("section-1");
    const link = screen.getByRole("link", { name: "پہلی آیت" });
    expect(link.getAttribute("href")).toBe("#section-1");
  });

  it("has no contents nav for an essay without subheadings", () => {
    render(<EssayBody blocks={BLOCKS.slice(1)} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("sets a table row as a figure: the quotation, then its rendering paragraph by paragraph", () => {
    const { container } = render(<EssayBody blocks={BLOCKS} />);
    const figure = container.querySelector("figure")!;
    expect(figure.querySelector("blockquote")?.textContent).toBe("ولم يراع");
    const rendering = figure.querySelectorAll("blockquote + div p");
    expect(Array.from(rendering, (p) => p.textContent)).toEqual(["اور", "دوسرا"]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd frontend && npx vitest run src/components/articles`
Expected: FAIL, cannot resolve `@/components/articles/essay-body`.

- [ ] **Step 3: Write the component**

`frontend/src/components/articles/essay-body.tsx`:

```tsx
import { Fragment } from "react";
import type { Block, PairRow, Run, RunKind } from "@/types/articles";
import styles from "./essay-body.module.css";

const LANG: Record<RunKind, string> = { urdu: "ur", quran: "ar", arabic: "ar", farsi: "fa", english: "en" };

/** Urdu runs are plain text in the Urdu essay; every other run marks its language and face. */
function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.kind === "urdu" ? (
          <Fragment key={i}>{run.text}</Fragment>
        ) : (
          <span
            key={i}
            lang={LANG[run.kind]}
            // A dir attribute isolates the run, so English punctuation keeps its place in RTL text
            dir={run.kind === "english" ? "ltr" : undefined}
            data-kind={run.kind}
            className={styles[run.kind]}
          >
            {run.text}
          </span>
        ),
      )}
    </>
  );
}

function Paragraphs({ paragraphs }: { paragraphs: Run[][] }) {
  return (
    <>
      {paragraphs.map((runs, i) => (
        <p key={i}>
          <Runs runs={runs} />
        </p>
      ))}
    </>
  );
}

/** The book's two-column translation table: the quotation on the right, its Urdu rendering on the left. */
function Pair({ rows }: { rows: PairRow[] }) {
  return (
    <figure className={styles.pair}>
      {rows.map((row, i) => (
        <div key={i} className={styles.pairRow}>
          <blockquote className={styles.quote}>
            <Paragraphs paragraphs={row.quote} />
          </blockquote>
          <div className={styles.rendering}>
            <Paragraphs paragraphs={row.rendering} />
          </div>
        </div>
      ))}
    </figure>
  );
}

export default function EssayBody({ blocks }: { blocks: Block[] }) {
  const sections = blocks.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");

  return (
    <div className={styles.body} lang="ur" dir="rtl">
      {sections.length > 0 && (
        <nav className={styles.contents} aria-label="Contents">
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <Runs runs={s.runs} />
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className={styles.paragraph}>
                <Runs runs={block.runs} />
              </p>
            );
          case "h2":
            return (
              <h2 key={i} id={block.id} className={styles.heading}>
                <Runs runs={block.runs} />
              </h2>
            );
          case "pair":
            return <Pair key={i} rows={block.rows} />;
        }
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write the styles**

`frontend/src/components/articles/essay-body.module.css`:

```css
/* The essay is RTL, so logical properties throughout: "inline-start" is the right-hand edge. */
.body {
  font-family: var(--font-urdu);
  font-size: var(--text-urdu);
  line-height: var(--leading-urdu);
  color: var(--text-primary);
  overflow-wrap: break-word;
}

/* Justified with the last line to the right, as the book sets its paragraphs. */
.paragraph {
  margin: 0 0 var(--space-4);
  text-align: justify;
  text-align-last: right;
}

.heading {
  font-family: var(--font-urdu);
  font-size: var(--text-2xl);
  font-weight: normal;
  line-height: var(--leading-urdu);
  color: var(--gold-label);
  margin: var(--space-10) 0 var(--space-3);
  padding-block-end: var(--space-1);
  border-block-end: 1px solid var(--gold);
  /* Clear of the sticky app bar when a contents link jumps here */
  scroll-margin-top: var(--space-20);
}

/* Quran quotations in the mushaf face and teal, so scripture reads apart from the prose at a glance. */
.quran {
  font-family: var(--font-arabic);
  color: var(--teal-primary);
}

/* Other Arabic (hadith, the scholars quoted) in Naskh, in the prose colour. */
.arabic {
  font-family: 'Nafees Web Naskh', 'Traditional Arabic', serif;
}

.english {
  font-family: var(--font-display);
  font-size: 0.8em;
}

.contents {
  margin: 0 0 var(--space-8);
  padding: var(--space-3) 0;
  border-block: 1px solid var(--tint-ink-10);
  font-size: var(--text-lg);
  line-height: 2;
}

.contents ol {
  list-style: none;
  margin: 0;
  padding: 0;
  columns: 2;
  column-gap: var(--space-8);
}

.contents a {
  color: var(--teal-primary);
  text-decoration: none;
}

.contents a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* The facing quotation: the book's translation table, on the card surface with one gold edge
   on the quotation's side, the two halves divided by a gold hairline. */
.pair {
  margin: var(--space-6) 0;
  padding: var(--space-1) var(--space-5);
  background: var(--surface-card);
  border-inline-start: 3px solid var(--gold);
}

.pairRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  column-gap: var(--space-6);
  padding-block: var(--space-3);
}

.pairRow + .pairRow {
  border-block-start: 1px solid var(--tint-ink-10);
}

.quote {
  margin: 0;
  padding-inline-end: var(--space-6);
  border-inline-end: 1px solid var(--gold);
}

.rendering {
  font-size: 0.92em;
}

.quote p,
.rendering p {
  margin: 0;
  text-align: justify;
  text-align-last: right;
}

.quote p + p,
.rendering p + p {
  margin-block-start: var(--space-2);
}

@media (max-width: 600px) {
  .body {
    font-size: 1.1875rem; /* 19px */
  }

  .heading {
    font-size: var(--text-xl);
  }

  .contents ol {
    columns: 1;
  }

  .pair {
    padding-inline: var(--space-4);
  }

  /* Stacked: the quotation above its rendering, divided by a short centred gold rule. */
  .pairRow {
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--space-3);
  }

  .quote {
    position: relative;
    padding-inline-end: 0;
    padding-block-end: var(--space-3);
    border-inline-end: none;
  }

  .quote::after {
    content: "";
    position: absolute;
    inset-block-end: 0;
    inset-inline-start: 50%;
    width: var(--space-12);
    margin-inline-start: calc(var(--space-12) / -2);
    border-block-end: 1px solid var(--gold);
  }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd frontend && npx vitest run src/components/articles src/app/__tests__`
Expected: PASS, including `no-hardcoded-colours` and `theme-tokens` with the new module.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/articles
git commit -m "Render Noor e Imaan essays with the book's facing quotations"
```

---

### Task 7: The gate and the loading states

**Files:**
- Modify: `frontend/src/config/sign-in-copy.ts`
- Modify: `frontend/src/config/__tests__/sign-in-copy.test.ts`
- Modify: `frontend/src/config/readiness-copy.ts`
- Create: `frontend/src/components/articles/essay-content.tsx`
- Create: `frontend/src/components/articles/essay-content.module.css`
- Create: `frontend/src/components/articles/essay-gate.tsx`
- Test: `frontend/src/components/articles/__tests__/essay-content.test.tsx`
- Test: `frontend/src/components/articles/__tests__/essay-gate.test.tsx`

**Interfaces:**
- Consumes: `useEssay` (Task 5), `EssayBody` (Task 6), `useApiReadiness` (`src/lib/api-readiness.ts`), `useSignInPrompt` (`src/context/sign-in-prompt-context.tsx`), `ProtectedRoute`, `AuthLoading`, `EmptyState`.
- Produces: `SignInFeature` gains `"articles"`; `ESSAY_LOADING_MESSAGE`, `ESSAY_FAILED_MESSAGE`; `default function EssayContent({ slug }: { slug: string })`; `default function EssayGate({ slug }: { slug: string })`. Uses icon name `"article"` (added in Task 9; until then `Icon` renders nothing for it, which the tests do not depend on).

- [ ] **Step 1: Add the copy, and extend the copy test first**

In `frontend/src/config/__tests__/sign-in-copy.test.ts`, add `"articles"` to the feature list in "covers every feature with a title and a body":

```ts
    for (const feature of ["settings", "saved", "bookmark", "search", "lists", "favorites", "articles"] as const) {
```

Run: `cd frontend && npx vitest run src/config/__tests__/sign-in-copy.test.ts`
Expected: FAIL (TypeScript or `undefined.title`).

In `frontend/src/config/sign-in-copy.ts`:

```ts
export type SignInFeature = "settings" | "saved" | "bookmark" | "search" | "lists" | "favorites" | "articles";
```

and in `SIGN_IN_COPY`, after `favorites`:

```ts
  articles: {
    title: "Sign in to read the articles",
    body: "The essays of Noor e Imaan are for signed-in readers.",
  },
```

In `frontend/src/config/readiness-copy.ts`, append:

```ts
export const ESSAY_LOADING_MESSAGE = "Opening the essay";
export const ESSAY_FAILED_MESSAGE = "Couldn't open this essay yet";
```

Run: `cd frontend && npx vitest run src/config`
Expected: PASS.

- [ ] **Step 2: Write the failing component tests**

`frontend/src/components/articles/__tests__/essay-content.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EssayContent from "@/components/articles/essay-content";
import { ESSAY_FAILED_MESSAGE, ESSAY_LOADING_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";

const state = vi.hoisted(() => ({
  essay: null as null | { slug: string; urduTitle: string; blocks: unknown[] },
  failed: false,
  retry: vi.fn(),
  readiness: "ready",
}));
vi.mock("@/hooks/use-essay", () => ({
  useEssay: () => ({ essay: state.essay, failed: state.failed, retry: state.retry }),
}));
vi.mock("@/lib/api-readiness", () => ({ useApiReadiness: () => state.readiness }));

describe("EssayContent", () => {
  beforeEach(() => {
    state.essay = null;
    state.failed = false;
    state.readiness = "ready";
  });
  afterEach(cleanup);

  it("says the essay is opening while it loads", () => {
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText(ESSAY_LOADING_MESSAGE)).toBeTruthy();
  });

  it("explains the wait during a cold start, even after a failed attempt", () => {
    state.readiness = "warming";
    state.failed = true;
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers to try again after a failure while ready", () => {
    state.failed = true;
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText(ESSAY_FAILED_MESSAGE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.retry).toHaveBeenCalled();
  });

  it("shows the essay once it arrives", () => {
    state.essay = { slug: "naskh", urduTitle: "نسخ", blocks: [{ type: "p", runs: [{ kind: "urdu", text: "متن" }] }] };
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText("متن")).toBeTruthy();
  });
});
```

`frontend/src/components/articles/__tests__/essay-gate.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EssayGate from "@/components/articles/essay-gate";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";

const msal = vi.hoisted(() => ({ authed: false, inProgress: "none" }));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: msal.inProgress }),
}));
vi.mock("@azure/msal-browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@azure/msal-browser")>()),
  InteractionStatus: { None: "none" },
}));
vi.mock("@/components/protected-route", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="protected">{children}</div>,
}));
vi.mock("@/components/articles/essay-content", () => ({
  default: ({ slug }: { slug: string }) => <p>essay {slug}</p>,
}));

function renderGate() {
  return render(
    <SignInPromptProvider>
      <EssayGate slug="naskh" />
    </SignInPromptProvider>,
  );
}

describe("EssayGate", () => {
  beforeEach(() => {
    msal.authed = false;
    msal.inProgress = "none";
  });
  afterEach(cleanup);

  it("waits for sign-in to settle before deciding", () => {
    msal.inProgress = "startup";
    renderGate();
    expect(screen.getByText("One moment")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("essay naskh")).toBeNull();
  });

  it("prompts an anonymous reader once and never fetches the essay", () => {
    renderGate();
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.articles.title })).toBeTruthy();
    expect(screen.queryByTestId("protected")).toBeNull();
    expect(screen.queryByText("essay naskh")).toBeNull();
  });

  it("lets the inline message reopen the prompt", () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.articles.title })).toBeTruthy();
  });

  it("shows a signed-in reader the essay inside ProtectedRoute", () => {
    msal.authed = true;
    renderGate();
    expect(screen.getByTestId("protected").textContent).toBe("essay naskh");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

Run: `cd frontend && npx vitest run src/components/articles`
Expected: FAIL, cannot resolve `essay-content` / `essay-gate`.

- [ ] **Step 3: Write EssayContent**

`frontend/src/components/articles/essay-content.tsx`:

```tsx
"use client";

import EssayBody from "@/components/articles/essay-body";
import {
  ESSAY_FAILED_MESSAGE,
  ESSAY_LOADING_MESSAGE,
  TRY_AGAIN_LABEL,
  UNREACHABLE_MESSAGE,
  WARMING_MESSAGE,
} from "@/config/readiness-copy";
import { useEssay } from "@/hooks/use-essay";
import { useApiReadiness } from "@/lib/api-readiness";
import styles from "./essay-content.module.css";

/** Fetches and shows one essay, with the reader's cold-start placeholder while it waits. */
export default function EssayContent({ slug }: { slug: string }) {
  const { essay, failed, retry } = useEssay(slug);
  const readiness = useApiReadiness();

  if (essay) return <EssayBody blocks={essay.blocks} />;

  // While warming or unreachable the hook retries on its own once the API is ready
  if (readiness === "warming" || readiness === "unreachable" || !failed) {
    const message =
      readiness === "warming" ? WARMING_MESSAGE : readiness === "unreachable" ? UNREACHABLE_MESSAGE : ESSAY_LOADING_MESSAGE;
    return (
      <div className={styles.placeholder}>
        <div className={styles.spinner} />
        <p className={styles.placeholderText}>{message}</p>
      </div>
    );
  }

  return (
    <div className={styles.placeholder}>
      <p className={styles.placeholderText}>{ESSAY_FAILED_MESSAGE}</p>
      <button type="button" className={styles.retryButton} onClick={retry}>
        {TRY_AGAIN_LABEL}
      </button>
    </div>
  );
}
```

`frontend/src/components/articles/essay-content.module.css` (the reader's placeholder from `quran-reader-client.module.css`):

```css
.placeholder {
  padding: var(--space-16) 0;
  text-align: center;
}

.placeholderText {
  color: var(--text-tertiary);
  font-size: var(--text-base);
  margin-bottom: var(--space-4);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--tint-teal-10);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--space-4);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2.4s;
  }
}

.retryButton {
  background: var(--fill-primary);
  color: var(--text-on-dark);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-6);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}

.retryButton:hover {
  background: var(--fill-primary-hover);
}
```

- [ ] **Step 4: Write EssayGate**

`frontend/src/components/articles/essay-gate.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import AuthLoading from "@/components/auth-loading";
import EmptyState from "@/components/empty-state";
import ProtectedRoute from "@/components/protected-route";
import EssayContent from "@/components/articles/essay-content";
import { SIGN_IN_COPY, SIGN_IN_LABEL } from "@/config/sign-in-copy";
import { useSignInPrompt } from "@/context/sign-in-prompt-context";

/**
 * The essay's text, for signed-in readers only. Same settle-then-gate order as LibraryGate, which
 * explains why ProtectedRoute must not mount before auth has settled. The page around it (title,
 * neighbours) is static and shown to everyone.
 */
export default function EssayGate({ slug }: { slug: string }) {
  const isAuthenticated = useIsAuthenticated();
  const { authSettled, promptSignIn } = useSignInPrompt();
  const anonymous = authSettled && !isAuthenticated;
  const prompted = useRef(false);

  useEffect(() => {
    if (!anonymous || prompted.current) return;
    prompted.current = true;
    promptSignIn("articles");
  }, [anonymous, promptSignIn]);

  if (!authSettled) return <AuthLoading />;

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon="article"
        title={SIGN_IN_COPY.articles.title}
        body={SIGN_IN_COPY.articles.body}
        action={{ label: SIGN_IN_LABEL, onClick: () => promptSignIn("articles") }}
      />
    );
  }

  return (
    <ProtectedRoute>
      <EssayContent slug={slug} />
    </ProtectedRoute>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd frontend && npx vitest run src/components/articles src/config src/app/__tests__`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/config frontend/src/components/articles
git commit -m "Gate the essays behind the sign-in prompt with the cold-start placeholder"
```

---

### Task 8: The index and essay pages

Follow the frontend-design skill for this task's visual work.

**Files:**
- Create: `frontend/src/app/articles/page.tsx`
- Create: `frontend/src/app/articles/articles.module.css`
- Create: `frontend/src/app/articles/nooreimaan/[slug]/page.tsx`
- Create: `frontend/src/app/articles/nooreimaan/[slug]/essay.module.css`
- Modify: `frontend/public/staticwebapp.config.json`
- Test: `frontend/src/app/articles/__tests__/articles-pages.test.tsx`

**Interfaces:**
- Consumes: Task 1 manifest helpers, `EssayGate` (Task 7), `pageMetadata` (`src/lib/page-metadata.ts`), `KHATM_DUA_TITLE` (`src/data/khatm-dua.ts`).
- Produces: routes `/articles/` and `/articles/nooreimaan/<slug>/` (22).

- [ ] **Step 1: Write the failing test**

`frontend/src/app/articles/__tests__/articles-pages.test.tsx`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArticlesPage from "@/app/articles/page";
import EssayPage, { generateMetadata, generateStaticParams } from "@/app/articles/nooreimaan/[slug]/page";

vi.mock("@/components/articles/essay-gate", () => ({
  default: ({ slug }: { slug: string }) => <p>gate {slug}</p>,
}));

describe("articles pages", () => {
  afterEach(cleanup);

  it("lists every essay in book order, then the dua on its own page", () => {
    render(<ArticlesPage />);
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links).toHaveLength(23);
    expect(links[0].getAttribute("href")).toBe("/articles/nooreimaan/is-the-quran-connected/");
    expect(links[22].getAttribute("href")).toBe("/nooreimaan/dua/");
  });

  it("prerenders one page per essay", () => {
    expect(generateStaticParams()).toHaveLength(22);
  });

  it("titles an essay in English for link previews", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "naskh" }) });
    expect(metadata.title).toEqual({ absolute: "Naskh (abrogation) | Ishqnama" });
  });

  it("shows the titles and neighbours to everyone and leaves the text to the gate", async () => {
    render(await EssayPage({ params: Promise.resolve({ slug: "harf-e-zaid" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("حرف زائد");
    expect(screen.getByText("gate harf-e-zaid")).toBeTruthy();
    expect(screen.getByRole("link", { name: /نسخ/ }).getAttribute("href")).toBe("/articles/nooreimaan/naskh/");
    expect(screen.getByRole("link", { name: /استثناء منقطع/ }).getAttribute("href")).toBe(
      "/articles/nooreimaan/istisna-munqati/",
    );
    expect(screen.getByRole("link", { name: "All articles" }).getAttribute("href")).toBe("/articles/");
  });
});
```

The test files are type-checked by `npm run build` (`tsconfig.json` includes `**/*.tsx`), so keep them type-correct.

Run: `cd frontend && npx vitest run src/app/articles`
Expected: FAIL, cannot resolve `@/app/articles/page`.

- [ ] **Step 2: Write the index page**

`frontend/src/app/articles/page.tsx`:

```tsx
import Link from "next/link";
import { NOOR_E_IMAAN_ESSAYS, essayPath } from "@/data/articles/nooreimaan";
import { KHATM_DUA_TITLE } from "@/data/khatm-dua";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./articles.module.css";

export const metadata = pageMetadata({
  title: "Articles",
  description: "Essays from Noor e Imaan on the Quran and the Mahdavi faith.",
  path: "/articles/",
});

/** One row: the English title on the left, the Urdu on the right, the whole row one link. */
function EssayRow({ href, title, urduTitle, urduLang = "ur" }: { href: string; title: string; urduTitle: string; urduLang?: string }) {
  return (
    <Link href={href} className={styles.row}>
      <span className={styles.english}>{title}</span>
      <span className={styles.urdu} lang={urduLang} dir="rtl">
        {urduTitle}
      </span>
    </Link>
  );
}

export default function ArticlesPage() {
  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <h1 className={styles.title}>Articles</h1>
        <p className={styles.subtitle}>Essays from Noor e Imaan</p>
      </header>

      {/* One section per source; later sources append below. */}
      <section aria-labelledby="nooreimaan">
        <h2 id="nooreimaan" className={styles.source}>
          Noor e Imaan
        </h2>
        <ul className={styles.list}>
          {NOOR_E_IMAAN_ESSAYS.map((essay) => (
            <li key={essay.slug}>
              <EssayRow href={essayPath(essay.slug)} title={essay.title} urduTitle={essay.urduTitle} />
            </li>
          ))}
          {/* The book closes with the dua, which has its own page */}
          <li>
            <EssayRow href="/nooreimaan/dua/" title="Dua for completing the Quran" urduTitle={KHATM_DUA_TITLE} urduLang="ar" />
          </li>
        </ul>
      </section>
    </main>
  );
}
```

`frontend/src/app/articles/articles.module.css`:

```css
.main {
  max-width: var(--max-width-reader);
  margin: 0 auto;
  padding: var(--space-12) var(--space-6) var(--space-20);
}

.head {
  margin-bottom: var(--space-10);
}

.title {
  font-family: var(--font-display);
  font-size: var(--text-4xl);
  font-weight: 500;
  line-height: var(--leading-tight);
  color: var(--text-primary);
}

.subtitle {
  margin-top: var(--space-2);
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--text-lg);
  color: var(--text-secondary);
}

.source {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 500;
  color: var(--gold-label);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--gold);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.list li + li {
  border-top: 1px solid var(--tint-ink-10);
}

/* A facing row, echoing the book's translation tables: English left, Urdu right. */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-2);
  color: var(--text-primary);
  text-decoration: none;
}

.row:hover {
  background: var(--tint-teal-4);
}

.row:hover .english {
  color: var(--teal-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.english {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  line-height: var(--leading-snug);
}

.urdu {
  flex-shrink: 0;
  max-width: 55%;
  font-family: var(--font-urdu);
  font-size: var(--text-xl);
  line-height: 1.9;
  color: var(--gold-label);
  text-align: right;
}

@media (max-width: 600px) {
  .main {
    padding: var(--space-8) var(--space-4) var(--space-16);
  }

  .title {
    font-size: var(--text-3xl);
  }

  /* Stacked: the Urdu title above its English one */
  .row {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 0;
  }

  .urdu {
    max-width: none;
  }
}
```

- [ ] **Step 3: Write the essay page**

`frontend/src/app/articles/nooreimaan/[slug]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import EssayGate from "@/components/articles/essay-gate";
import {
  NOOR_E_IMAAN_ESSAYS,
  NOOR_E_IMAAN_ESSAY_BY_SLUG,
  essayNeighbours,
  essayPath,
} from "@/data/articles/nooreimaan";
import { pageMetadata } from "@/lib/page-metadata";
import type { EssayMeta } from "@/types/articles";
import styles from "./essay.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return NOOR_E_IMAAN_ESSAYS.map(({ slug }) => ({ slug }));
}

interface EssayPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EssayPageProps) {
  const { slug } = await params;
  const essay = NOOR_E_IMAAN_ESSAY_BY_SLUG.get(slug);
  if (!essay) return {};
  return pageMetadata({
    title: essay.title,
    description: `${essay.urduTitle}: ${essay.title}, an essay from Noor e Imaan.`,
    path: essayPath(slug),
  });
}

function Neighbour({ essay, rel }: { essay: EssayMeta; rel: "prev" | "next" }) {
  return (
    <Link href={essayPath(essay.slug)} rel={rel} className={`${styles.neighbour} ${styles[rel]}`}>
      <span className={styles.direction}>{rel === "prev" ? "Previous" : "Next"}</span>
      <span className={styles.neighbourTitle} lang="ur">
        {essay.urduTitle}
      </span>
    </Link>
  );
}

export default async function EssayPage({ params }: EssayPageProps) {
  const { slug } = await params;
  const essay = NOOR_E_IMAAN_ESSAY_BY_SLUG.get(slug);
  if (!essay) notFound();
  const { previous, next } = essayNeighbours(slug);

  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <h1 className={styles.title} lang="ur" dir="rtl">
          <span className={styles.bracket} aria-hidden="true">﴿</span>
          {essay.urduTitle}
          <span className={styles.bracket} aria-hidden="true">﴾</span>
        </h1>
        <p className={styles.subtitle}>{essay.title}</p>
        <p className={styles.source}>
          From <Link href="/about/">Noor e Imaan</Link>
        </p>
      </header>

      <EssayGate slug={slug} />

      <nav className={styles.foot} aria-label="More essays">
        {/* RTL, as the book reads: the previous essay on the right, the next on the left */}
        <div className={styles.neighbours} dir="rtl">
          {previous && <Neighbour essay={previous} rel="prev" />}
          {next && <Neighbour essay={next} rel="next" />}
        </div>
        <Link href="/articles/" className={styles.all}>
          All articles
        </Link>
      </nav>
    </main>
  );
}
```

`frontend/src/app/articles/nooreimaan/[slug]/essay.module.css`:

```css
.main {
  max-width: var(--max-width-reader);
  margin: 0 auto;
  padding: var(--space-12) var(--space-6) var(--space-20);
}

.head {
  text-align: center;
  margin-bottom: var(--space-10);
}

/* The dua page's title treatment, so the Noor e Imaan pages read as one book. */
.title {
  font-family: var(--font-urdu);
  font-size: var(--text-4xl);
  font-weight: normal;
  line-height: var(--leading-urdu);
  color: var(--gold-label);
  text-wrap: balance;
}

/* The book's ornate brackets, set in the Quran face because the Nastaleeq font lacks them. */
.bracket {
  font-family: var(--font-arabic);
  font-size: 0.8em;
  color: var(--gold);
  margin: 0 var(--space-3);
}

.subtitle {
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--text-lg);
  line-height: var(--leading-snug);
  color: var(--text-secondary);
}

.source {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.source a,
.all {
  color: var(--teal-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.source a:hover,
.all:hover {
  color: var(--teal-hover);
}

.foot {
  margin-top: var(--space-16);
  padding-top: var(--space-6);
  border-top: 1px solid var(--gold);
  text-align: center;
}

.neighbours {
  display: flex;
  justify-content: space-between;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.neighbour {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 45%;
  color: var(--text-primary);
  text-decoration: none;
}

.prev {
  text-align: right;
}

.next {
  text-align: left;
  margin-inline-start: auto;
}

.direction {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.neighbourTitle {
  font-family: var(--font-urdu);
  font-size: var(--text-lg);
  line-height: 2;
  color: var(--teal-primary);
}

.neighbour:hover .neighbourTitle {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.all {
  font-size: var(--text-md);
}

@media (max-width: 600px) {
  .main {
    padding: var(--space-8) var(--space-4) var(--space-16);
  }

  .title {
    font-size: var(--text-3xl);
  }

  .subtitle {
    font-size: var(--text-md);
  }
}
```

- [ ] **Step 4: Redirect the bare collection path**

In `frontend/public/staticwebapp.config.json` `routes`, after the `/saved/*` entry:

```json
    {
      "route": "/articles/nooreimaan",
      "redirect": "/articles/",
      "statusCode": 301
    },
    {
      "route": "/articles/nooreimaan/",
      "redirect": "/articles/",
      "statusCode": 301
    },
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd frontend && npx vitest run src/app`
Expected: PASS, including the colour and token tests.

- [ ] **Step 6: Build and check nothing of the text leaked**

Run:
```bash
cd frontend && npm run build
ls out/articles/nooreimaan | wc -l
grep -c "نسخ" out/articles/nooreimaan/naskh/index.html
python -c "import json; t=json.load(open('../backend/src/Ishqnama.Application/Articles/NoorEImaan/naskh.json',encoding='utf-8')); s=next(b for b in t['blocks'] if b['type']=='p')['runs'][0]['text'][:30]; print(repr(s))"
```
Then `grep -rl "<that 30-char sentence>" out/ || echo clean`.
Expected: 22 directories; the title found in `naskh/index.html`; `clean` for the body sentence (it appears nowhere in `out/`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/articles frontend/public/staticwebapp.config.json
git commit -m "Add the articles index and the Noor e Imaan essay pages"
```

---

### Task 9: Navigation, robots and docs

**Files:**
- Modify: `frontend/src/components/ui/icon.tsx`
- Modify: `frontend/src/components/navigation/app-bar.tsx:9-14`
- Modify: `frontend/src/components/navigation/bottom-nav.tsx:9-14`
- Modify: `frontend/src/components/navigation/__tests__/nav-library-visible.test.tsx`
- Modify: `frontend/src/lib/robots.ts`
- Modify: `frontend/src/lib/__tests__/robots.test.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: icon `"article"`; nav entries to `/articles/`; `DISALLOWED_PATHS` includes `"/articles/"`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/navigation/__tests__/nav-library-visible.test.tsx`:

```tsx
describe("Articles navigation", () => {
  afterEach(cleanup);

  it("is listed in the app bar for everyone", () => {
    render(<AppBar />);
    expect(screen.getByRole("link", { name: "Articles" }).getAttribute("href")).toBe("/articles/");
  });

  it("is listed in the bottom navigation", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /Articles/ }).getAttribute("href")).toBe("/articles/");
  });
});
```

Append inside the `robotsFor` describe in `frontend/src/lib/__tests__/robots.test.ts`:

```ts
  it("keeps the signed-in readers' articles out of search", () => {
    expect(DISALLOWED_PATHS).toContain("/articles/");
  });
```

Run: `cd frontend && npx vitest run src/components/navigation src/lib/__tests__/robots.test.ts`
Expected: FAIL on the three new tests.

- [ ] **Step 2: Implement**

In `frontend/src/components/ui/icon.tsx`, add to `icons` after `library`:

```ts
  article: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
```

In `app-bar.tsx` `navLinks`, after Quran:

```ts
  { href: "/articles/", label: "Articles" },
```

In `bottom-nav.tsx` `tabs`, after Quran:

```ts
  { href: "/articles/", icon: "article", label: "Articles" },
```

In `frontend/src/lib/robots.ts`:

```ts
export const DISALLOWED_PATHS = ["/redirect/", "/library/", "/search/", "/lists/", "/articles/"];
```

and extend the comment above it with: the articles are for signed-in readers, so their pages hold only titles and are not worth indexing.

- [ ] **Step 3: Run the whole frontend suite**

Run: `cd frontend && npm test && npm run lint`
Expected: all pass (the sitemap test confirms the sitemap lists nothing under `/articles/`).

- [ ] **Step 4: Update the root `CLAUDE.md`**

- Add an **Articles** bullet under Frontend: `/articles/` index (public titles from `src/data/articles/nooreimaan.json`), `/articles/nooreimaan/<slug>/` essays whose text comes only from `GET /api/articles/nooreimaan/{slug}` (signed-in) via `useEssay` and `EssayGate`; the converter `scripts/build_nooreimaan_articles.py` (`npm run articles:build`, `npm run articles:test`) writes the embedded JSON in the backend from the gitignored `.ishqnama/articles/31.html`; the facing-quotation design; `/articles/nooreimaan/` redirects to `/articles/` in `staticwebapp.config.json`; design in `plans/frontend-articles-spec.md`.
- **Sign-in prompt**: add the essays to the "Gated today" list.
- **robots.txt**: add `/articles/` to the listed disallowed paths.
- **Public pages**: add `/articles/` (titles only).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components frontend/src/lib CLAUDE.md
git commit -m "Link Articles from the navigation and keep it out of search"
```

---

### Task 10: End-to-end check in the browser

**Files:** none unless the checks find something (then fix it in the owning task's files and commit).

- [ ] **Step 1: Run everything locally**

`cd backend && docker-compose up -d` (API on :5081, which `frontend/.env.local` points at), then `cd frontend && npm run dev`.

- [ ] **Step 2: Signed out**

With the Playwright tools at 1280×900: `/articles/` lists 22 essays and the dua; `/articles/nooreimaan/naskh/` shows the title, the sign-in prompt over an empty state, and prev/next. Screenshot both, light and dark (theme menu in the app bar).

- [ ] **Step 3: Signed in**

Ask the user to sign in in the Playwright window (the dev Entra tenant needs their credentials). Then:
- `/articles/nooreimaan/naskh/` and `/articles/nooreimaan/eighteen-ayaat/` render; the 18-entry contents jumps to `#section-12` with the heading clear of the app bar.
- In the network panel, the essay request returns 200 with `cache-control: private, no-cache` and an `etag`; reloading shows the request revalidated with `If-None-Match` and answered 304.
- Next/Previous move between essays without the old text flashing under the new title.
- Screenshots at 1280px and 375px, light and dark. At 375px: pairs stack with the short gold rule, no horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`), the bottom nav fits five tabs.
- Tab through the page: the nav, the index rows and the contents links all show the focus ring.

- [ ] **Step 4: Compare with the source**

Open `.ishqnama/articles/31.html` in the browser and compare three paragraphs and one table of `naskh` and `ghazwa-e-hind` with the rendered page for missing, merged or reordered words. Report anything off rather than hand-editing the JSON (fix the converter and regenerate).

- [ ] **Step 5: Final verification**

Run: `cd backend && dotnet test` and `cd frontend && npm test && npm run lint && npm run build && npm run articles:test`
Expected: all pass. Then hand over with superpowers:finishing-a-development-branch.
