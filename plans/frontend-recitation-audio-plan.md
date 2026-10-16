# Recitation Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Readers can press Play on any verse (reader, popup, verse list) and hear Abdul Basit's recitation run on from there, with the verse being read highlighted, through one site-wide player fed from MP3s on Cloudflare R2 and verse timings bundled in the app.

**Architecture:** A build script turns Tarteel's `segments.json` into a checked-in timings table (al-Fatiha remapped, basmala extracted). `src/lib/recitation-playlist.ts` turns verses into content-agnostic `Clip`s (file URL, `fromMs`, `toMs`). `AudioPlayerProvider` in the app shell owns one `Audio` element, plays a `Playlist` clip by clip, and renders a fixed bar; pages ask `isCurrent(ref)` to highlight and `useFollowReading` to keep the verse in view.

**Tech Stack:** Next.js 15 / React 19 static export, Vitest + Testing Library (jsdom), Node 25 scripts (`node --test` for script tests), Cloudflare R2 via `rclone`, HTML `Audio` + Media Session API.

**Spec:** `plans/frontend-recitation-audio-spec.md` (data defects: `plans/recitation-timing-issues.md`)

> **Since executed:** the `build-recitation-timings.mjs`, `fetch-recitation.mjs` and `upload-recitation.mjs` scripts and their `npm run recitation:*` commands below were replaced by `frontend/scripts/onboard_recitation.py` under the project skill `.claude/skills/onboarding-tarteel-audio/`, and the bucket path became `/recitations/<id>/v<N>/`; `sync-audio.yml` streams the files from Tarteel's CDN. The listings below are the history of the first implementation.

## Global Constraints

- Reader-facing copy never says "player", "audio file", "stream", "load", "service", "server", "API", "session"; the reader hears a "recitation" or a "recording". Sentence case, under twelve words. Enforced by `src/config/__tests__/audio-copy.test.ts`.
- Every colour in CSS modules is a token (`src/app/__tests__/no-hardcoded-colours.test.ts` fails otherwise); dark mode needs no extra work when tokens are used.
- Telemetry: only names in `TelemetryEvent` and keys in `TELEMETRY_PROPERTY_KEYS`; never a verse, title or URL.
- Audio path on R2 is versioned: `/recitations/v1/abdul-basit-murattal/NNN.mp3`; a changed recording goes to `/v2/` and `version: 2`.
- No backend change. No Terraform change (R2 is hand-managed and documented).
- Nothing is fetched from R2 until Play is pressed. The provider is mounted **around** `AuthProvider`; the redirect bridge route must not mount it (AppShell already returns early there).
- Verse ids in the DOM are `verse-<chapter>-<verse>` (the reader already uses them; `ArabicPassage` gains them).
- Tarteel verse numbering → Ishqnama: 1:1 → 1:0 (basmala, reused as N:0 for N ≠ 9); 1:2–1:6 → 1:1–1:5; 1:7 words 1–4 → 1:6; words 5–9 → 1:7; chapters 2–114 unchanged, no basmala audio.
- Commits never mention Claude (no Co-Authored-By trailer).
- Local dev quirks (memory): `npm run lint` prompts because there is no ESLint config; two `list-view` tests already fail on `main`; a stale dev server may hold port 3000.
- Run frontend commands from `frontend/`: `npm test`, `npm run build`.

## Review Focus

1. **A verse tapped while another chapter's file is playing** (reader opens 3:1 while 2:200 plays): the old file must be replaced and the new verse heard from its own start, with no burst of the old audio. Test in Task 4 ("switches file for a clip in another file").
2. **An overlap in the export (e.g. 19:1 → 19:2, `from` 12.6 s before the previous `to`)**: the player must seek back rather than skip or stall. Test in Task 4 ("seeks when the next clip starts well before this one ended").
3. **The last verse of a page ends**: status must return to `closed`, the bar must disappear, the audio must stop, and `isCurrent` must be false everywhere. Test in Task 4 ("closes after the last clip").
4. **Chapter 9 on a juz page** (verse 0 absent): the builder must not throw for a page that simply has no verse 0, only for an explicit request. Test in Task 2 ("versePlaylist skips nothing and clipFor(9, 0) throws").
5. **Navigation away while playing**: the bar stays, the title links back to the verse, and the reader page that unmounted must not leave the provider pointing at a stale element. Test in Task 4 ("keeps playing when the page that started it unmounts") and Task 5 (title link).

---

### Task 1: Timings build script and the checked-in timings

**Files:**
- Create: `frontend/scripts/build-recitation-timings.mjs`
- Create: `frontend/scripts/test-build-recitation-timings.mjs`
- Create: `frontend/src/data/recitations/abdul-basit-murattal.ts` (generated)
- Create: `frontend/src/data/__tests__/recitation-timings.test.ts`
- Modify: `frontend/package.json` (scripts)

**Interfaces:**
- Produces: `ABDUL_BASIT_MURATTAL: RecitationTimings` where

```ts
export interface RecitationTimings {
  id: string;                       // "abdul-basit-murattal"
  version: number;                  // 1
  basmala: [number, number];        // [fromMs, toMs] inside chapter 1's file
  chapters: [number, number, number][][];   // index 0 = chapter 1; rows [verse, fromMs, toMs], numbered verses only
}
```

  The type itself is declared in Task 2 (`src/lib/recitation-playlist.ts`); the generated file imports it from there, so Task 2's type must exist before `npm test` can type-check the data. Order: do Task 1's script and tests first, generate the data, then Task 2 adds the type before the data test is run. (Vitest does not type-check, so the data test passes regardless; `npm run build` needs Task 2.)
- Produces: `npm run recitation:build`, `npm run recitation:test`.

- [ ] **Step 1: Write the script's tests (Node test runner)**

`frontend/scripts/test-build-recitation-timings.mjs`:

```js
// Run: node --test scripts/test-build-recitation-timings.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTimings, CHAPTER_VERSE_COUNTS } from "./build-recitation-timings.mjs";

// A tiny export in the package's shape: chapter 1 as Tarteel ships it, chapter 2 with
// two verses, chapter 9 with one. Verse counts for the fixture are passed in so the test
// does not need the full Quran.
function fixture() {
  const segments = {
    "1:1": { timestamp_from: 0, timestamp_to: 4451, segments: [[1, 0, 1110], [2, 1160, 1750], [3, 1800, 2750], [4, 2800, 4451]] },
    "1:2": { timestamp_from: 4651, timestamp_to: 9628, segments: [[1, 5680, 9628]] },
    "1:3": { timestamp_from: 9828, timestamp_to: 13901, segments: [[1, 10920, 13901]] },
    "1:4": { timestamp_from: 14101, timestamp_to: 18159, segments: [[1, 15280, 18159]] },
    "1:5": { timestamp_from: 18359, timestamp_to: 23822, segments: [[1, 19320, 23822]] },
    "1:6": { timestamp_from: 24022, timestamp_to: 28999, segments: [[1, 24960, 28999]] },
    "1:7": {
      timestamp_from: 29199, timestamp_to: 41784,
      segments: [[1, 30480, 31430], [2, 31480, 31950], [3, 32000, 32870], [4, 32920, 33710],
                 [5, 33760, 34350], [6, 34400, 35350], [7, 35400, 36310], [8, 36360, 39356], [9, 39356, 41784]],
    },
    "2:1": { timestamp_from: 0, timestamp_to: 6631, segments: [[1, 0, 6631]] },
    "2:2": { timestamp_from: 6831, timestamp_to: 14964, segments: [[1, 6900, 14964]] },
    "9:1": { timestamp_from: 0, timestamp_to: 13260, segments: [[1, 0, 13260]] },
  };
  const counts = { 1: 7, 2: 2, 9: 1 };
  return { segments, counts };
}

test("remaps al-Fatiha: basmala out, 1:2-1:6 shift down, 1:7 split at word 5", () => {
  const { segments, counts } = fixture();
  const out = buildTimings(segments, counts);
  assert.deepEqual(out.basmala, [0, 4451]);
  assert.deepEqual(out.chapters[0], [
    [1, 4651, 9628], [2, 9828, 13901], [3, 14101, 18159], [4, 18359, 23822], [5, 24022, 28999],
    [6, 30480, 33710], [7, 33760, 41784],
  ]);
});

test("copies other chapters as they are, keyed by chapter index", () => {
  const { segments, counts } = fixture();
  const out = buildTimings(segments, counts);
  assert.deepEqual(out.chapters[1], [[1, 0, 6631], [2, 6831, 14964]]);
  assert.deepEqual(out.chapters[8], [[1, 0, 13260]]);
  assert.equal(out.id, "abdul-basit-murattal");
  assert.equal(out.version, 1);
});

test("fails when 1:7 does not have nine word segments", () => {
  const { segments, counts } = fixture();
  segments["1:7"].segments = segments["1:7"].segments.slice(0, 8);
  assert.throws(() => buildTimings(segments, counts), /1:7 .*9 word segments/);
});

test("fails when a chapter's verse count differs from ours", () => {
  const { segments, counts } = fixture();
  delete segments["2:2"];
  assert.throws(() => buildTimings(segments, counts), /chapter 2: expected 2 verses, found 1/);
});

test("fails on a verse whose from is not before its to", () => {
  const { segments, counts } = fixture();
  segments["2:2"].timestamp_to = segments["2:2"].timestamp_from;
  assert.throws(() => buildTimings(segments, counts), /2:2: from 6831 is not before to 6831/);
});

test("reports overlaps, largest first, without failing", () => {
  const { segments, counts } = fixture();
  segments["2:2"].timestamp_from = 6000;   // 631 ms before 2:1 ends
  const report = [];
  buildTimings(segments, counts, { onOverlap: (c, v, ms) => report.push([c, v, ms]) });
  assert.deepEqual(report, [[2, 2, 631]]);
});

test("ships the real verse counts for all 114 chapters", () => {
  assert.equal(Object.keys(CHAPTER_VERSE_COUNTS).length, 114);
  assert.equal(CHAPTER_VERSE_COUNTS[1], 7);
  assert.equal(CHAPTER_VERSE_COUNTS[2], 286);
  assert.equal(CHAPTER_VERSE_COUNTS[114], 6);
  assert.equal(Object.values(CHAPTER_VERSE_COUNTS).reduce((a, b) => a + b, 0), 6236);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `node --test scripts/test-build-recitation-timings.mjs`
Expected: FAIL, "Cannot find module './build-recitation-timings.mjs'".

- [ ] **Step 3: Write the script**

`frontend/scripts/build-recitation-timings.mjs`:

```js
// Turns Tarteel's verse timings for one surah-by-surah recitation into the table the app
// bundles. Source: audio/.tarteel/export/segments.json (QUL resource 408, "c:v" keys with
// timestamp_from / timestamp_to in ms and word `segments` [[position, from, to], ...]).
// Output: src/data/recitations/abdul-basit-murattal.ts.
//
// Ishqnama numbers the basmala as verse 0 of every chapter except 9; Tarteel has it only as
// 1:1. See plans/frontend-recitation-audio-spec.md ("Tarteel's numbering differs") and
// plans/recitation-timing-issues.md for the export's known overlaps, which this script
// reports but does not change.
//
// Usage: node scripts/build-recitation-timings.mjs   (from frontend/)
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RECITATION_ID = "abdul-basit-murattal";
const VERSION = 1;
const SOURCE = path.resolve("../audio/.tarteel/export/segments.json");
const OUTPUT = path.resolve("src/data/recitations/abdul-basit-murattal.ts");

/** Verse counts of every chapter in Ishqnama's numbering (the basmala, verse 0, not counted). */
export const CHAPTER_VERSE_COUNTS = {
  1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109, 11: 123, 12: 111,
  13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135, 21: 112, 22: 78, 23: 118,
  24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60, 31: 34, 32: 30, 33: 73, 34: 54, 35: 45,
  36: 83, 37: 182, 38: 88, 39: 75, 40: 85, 41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38,
  48: 29, 49: 18, 50: 45, 51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24,
  60: 13, 61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44, 71: 28,
  72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42, 81: 29, 82: 19, 83: 36,
  84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20, 91: 15, 92: 21, 93: 11, 94: 8, 95: 8,
  96: 19, 97: 5, 98: 8, 99: 8, 100: 11, 101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7,
  108: 3, 109: 6, 110: 3, 111: 5, 112: 4, 113: 5, 114: 6,
};

/**
 * Chapters whose Tarteel verses map onto ours differently. Each entry turns the Tarteel rows
 * of that chapter into our rows and may return the basmala span found along the way.
 */
const VERSE_REMAPS = {
  1: (rows) => {
    // Tarteel: 1:1 basmala, 1:2-1:6 our 1:1-1:5, 1:7 nine words = our 1:6 (words 1-4) + 1:7 (words 5-9).
    const byVerse = new Map(rows.map((r) => [r.verse, r]));
    const v7 = byVerse.get(7);
    if (!v7 || v7.words.length !== 9) {
      throw new Error(`1:7 should have 9 word segments, found ${v7 ? v7.words.length : "no verse"}`);
    }
    const out = [];
    for (let v = 2; v <= 6; v++) {
      const r = byVerse.get(v);
      out.push([v - 1, r.from, r.to]);
    }
    out.push([6, v7.words[0][1], v7.words[3][2]]);
    out.push([7, v7.words[4][1], v7.words[8][2]]);
    const b = byVerse.get(1);
    return { rows: out, basmala: [b.from, b.to] };
  },
};

/**
 * @param segments the parsed segments.json
 * @param counts   verse counts by chapter, Ishqnama numbering (CHAPTER_VERSE_COUNTS, or a fixture's)
 * @param options  onOverlap(chapter, verse, ms): called for each verse starting before the previous ended
 */
export function buildTimings(segments, counts, options = {}) {
  const onOverlap = options.onOverlap ?? (() => {});
  const byChapter = new Map();
  for (const [key, e] of Object.entries(segments)) {
    const [c, v] = key.split(":").map(Number);
    if (!byChapter.has(c)) byChapter.set(c, []);
    byChapter.get(c).push({ verse: v, from: e.timestamp_from, to: e.timestamp_to, words: e.segments });
  }

  const chapterNumbers = Object.keys(counts).map(Number).sort((a, b) => a - b);
  const maxChapter = chapterNumbers[chapterNumbers.length - 1];
  const chapters = new Array(maxChapter).fill(null);
  let basmala = null;
  const overlaps = [];

  for (const c of chapterNumbers) {
    const rows = (byChapter.get(c) ?? []).sort((a, b) => a.verse - b.verse);
    const expected = counts[c];
    if (rows.length !== expected) {
      throw new Error(`chapter ${c}: expected ${expected} verses, found ${rows.length}`);
    }
    let ours;
    if (VERSE_REMAPS[c]) {
      const r = VERSE_REMAPS[c](rows);
      ours = r.rows;
      if (r.basmala) basmala = r.basmala;
    } else {
      ours = rows.map((r) => [r.verse, r.from, r.to]);
    }
    let prevTo = null;
    for (const [v, from, to] of ours) {
      if (!(from < to)) throw new Error(`${c}:${v}: from ${from} is not before to ${to}`);
      if (prevTo != null && from < prevTo) overlaps.push([prevTo - from, c, v]);
      prevTo = to;
    }
    chapters[c - 1] = ours;
  }
  if (!basmala) throw new Error("chapter 1 did not yield the basmala span");

  overlaps.sort((a, b) => b[0] - a[0]);
  for (const [ms, c, v] of overlaps) onOverlap(c, v, ms);

  return { id: RECITATION_ID, version: VERSION, basmala, chapters };
}

function render(timings) {
  const rows = timings.chapters
    .map((ch) => "    [" + ch.map(([v, f, t]) => `[${v},${f},${t}]`).join(",") + "],")
    .join("\n");
  return `// Generated by scripts/build-recitation-timings.mjs from Tarteel's QUL export (resource 408).
// Do not edit by hand; rerun \`npm run recitation:build\`. Rows are [verse, fromMs, toMs] inside the
// chapter's file; the basmala (verse 0 of every chapter but 9) is the span in chapter 1's file.
import type { RecitationTimings } from "@/lib/recitation-playlist";

export const ABDUL_BASIT_MURATTAL: RecitationTimings = {
  id: ${JSON.stringify(timings.id)},
  version: ${timings.version},
  basmala: [${timings.basmala[0]}, ${timings.basmala[1]}],
  chapters: [
${rows}
  ],
};
`;
}

async function main() {
  const segments = JSON.parse(await readFile(SOURCE, "utf8"));
  const overlaps = [];
  const timings = buildTimings(segments, CHAPTER_VERSE_COUNTS, {
    onOverlap: (c, v, ms) => overlaps.push(`  ${c}:${v - 1} -> ${c}:${v}  ${(ms / 1000).toFixed(2)} s`),
  });
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, render(timings), "utf8");
  console.log(`wrote ${path.relative(process.cwd(), OUTPUT)} (${timings.chapters.length} chapters)`);
  if (overlaps.length) {
    console.log(`${overlaps.length} overlapping verse pairs in the export (see plans/recitation-timing-issues.md):`);
    console.log(overlaps.join("\n"));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/test-build-recitation-timings.mjs`
Expected: 7 passing.

- [ ] **Step 5: Add the npm scripts and generate the data**

In `frontend/package.json` `scripts`, after `"articles:test"`:

```json
    "recitation:build": "node scripts/build-recitation-timings.mjs",
    "recitation:test": "node --test scripts/test-build-recitation-timings.mjs"
```

Run: `npm run recitation:build`
Expected: `wrote src/data/recitations/abdul-basit-murattal.ts (114 chapters)` followed by `62 overlapping verse pairs in the export` and the list, `55:70 -> 55:71  64.82 s` first.

- [ ] **Step 6: Write the data test**

`frontend/src/data/__tests__/recitation-timings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";
import { suras } from "@/data/suras";

describe("Abdul Basit murattal timings", () => {
  it("has a row for every numbered verse of every chapter, in order", () => {
    expect(ABDUL_BASIT_MURATTAL.chapters).toHaveLength(114);
    for (const sura of suras) {
      const rows = ABDUL_BASIT_MURATTAL.chapters[sura.number - 1];
      expect(rows, `chapter ${sura.number}`).toHaveLength(sura.verseCount);
      rows.forEach(([verse], i) => expect(verse, `chapter ${sura.number} row ${i}`).toBe(i + 1));
    }
  });

  it("gives every verse a span that ends after it starts", () => {
    ABDUL_BASIT_MURATTAL.chapters.forEach((rows, i) => {
      for (const [verse, from, to] of rows) expect(from, `${i + 1}:${verse}`).toBeLessThan(to);
    });
  });

  it("holds the basmala as a span at the start of chapter 1's file", () => {
    const [from, to] = ABDUL_BASIT_MURATTAL.basmala;
    expect(from).toBe(0);
    expect(to).toBeGreaterThan(from);
    expect(ABDUL_BASIT_MURATTAL.chapters[0][0][1]).toBeGreaterThanOrEqual(to);
  });

  it("splits al-Fatiha's last Tarteel verse into our 1:6 and 1:7", () => {
    const [, , v6to] = ABDUL_BASIT_MURATTAL.chapters[0][5];
    const [, v7from] = ABDUL_BASIT_MURATTAL.chapters[0][6];
    expect(v7from).toBeGreaterThanOrEqual(v6to);
    expect(v7from - v6to).toBeLessThan(1000);
  });

  it("names the recitation and its version", () => {
    expect(ABDUL_BASIT_MURATTAL.id).toBe("abdul-basit-murattal");
    expect(ABDUL_BASIT_MURATTAL.version).toBe(1);
  });
});
```

- [ ] **Step 7: Run the data test**

Run: `npx vitest run src/data/__tests__/recitation-timings.test.ts`
Expected: 5 passing (the type import resolves to nothing at runtime; Task 2 adds the module).

- [ ] **Step 8: Commit**

```bash
git add frontend/scripts/build-recitation-timings.mjs frontend/scripts/test-build-recitation-timings.mjs frontend/src/data/recitations/abdul-basit-murattal.ts frontend/src/data/__tests__/recitation-timings.test.ts frontend/package.json
git commit -m "Build the bundled verse timings from Tarteel's recitation export"
```

---

### Task 2: Playlist builders and the audio config

**Files:**
- Create: `frontend/src/lib/recitation-playlist.ts`
- Create: `frontend/src/config/recitation.ts`
- Test: `frontend/src/lib/__tests__/recitation-playlist.test.ts`

**Interfaces:**
- Consumes: `ABDUL_BASIT_MURATTAL` (Task 1), `suras` from `@/data/suras`.
- Produces:

```ts
export interface RecitationTimings { id: string; version: number; basmala: [number, number]; chapters: [number, number, number][][] }
export interface Clip { url: string; fromMs?: number; toMs?: number; title: string; subtitle?: string; ref?: { chapter: number; verse: number } }
export interface Playlist { id: string; clips: Clip[]; href?: string }
export function chapterAudioUrl(recitation: RecitationTimings, chapter: number): string
export function clipFor(recitation: RecitationTimings, chapter: number, verse: number): Clip
export function versePlaylist(id: string, verses: readonly { chapter: number; verse: number }[], href?: string, recitation?: RecitationTimings): Playlist
export function verseQuery(ref: { chapter: number; verse: number }, href: string): string   // href + "?verse=..." for the bar's link
```

  `src/config/recitation.ts`: `RECITATION_AUDIO_ORIGIN`, `RECITATION` (= `ABDUL_BASIT_MURATTAL`).

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/__tests__/recitation-playlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  chapterAudioUrl,
  clipFor,
  versePlaylist,
  verseQuery,
  type RecitationTimings,
} from "@/lib/recitation-playlist";
import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";

const tiny: RecitationTimings = {
  id: "test-reciter",
  version: 3,
  basmala: [0, 4000],
  chapters: [
    [[1, 4000, 9000], [2, 9000, 14000]],
    [[1, 0, 6000], [2, 6200, 12000]],
  ],
};

describe("chapterAudioUrl", () => {
  it("builds the versioned, zero-padded path on the audio origin", () => {
    expect(chapterAudioUrl(tiny, 2)).toBe("https://audio.ishqnama.com/recitations/v3/test-reciter/002.mp3");
    expect(chapterAudioUrl(ABDUL_BASIT_MURATTAL, 114)).toBe(
      "https://audio.ishqnama.com/recitations/v1/abdul-basit-murattal/114.mp3",
    );
  });
});

describe("clipFor", () => {
  it("reads a numbered verse out of its own chapter's file", () => {
    expect(clipFor(tiny, 2, 2)).toEqual({
      url: "https://audio.ishqnama.com/recitations/v3/test-reciter/002.mp3",
      fromMs: 6200,
      toMs: 12000,
      title: "al-Baqarah",
      subtitle: "Verse 2",
      ref: { chapter: 2, verse: 2 },
    });
  });

  it("plays verse 0 of any chapter but 9 as the basmala from chapter 1's file", () => {
    const clip = clipFor(tiny, 2, 0);
    expect(clip.url).toBe("https://audio.ishqnama.com/recitations/v3/test-reciter/001.mp3");
    expect(clip.fromMs).toBe(0);
    expect(clip.toMs).toBe(4000);
    expect(clip.subtitle).toBe("Bismillah");
    expect(clip.ref).toEqual({ chapter: 2, verse: 0 });
    expect(clipFor(tiny, 1, 0).url).toBe(clip.url);
  });

  it("refuses verse 0 of chapter 9 and verses that do not exist", () => {
    expect(() => clipFor(ABDUL_BASIT_MURATTAL, 9, 0)).toThrow(/9:0/);
    expect(() => clipFor(tiny, 2, 3)).toThrow(/2:3/);
  });
});

describe("versePlaylist", () => {
  it("keeps the verses in the order given, across chapters, with the id and href", () => {
    const p = versePlaylist(
      "juz/1",
      [{ chapter: 1, verse: 2 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 }],
      "/quran/juz/1/",
      tiny,
    );
    expect(p.id).toBe("juz/1");
    expect(p.href).toBe("/quran/juz/1/");
    expect(p.clips.map((c) => c.ref)).toEqual([
      { chapter: 1, verse: 2 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 },
    ]);
    expect(p.clips[1].url).toMatch(/001\.mp3$/);
    expect(p.clips[2].url).toMatch(/002\.mp3$/);
  });

  it("uses the bundled recitation by default", () => {
    const p = versePlaylist("quran/112", [{ chapter: 112, verse: 1 }]);
    expect(p.clips[0].url).toBe("https://audio.ishqnama.com/recitations/v1/abdul-basit-murattal/112.mp3");
    expect(p.clips[0].title).toBe("al-Ikhlāṣ");
  });
});

describe("verseQuery", () => {
  it("adds the verse to a chapter page as a bare number and elsewhere as chapter-verse", () => {
    expect(verseQuery({ chapter: 2, verse: 255 }, "/quran/2/")).toBe("/quran/2/?verse=255");
    expect(verseQuery({ chapter: 2, verse: 255 }, "/quran/juz/3/")).toBe("/quran/juz/3/?verse=2-255");
    expect(verseQuery({ chapter: 2, verse: 255 }, "/lists/view/?id=abc123def456")).toBe(
      "/lists/view/?id=abc123def456&verse=2-255",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/recitation-playlist.test.ts`
Expected: FAIL, cannot resolve `@/lib/recitation-playlist`.

- [ ] **Step 3: Write the config and the builders**

`frontend/src/config/recitation.ts`:

```ts
import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";

/**
 * Where the recitation files live: one Cloudflare R2 bucket behind this custom domain, shared
 * by dev, prod and local development (audio is not environment data). The env var exists only
 * for testing against another bucket; no environment sets it. Setup is in infra/README.md.
 */
export const RECITATION_AUDIO_ORIGIN =
  process.env.NEXT_PUBLIC_RECITATION_AUDIO_ORIGIN ?? "https://audio.ishqnama.com";

/** The one recitation offered today. A reciter setting would pick between several of these. */
export const RECITATION = ABDUL_BASIT_MURATTAL;

/** Shown on the lock screen and in the bar's accessible name. */
export const RECITER_NAME = "Abdul Basit Abdul Samad";
```

`frontend/src/lib/recitation-playlist.ts`:

```ts
import { RECITATION, RECITATION_AUDIO_ORIGIN } from "@/config/recitation";
import { suras } from "@/data/suras";
import { AUDIO_COPY } from "@/config/audio-copy";

/** Verse timings of one surah-by-surah recitation, as `scripts/build-recitation-timings.mjs` writes them. */
export interface RecitationTimings {
  id: string;
  version: number;
  /** [fromMs, toMs] of the basmala inside chapter 1's file; verse 0 of every chapter but 9. */
  basmala: [number, number];
  /** Index 0 is chapter 1. Rows are [verse, fromMs, toMs]; numbered verses only. */
  chapters: [number, number, number][][];
}

/** Something the player can play: a span of a file, or the whole file when from/to are omitted. */
export interface Clip {
  url: string;
  fromMs?: number;
  toMs?: number;
  /** What the bar shows: "al-Baqarah". */
  title: string;
  /** "Verse 255", "Bismillah". */
  subtitle?: string;
  /** Lets a page highlight the verse being read. */
  ref?: { chapter: number; verse: number };
}

export interface Playlist {
  /** Stable per page or list ("quran/2", "juz/3", "list/abc123def456"); the same id is the same playlist. */
  id: string;
  clips: Clip[];
  /** The page the playlist came from; the bar's title links back to it. */
  href?: string;
}

export function chapterAudioUrl(recitation: RecitationTimings, chapter: number): string {
  return `${RECITATION_AUDIO_ORIGIN}/recitations/v${recitation.version}/${recitation.id}/${String(chapter).padStart(3, "0")}.mp3`;
}

function chapterName(chapter: number): string {
  return suras.find((s) => s.number === chapter)?.name ?? `Chapter ${chapter}`;
}

/** The clip for one verse. Verse 0 is the basmala from chapter 1's file; chapter 9 has none. */
export function clipFor(recitation: RecitationTimings, chapter: number, verse: number): Clip {
  const title = chapterName(chapter);
  if (verse === 0) {
    if (chapter === 9) throw new Error("9:0 does not exist: chapter 9 has no basmala");
    const [fromMs, toMs] = recitation.basmala;
    return { url: chapterAudioUrl(recitation, 1), fromMs, toMs, title, subtitle: AUDIO_COPY.bismillah, ref: { chapter, verse: 0 } };
  }
  const row = recitation.chapters[chapter - 1]?.find(([v]) => v === verse);
  if (!row) throw new Error(`${chapter}:${verse} is not in the recitation`);
  const [, fromMs, toMs] = row;
  return { url: chapterAudioUrl(recitation, chapter), fromMs, toMs, title, subtitle: AUDIO_COPY.verse(verse), ref: { chapter, verse } };
}

/** A playlist of the given verses in the given order; the caller decides what a page or list holds. */
export function versePlaylist(
  id: string,
  verses: readonly { chapter: number; verse: number }[],
  href?: string,
  recitation: RecitationTimings = RECITATION,
): Playlist {
  return { id, clips: verses.map((v) => clipFor(recitation, v.chapter, v.verse)), href };
}

/** The page link that opens on this verse: a bare number on a chapter page, chapter-verse elsewhere. */
export function verseQuery(ref: { chapter: number; verse: number }, href: string): string {
  const onChapterPage = /^\/quran\/\d+\/$/.test(href);
  const value = onChapterPage ? String(ref.verse) : `${ref.chapter}-${ref.verse}`;
  return `${href}${href.includes("?") ? "&" : "?"}verse=${value}`;
}
```

`AUDIO_COPY` does not exist until Task 5. Create a minimal `frontend/src/config/audio-copy.ts` now, which Task 5 completes:

```ts
/**
 * Every reader-facing string of the recitation bar and its play controls. Readers are often
 * unfamiliar with technology, so nothing here says "player", "audio file", "stream", "load",
 * "service" or "server": what the reader hears is a "recitation" or a "recording". Sentence
 * case, under twelve words. `src/config/__tests__/audio-copy.test.ts` enforces these rules.
 */
export const AUDIO_COPY = {
  bismillah: "Bismillah",
  verse: (n: number) => `Verse ${n}`,
} as const;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/recitation-playlist.test.ts src/data/__tests__/recitation-timings.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/recitation-playlist.ts frontend/src/config/recitation.ts frontend/src/config/audio-copy.ts frontend/src/lib/__tests__/recitation-playlist.test.ts
git commit -m "Turn verses into recitation clips with the bundled timings"
```

---

### Task 3: Telemetry events and icons

**Files:**
- Modify: `frontend/src/lib/telemetry-events.ts`
- Modify: `frontend/src/components/ui/icon.tsx`
- Create: `frontend/src/components/ui/__tests__/icon.test.tsx`

**Interfaces:**
- Produces: `TelemetryEvent` gains `"recording-played" | "recording-failed"`; `Icon` names `play` (solid), `pause`, `skipBack`, `skipForward`.

- [ ] **Step 1: Write the failing icon test**

`frontend/src/components/ui/__tests__/icon.test.tsx`:

```tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Icon from "@/components/ui/icon";

afterEach(cleanup);

describe("Icon", () => {
  it("draws a solid play glyph and outlined transport glyphs", () => {
    const play = render(<Icon name="play" />).container.querySelector("svg");
    expect(play?.getAttribute("fill")).toBe("currentColor");
    for (const name of ["pause", "skipBack", "skipForward"]) {
      const svg = render(<Icon name={name} />).container.querySelector("svg");
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute("fill"), name).toBe("none");
    }
  });

  it("draws nothing for a name it does not know", () => {
    expect(render(<Icon name="no-such-icon" />).container.querySelector("svg")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/ui/__tests__/icon.test.tsx`
Expected: FAIL on the first test (`play` renders nothing, `fill` is null).

- [ ] **Step 3: Add the icons and the events**

In `frontend/src/components/ui/icon.tsx`, after the `article` path:

```ts
  play: "M6 4l14 8-14 8z",
  pause: "M8 5v14M16 5v14",
  skipBack: "M19 20L9 12l10-8zM5 19V5",
  skipForward: "M5 4l10 8-10 8zM19 5v14",
```

and change the fill rule:

```ts
  const isFilled = filled && (name === "bookmarkFilled" || name === "heart") || name === "play";
```

In `frontend/src/lib/telemetry-events.ts`, add to the `TelemetryEvent` union after `"article-shared"`:

```ts
  | "recording-played"
  | "recording-failed"
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/ui src/lib/__tests__/telemetry.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/icon.tsx frontend/src/components/ui/__tests__/icon.test.tsx frontend/src/lib/telemetry-events.ts
git commit -m "Add transport icons and the recording telemetry events"
```

---

### Task 4: The audio player provider

**Files:**
- Create: `frontend/src/context/audio-player-context.tsx`
- Test: `frontend/src/context/__tests__/audio-player-context.test.tsx`

**Interfaces:**
- Consumes: `Clip`, `Playlist` (Task 2); `trackEvent`, `routePattern` (`@/lib/telemetry`); `RECITER_NAME` (Task 2); `AUDIO_COPY` (Task 2, completed in Task 5).
- Produces:

```ts
export type AudioPlayerStatus = "closed" | "loading" | "playing" | "paused" | "failed";
export interface AudioPlayerContextValue {
  status: AudioPlayerStatus;
  playlist: Playlist | null;
  index: number | null;
  current: Clip | null;
  play: (playlist: Playlist, index: number, trigger?: HTMLElement | null) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  close: () => void;
  isCurrent: (ref: { chapter: number; verse: number }) => boolean;
}
export default function AudioPlayerProvider({ children, renderBar }: { children: ReactNode; renderBar?: boolean })
export function useAudioPlayer(): AudioPlayerContextValue
export const BOUNDARY_TOLERANCE_MS = 300;
```

  The provider renders `<AudioPlayerBar />` (Task 5) when `status !== "closed"`; until Task 5 exists, the provider is written with the import and Task 5 supplies the component. To keep Task 4 testable on its own, Task 4 creates a placeholder `frontend/src/components/audio/audio-player-bar.tsx` exporting a component that renders `null`; Task 5 replaces it.

- [ ] **Step 1: Write the failing tests**

`frontend/src/context/__tests__/audio-player-context.test.tsx`:

```tsx
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const trackEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  routePattern: (p: string) => p.replace(/\/\d+(?=\/|$)/g, "/[n]"),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/quran/2/" }));

import AudioPlayerProvider, { useAudioPlayer, type AudioPlayerContextValue } from "@/context/audio-player-context";
import type { Playlist } from "@/lib/recitation-playlist";

/** Stands in for the browser's Audio: records calls, lets a test set the time and fire events. */
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  src = "";
  preload = "";
  currentTime = 0;
  paused = true;
  calls: string[] = [];
  playResult: Promise<void> = Promise.resolve();
  constructor() {
    super();
    FakeAudio.instances.push(this);
  }
  load() { this.calls.push("load"); }
  play() {
    this.calls.push("play");
    this.paused = false;
    return this.playResult.then(() => { this.dispatchEvent(new Event("playing")); });
  }
  pause() { this.calls.push("pause"); this.paused = true; this.dispatchEvent(new Event("pause")); }
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
  /** The browser has the file's metadata; a seek set before this is applied now. */
  ready() { this.dispatchEvent(new Event("loadedmetadata")); }
  at(seconds: number) { this.currentTime = seconds; this.dispatchEvent(new Event("timeupdate")); }
}

const file1 = "https://audio.test/001.mp3";
const file2 = "https://audio.test/002.mp3";
const playlist: Playlist = {
  id: "juz/1",
  href: "/quran/juz/1/",
  clips: [
    { url: file1, fromMs: 4000, toMs: 9000, title: "al-Fātiḥah", subtitle: "Verse 1", ref: { chapter: 1, verse: 1 } },
    { url: file1, fromMs: 9000, toMs: 14000, title: "al-Fātiḥah", subtitle: "Verse 2", ref: { chapter: 1, verse: 2 } },
    { url: file1, fromMs: 0, toMs: 4000, title: "al-Baqarah", subtitle: "Bismillah", ref: { chapter: 2, verse: 0 } },
    { url: file2, fromMs: 0, toMs: 6000, title: "al-Baqarah", subtitle: "Verse 1", ref: { chapter: 2, verse: 1 } },
    { url: file2, fromMs: 6200, toMs: 12000, title: "al-Baqarah", subtitle: "Verse 2", ref: { chapter: 2, verse: 2 } },
  ],
};
const wholeFile: Playlist = {
  id: "essay/1",
  clips: [{ url: "https://audio.test/essay.mp3", title: "An essay" }],
};

let api!: AudioPlayerContextValue;
function Probe() {
  api = useAudioPlayer();
  return <span data-testid="status">{api.status}:{api.index ?? "-"}</span>;
}
function Page({ children }: { children?: ReactNode }) {
  return <AudioPlayerProvider>{children}<Probe /></AudioPlayerProvider>;
}
const audio = () => FakeAudio.instances[FakeAudio.instances.length - 1];
const status = () => screen.getByTestId("status").textContent;
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  trackEvent.mockClear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AudioPlayerProvider", () => {
  it("starts closed with no element created", () => {
    render(<Page />);
    expect(status()).toBe("closed:-");
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("creates one element on first play, loads the file at the clip's start and plays", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    expect(FakeAudio.instances).toHaveLength(1);
    expect(audio().src).toBe(`${file1}#t=4`);
    expect(audio().preload).toBe("auto");
    expect(audio().calls).toEqual(["load", "play"]);
    expect(status()).toBe("loading:0");
    await flush();
    expect(status()).toBe("playing:0");
    expect(api.current?.ref).toEqual({ chapter: 1, verse: 1 });
    expect(api.isCurrent({ chapter: 1, verse: 1 })).toBe(true);
    expect(api.isCurrent({ chapter: 1, verse: 2 })).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith("recording-played", { route: "/quran/[n]/" });
  });

  it("corrects the position once metadata arrives if the fragment was not honoured", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => { audio().currentTime = 0; audio().ready(); });
    expect(audio().currentTime).toBe(4);
    act(() => { audio().currentTime = 4.1; audio().ready(); });
    expect(audio().currentTime).toBe(4.1);
  });

  it("runs on gapless into a clip that starts where this one ends", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    const seeks = audio().calls.length;
    act(() => audio().at(9.0));
    expect(status()).toBe("playing:1");
    expect(audio().calls).toHaveLength(seeks);
    expect(audio().currentTime).toBe(9.0);
  });

  it("seeks when the next clip in the same file starts elsewhere", async () => {
    render(<Page />);
    act(() => api.play(playlist, 1));
    await flush();
    act(() => audio().at(14.0));      // clip 2 is the basmala at 0-4 s of the same file
    expect(status()).toBe("playing:2");
    expect(audio().currentTime).toBe(0);
    expect(audio().src).toBe(`${file1}#t=9`);   // no reload for a seek
  });

  it("seeks when the next clip starts well before this one ended (an overlap in the export)", async () => {
    const overlapping: Playlist = {
      id: "quran/19",
      clips: [
        { url: file1, fromMs: 0, toMs: 13270, title: "Maryam", ref: { chapter: 19, verse: 1 } },
        { url: file1, fromMs: 634, toMs: 19201, title: "Maryam", ref: { chapter: 19, verse: 2 } },
      ],
    };
    render(<Page />);
    act(() => api.play(overlapping, 0));
    await flush();
    act(() => audio().at(13.27));
    expect(status()).toBe("playing:1");
    expect(audio().currentTime).toBeCloseTo(0.634, 3);
  });

  it("tolerates a small gap at the boundary without nudging the audio", async () => {
    render(<Page />);
    act(() => api.play(playlist, 3));
    await flush();
    act(() => audio().at(6.0));       // clip 4 starts at 6.2 s: within tolerance
    expect(status()).toBe("playing:4");
    expect(audio().currentTime).toBe(6.0);
  });

  it("switches file for a clip in another file", async () => {
    render(<Page />);
    act(() => api.play(playlist, 2));
    await flush();
    act(() => audio().at(4.0));
    expect(status()).toBe("loading:3");
    expect(audio().src).toBe(`${file2}#t=0`);
    expect(audio().calls.slice(-2)).toEqual(["load", "play"]);
    await flush();
    expect(status()).toBe("playing:3");
  });

  it("closes after the last clip", async () => {
    render(<Page />);
    act(() => api.play(playlist, 4));
    await flush();
    act(() => audio().at(12.0));
    expect(status()).toBe("closed:-");
    expect(audio().calls.at(-1)).toBe("pause");
    expect(audio().src).toBe("");
    expect(api.isCurrent({ chapter: 2, verse: 2 })).toBe(false);
  });

  it("plays a whole-file clip and closes on ended", async () => {
    render(<Page />);
    act(() => api.play(wholeFile, 0));
    expect(audio().src).toBe("https://audio.test/essay.mp3");
    await flush();
    act(() => audio().at(5000));
    expect(status()).toBe("playing:0");
    act(() => audio().dispatchEvent(new Event("ended")));
    expect(status()).toBe("closed:-");
  });

  it("pauses and resumes by replaying the current clip, and through pause/resume", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => api.play(playlist, 0));
    expect(status()).toBe("paused:0");
    expect(audio().calls.at(-1)).toBe("pause");
    act(() => api.play(playlist, 0));
    await flush();
    expect(status()).toBe("playing:0");
    act(() => api.pause());
    expect(status()).toBe("paused:0");
    act(() => api.resume());
    await flush();
    expect(status()).toBe("playing:0");
  });

  it("treats a rebuilt playlist with the same id as the same playlist", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => api.play({ ...playlist, clips: [...playlist.clips] }, 0));
    expect(status()).toBe("paused:0");
  });

  it("moves with next and previous and stays put at the ends", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => api.previous());
    expect(status()).toBe("playing:0");
    act(() => api.next());
    expect(status()).toBe("playing:1");
    expect(audio().currentTime).toBe(9);
    act(() => api.next());                 // 2: the basmala, same file, a seek to 0
    expect(audio().currentTime).toBe(0);
    act(() => api.next());                 // 3: a new file
    expect(status()).toBe("loading:3");
    await flush();
    expect(status()).toBe("playing:3");
    act(() => api.next());                 // 4: same file, a seek to 6.2
    expect(status()).toBe("playing:4");
    expect(audio().currentTime).toBe(6.2);
    act(() => api.next());                 // past the end: nothing happens
    expect(status()).toBe("playing:4");
  });

  it("fails on an audio error, keeps its place, and tries again on resume", async () => {
    render(<Page />);
    act(() => api.play(playlist, 3));
    await flush();
    act(() => audio().dispatchEvent(new Event("error")));
    expect(status()).toBe("failed:3");
    expect(trackEvent).toHaveBeenCalledWith("recording-failed", { reason: "audio" });
    act(() => api.resume());
    expect(audio().calls.slice(-2)).toEqual(["load", "play"]);
    await flush();
    expect(status()).toBe("playing:3");
  });

  it("reports a refused play as blocked and ignores an aborted one", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    const err = Object.assign(new Error("gesture"), { name: "NotAllowedError" });
    audio().playResult = Promise.reject(err);
    act(() => api.resume());
    await flush();
    expect(status()).toBe("failed:0");
    expect(trackEvent).toHaveBeenCalledWith("recording-failed", { reason: "blocked" });

    audio().playResult = Promise.reject(Object.assign(new Error("superseded"), { name: "AbortError" }));
    act(() => api.resume());
    await flush();
    expect(status()).toBe("loading:0");
  });

  it("pauses when the browser goes offline", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => window.dispatchEvent(new Event("offline")));
    expect(status()).toBe("paused:0");
  });

  it("close stops the audio, forgets the playlist and returns focus to the trigger", async () => {
    render(
      <Page>
        <button type="button">Play</button>
      </Page>,
    );
    const trigger = screen.getByRole("button", { name: "Play" });
    act(() => api.play(playlist, 0, trigger));
    await flush();
    act(() => api.close());
    expect(status()).toBe("closed:-");
    expect(api.playlist).toBeNull();
    expect(audio().calls.at(-1)).toBe("pause");
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps playing when the page that started it unmounts", async () => {
    function Starter() {
      const { play } = useAudioPlayer();
      return <button type="button" onClick={(e) => play(playlist, 0, e.currentTarget)}>Start</button>;
    }
    const { rerender } = render(<AudioPlayerProvider><Starter /><Probe /></AudioPlayerProvider>);
    act(() => screen.getByRole("button", { name: "Start" }).click());
    await flush();
    rerender(<AudioPlayerProvider><Probe /></AudioPlayerProvider>);
    expect(status()).toBe("playing:0");
    act(() => audio().at(9));
    expect(status()).toBe("playing:1");
    act(() => api.close());   // the trigger is gone; close must not throw
    expect(status()).toBe("closed:-");
  });

  it("sets data-audio-bar on <html> while open", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    expect(document.documentElement.hasAttribute("data-audio-bar")).toBe(true);
    act(() => api.close());
    expect(document.documentElement.hasAttribute("data-audio-bar")).toBe(false);
  });

  it("never sends a title or url to telemetry", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    for (const call of trackEvent.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/audio\.test|Fātiḥah/);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/context/__tests__/audio-player-context.test.tsx`
Expected: FAIL, cannot resolve `@/context/audio-player-context`.

- [ ] **Step 3: Write the placeholder bar and the provider**

`frontend/src/components/audio/audio-player-bar.tsx` (placeholder, replaced in Task 5):

```tsx
"use client";

export default function AudioPlayerBar() {
  return null;
}
```

`frontend/src/context/audio-player-context.tsx`:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import AudioPlayerBar from "@/components/audio/audio-player-bar";
import { RECITER_NAME } from "@/config/recitation";
import type { Clip, Playlist } from "@/lib/recitation-playlist";
import { routePattern, trackEvent } from "@/lib/telemetry";

export type AudioPlayerStatus = "closed" | "loading" | "playing" | "paused" | "failed";

export interface AudioPlayerContextValue {
  status: AudioPlayerStatus;
  playlist: Playlist | null;
  index: number | null;
  current: Clip | null;
  /**
   * Starts this clip. The current clip of the current playlist (by id) pauses while playing
   * and resumes while paused. `trigger` gets focus back when the bar closes.
   */
  play: (playlist: Playlist, index: number, trigger?: HTMLElement | null) => void;
  pause: () => void;
  /** Also the way out of `failed`: tries the same clip again. */
  resume: () => void;
  next: () => void;
  previous: () => void;
  /** Stops, forgets the playlist, hides the bar. */
  close: () => void;
  isCurrent: (ref: { chapter: number; verse: number }) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

/**
 * A clip starting within this many ms of the previous clip's end is "where it ends": the
 * audio runs on untouched, since the export pads verse boundaries by a few hundred ms and a
 * seek there would only stutter. Beyond it the player seeks (forwards over a gap, backwards
 * over an overlap).
 */
export const BOUNDARY_TOLERANCE_MS = 300;

/** Position disagreement the metadata check lets pass: the media fragment landed close enough. */
const FRAGMENT_SLACK_S = 0.5;

function url(clip: Clip): string {
  return clip.fromMs != null ? `${clip.url}#t=${clip.fromMs / 1000}` : clip.url;
}
function sameFile(a: Clip, b: Clip): boolean {
  return a.url === b.url;
}

/**
 * Owns the one Audio element for the whole site and the bar that shows what it plays. Mounted
 * in AppShell around AuthProvider, so playback survives navigation and works for anonymous
 * readers. Knows nothing about verses: it plays clips, and pages ask isCurrent(ref) to
 * highlight. The element is created on the first play, inside the reader's tap, which unlocks
 * it; later file changes on the same element may call play() outside a gesture.
 */
export default function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AudioPlayerStatus>("closed");
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mirrors of the state for the audio event handlers, which must not go stale between renders.
  const playlistRef = useRef<Playlist | null>(null);
  const indexRef = useRef<number | null>(null);
  const statusRef = useRef<AudioPlayerStatus>("closed");
  const triggerRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number>(0);
  // Each play() gets a ticket; a play promise settling for an older ticket is ignored.
  const ticketRef = useRef(0);

  const setStatusBoth = useCallback((s: AudioPlayerStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);
  const setIndexBoth = useCallback((i: number | null) => {
    indexRef.current = i;
    setIndex(i);
  }, []);
  const setPlaylistBoth = useCallback((p: Playlist | null) => {
    playlistRef.current = p;
    setPlaylist(p);
  }, []);

  const currentClip = useCallback((): Clip | null => {
    const p = playlistRef.current;
    const i = indexRef.current;
    return p && i != null ? (p.clips[i] ?? null) : null;
  }, []);

  /** Calls play() on the element and reflects the outcome once it settles. */
  const startElement = useCallback((audio: HTMLAudioElement) => {
    const ticket = ++ticketRef.current;
    audio.play().then(
      () => { /* the "playing" event sets the status */ },
      (err: unknown) => {
        if (ticket !== ticketRef.current) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "AbortError") return;
        setStatusBoth("failed");
        trackEvent("recording-failed", { reason: name === "NotAllowedError" ? "blocked" : "audio" });
      },
    );
  }, [setStatusBoth]);

  /** Loads (if needed), positions and starts the clip at `i` of the current playlist. */
  const startClip = useCallback((i: number, options: { seekOnly?: boolean } = {}) => {
    const audio = audioRef.current;
    const p = playlistRef.current;
    if (!audio || !p) return;
    const clip = p.clips[i];
    if (!clip) return;
    const previous = currentClip();
    setIndexBoth(i);

    if (previous && sameFile(previous, clip) && audio.src !== "") {
      // Same file: a seek, or nothing at all when the clip starts where the last one ended.
      const wantedS = (clip.fromMs ?? 0) / 1000;
      const drift = Math.abs(audio.currentTime - wantedS) * 1000;
      if (!options.seekOnly || drift > BOUNDARY_TOLERANCE_MS) {
        if (drift > BOUNDARY_TOLERANCE_MS) audio.currentTime = wantedS;
      }
      if (audio.paused) {
        setStatusBoth("loading");
        startElement(audio);
      }
      return;
    }

    setStatusBoth("loading");
    audio.src = url(clip);
    audio.preload = "auto";
    audio.load();
    startElement(audio);
  }, [currentClip, setIndexBoth, setStatusBoth, startElement]);

  const stopAll = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    cancelAnimationFrame(frameRef.current);
    setIndexBoth(null);
    setPlaylistBoth(null);
    setStatusBoth("closed");
  }, [setIndexBoth, setPlaylistBoth, setStatusBoth]);

  /** The position check both the frame loop and timeupdate run. */
  const checkPosition = useCallback(() => {
    const audio = audioRef.current;
    const clip = currentClip();
    const p = playlistRef.current;
    if (!audio || !clip || !p || statusRef.current !== "playing") return;
    if (clip.toMs == null) return;
    if (audio.currentTime * 1000 < clip.toMs) return;
    const i = indexRef.current ?? 0;
    if (i + 1 >= p.clips.length) {
      stopAll();
      return;
    }
    startClip(i + 1, { seekOnly: true });
  }, [currentClip, startClip, stopAll]);

  // Wire the element's events once it exists.
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audioRef.current = audio;
    audio.addEventListener("playing", () => setStatusBoth("playing"));
    audio.addEventListener("pause", () => {
      if (statusRef.current === "playing") setStatusBoth("paused");
    });
    audio.addEventListener("timeupdate", checkPosition);
    audio.addEventListener("ended", () => {
      const p = playlistRef.current;
      const i = indexRef.current;
      if (!p || i == null) return;
      if (i + 1 >= p.clips.length) stopAll();
      else startClip(i + 1);
    });
    audio.addEventListener("error", () => {
      if (statusRef.current === "closed") return;
      setStatusBoth("failed");
      trackEvent("recording-failed", { reason: "audio" });
    });
    audio.addEventListener("loadedmetadata", () => {
      // The #t= fragment usually lands the position; correct it when a browser ignores it.
      const clip = currentClip();
      if (!clip || clip.fromMs == null) return;
      const wantedS = clip.fromMs / 1000;
      if (Math.abs(audio.currentTime - wantedS) > FRAGMENT_SLACK_S) audio.currentTime = wantedS;
    });
    return audio;
  }, [checkPosition, currentClip, setStatusBoth, startClip, stopAll]);

  // The frame loop, for tight verse boundaries while the tab is visible; timeupdate covers the
  // background tab.
  useEffect(() => {
    if (status !== "playing") return;
    let active = true;
    const tick = () => {
      if (!active) return;
      checkPosition();
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [status, checkPosition]);

  // Pages that run along the bottom edge clear the bar through this attribute (globals.css).
  useEffect(() => {
    if (status === "closed") return;
    document.documentElement.setAttribute("data-audio-bar", "");
    return () => document.documentElement.removeAttribute("data-audio-bar");
  }, [status]);

  // Going offline pauses rather than fails; the reader resumes by hand.
  useEffect(() => {
    const onOffline = () => audioRef.current?.pause();
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    // A pause while still loading: the browser rejects the pending play with AbortError and
    // fires no "playing", so the "pause" handler above (which only acts on "playing") would
    // leave the bar breathing for ever.
    if (statusRef.current === "loading") setStatusBoth("paused");
  }, [setStatusBoth]);

  const resume = useCallback(() => {
    const i = indexRef.current;
    if (i == null) return;
    if (statusRef.current === "failed") {
      // Try the same clip afresh: a new load, in case the file itself failed.
      const audio = audioRef.current;
      if (audio) audio.removeAttribute("src");
      startClip(i);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    setStatusBoth("loading");
    startElement(audio);
  }, [setStatusBoth, startClip, startElement]);

  const play = useCallback((next: Playlist, i: number, trigger?: HTMLElement | null) => {
    const same = playlistRef.current?.id === next.id && indexRef.current === i && statusRef.current !== "closed";
    if (same) {
      if (statusRef.current === "playing" || statusRef.current === "loading") pause();
      else resume();
      return;
    }
    ensureAudio();
    if (trigger) triggerRef.current = trigger;
    setPlaylistBoth(next);
    trackEvent("recording-played", { route: routePattern(pathname ?? "") });
    startClip(i);
  }, [ensureAudio, pathname, pause, resume, setPlaylistBoth, startClip]);

  const next = useCallback(() => {
    const p = playlistRef.current;
    const i = indexRef.current;
    if (!p || i == null || i + 1 >= p.clips.length) return;
    startClip(i + 1);
  }, [startClip]);

  const previous = useCallback(() => {
    const i = indexRef.current;
    if (i == null || i === 0) return;
    startClip(i - 1);
  }, [startClip]);

  const close = useCallback(() => {
    stopAll();
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger && trigger.isConnected) trigger.focus();
  }, [stopAll]);

  const current = playlist && index != null ? (playlist.clips[index] ?? null) : null;

  const isCurrent = useCallback(
    (ref: { chapter: number; verse: number }) =>
      status !== "closed" && current?.ref?.chapter === ref.chapter && current?.ref?.verse === ref.verse,
    [current, status],
  );

  // Lock-screen and headset controls.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (status === "closed" || !current) {
      session.metadata = null;
      session.playbackState = "none";
      return;
    }
    session.metadata = new MediaMetadata({
      title: current.subtitle ? `${current.title}, ${current.subtitle}` : current.title,
      artist: RECITER_NAME,
      album: "Ishqnama",
    });
    session.playbackState = status === "playing" ? "playing" : "paused";
    session.setActionHandler("play", resume);
    session.setActionHandler("pause", pause);
    session.setActionHandler("nexttrack", next);
    session.setActionHandler("previoustrack", previous);
    return () => {
      for (const action of ["play", "pause", "nexttrack", "previoustrack"] as const) {
        session.setActionHandler(action, null);
      }
    };
  }, [status, current, resume, pause, next, previous]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({ status, playlist, index, current, play, pause, resume, next, previous, close, isCurrent }),
    [status, playlist, index, current, play, pause, resume, next, previous, close, isCurrent],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {status !== "closed" && <AudioPlayerBar />}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/context/__tests__/audio-player-context.test.tsx`
Expected: all 20 passing. If "corrects the position once metadata arrives" fails because the fake's `currentTime` is 4 after the fragment test, check `FRAGMENT_SLACK_S`; if "seeks when the next clip in the same file starts elsewhere" fails on `src`, make sure `startClip` never touches `src` for a same-file clip.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/audio-player-context.tsx frontend/src/context/__tests__/audio-player-context.test.tsx frontend/src/components/audio/audio-player-bar.tsx
git commit -m "Add the site-wide audio player provider with a clip queue"
```

---

### Task 5: The bar, its copy, and mounting in the app shell

**Files:**
- Modify: `frontend/src/config/audio-copy.ts` (complete it)
- Create: `frontend/src/config/__tests__/audio-copy.test.ts`
- Replace: `frontend/src/components/audio/audio-player-bar.tsx`
- Create: `frontend/src/components/audio/audio-player-bar.module.css`
- Create: `frontend/src/components/audio/__tests__/audio-player-bar.test.tsx`
- Modify: `frontend/src/app/globals.css` (`--audio-bar-height`)
- Modify: `frontend/src/components/navigation/footer.module.css`, `frontend/src/components/ui/back-to-top.module.css`, `frontend/src/components/scripture/quran-reader-client.module.css` (clearance)
- Modify: `frontend/src/components/app-shell.tsx` (mount)

**Interfaces:**
- Consumes: `useAudioPlayer()` (Task 4), `verseQuery` (Task 2), `Icon` names (Task 3), `isReaderRoute` (`@/lib/reader-route`).
- Produces: `AUDIO_COPY` keys `regionLabel, playRecitation, pause, resume, previousVerse, nextVerse, closeRecording, couldNotStart, tryAgain, playList, playFromGroup, bismillah, verse(n)`; `<html data-audio-bar>` + `--audio-bar-height: 56px`.

- [ ] **Step 1: Write the copy test**

`frontend/src/config/__tests__/audio-copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AUDIO_COPY } from "@/config/audio-copy";

// Words the reader-facing copy must never use; readers are often unfamiliar with technology.
// What the reader hears is a "recitation" or a "recording", never a "player" or a "stream".
const BANNED = /(service|\bapi\b|server|session|player|stream|audio file|\bload|buffer|download)/i;

const allStrings: string[] = Object.values(AUDIO_COPY).map((v) => (typeof v === "function" ? v(7) : v));

describe("audio copy", () => {
  it("names every control and state the bar shows", () => {
    for (const key of [
      "regionLabel", "playRecitation", "pause", "resume", "previousVerse", "nextVerse",
      "closeRecording", "couldNotStart", "tryAgain", "playList", "playFromGroup", "bismillah",
    ] as const) {
      expect(AUDIO_COPY[key].length, key).toBeGreaterThan(0);
    }
    expect(AUDIO_COPY.verse(255)).toBe("Verse 255");
  });

  it("uses no technical words", () => {
    for (const s of allStrings) expect(s, s).not.toMatch(BANNED);
  });

  it("keeps every string under twelve words", () => {
    for (const s of allStrings) expect(s.trim().split(/\s+/).length, s).toBeLessThan(12);
  });

  it("is written in sentence case", () => {
    for (const s of allStrings) {
      expect(s[0], s).toBe(s[0].toUpperCase());
      expect(s, s).not.toBe(s.toUpperCase());
      for (const word of s.trim().split(/\s+/).slice(1)) {
        const bare = word.replace(/[^\p{L}]/gu, "");
        if (!bare) continue;
        expect(bare[0] === bare[0].toUpperCase() && bare[0] !== bare[0].toLowerCase(), `${word} in "${s}"`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/config/__tests__/audio-copy.test.ts`
Expected: FAIL, `regionLabel` undefined.

- [ ] **Step 3: Complete the copy**

Replace the body of `frontend/src/config/audio-copy.ts`'s object:

```ts
export const AUDIO_COPY = {
  /** Accessible name of the bar, so a screen reader can jump to it. */
  regionLabel: "Recording",
  /** The play button on a verse, a popup and a list. */
  playRecitation: "Play recitation",
  pause: "Pause",
  resume: "Play",
  previousVerse: "Previous verse",
  nextVerse: "Next verse",
  closeRecording: "Close recording",
  couldNotStart: "This recording couldn't start.",
  tryAgain: "Try again",
  /** The list page's header button: every group in order. */
  playList: "Play",
  /** A group's own button: from this group to the end of the list. */
  playFromGroup: "Play from here",
  bismillah: "Bismillah",
  verse: (n: number) => `Verse ${n}`,
} as const;
```

- [ ] **Step 4: Write the bar test**

`frontend/src/components/audio/__tests__/audio-player-bar.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioPlayerContextValue } from "@/context/audio-player-context";

let pathname = "/quran/2/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const player: AudioPlayerContextValue = {
  status: "playing",
  playlist: {
    id: "quran/2",
    href: "/quran/2/",
    clips: [
      { url: "u", fromMs: 0, toMs: 1, title: "al-Baqarah", subtitle: "Verse 254", ref: { chapter: 2, verse: 254 } },
      { url: "u", fromMs: 1, toMs: 2, title: "al-Baqarah", subtitle: "Verse 255", ref: { chapter: 2, verse: 255 } },
    ],
  },
  index: 1,
  current: null,
  play: vi.fn(), pause: vi.fn(), resume: vi.fn(), next: vi.fn(), previous: vi.fn(), close: vi.fn(),
  isCurrent: () => false,
};
player.current = player.playlist!.clips[1];
vi.mock("@/context/audio-player-context", () => ({ useAudioPlayer: () => player }));

import AudioPlayerBar from "@/components/audio/audio-player-bar";

afterEach(() => { cleanup(); Object.assign(player, { status: "playing", index: 1, current: player.playlist!.clips[1] }); pathname = "/quran/2/"; });

describe("AudioPlayerBar", () => {
  it("is a region named Recording with the verse as a link back to its page", () => {
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region", { name: "Recording" })).toBeTruthy();
    const link = screen.getByRole("link", { name: /al-Baqarah.*Verse 255/ });
    expect(link.getAttribute("href")).toBe("/quran/2/?verse=255");
  });

  it("offers pause while playing and play while paused", () => {
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(player.pause).toHaveBeenCalled();
    cleanup();
    player.status = "paused";
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(player.resume).toHaveBeenCalled();
  });

  it("moves between verses and disables the end it is at", () => {
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Previous verse" }));
    expect(player.previous).toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Next verse" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    player.index = 0;
    player.current = player.playlist!.clips[0];
    render(<AudioPlayerBar />);
    expect((screen.getByRole("button", { name: "Previous verse" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("closes", () => {
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Close recording" }));
    expect(player.close).toHaveBeenCalled();
  });

  it("explains a failure and offers Try again", () => {
    player.status = "failed";
    render(<AudioPlayerBar />);
    expect(screen.getByText("This recording couldn't start.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(player.resume).toHaveBeenCalled();
  });

  it("marks what it clears: the toolbar on reader routes, the bottom nav elsewhere", () => {
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region").getAttribute("data-clears")).toBe("toolbar");
    cleanup();
    pathname = "/lists/view/";
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region").getAttribute("data-clears")).toBe("bottom-nav");
  });

  it("does not take focus when it appears", () => {
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region").contains(document.activeElement)).toBe(false);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run src/components/audio/__tests__/audio-player-bar.test.tsx`
Expected: FAIL, no region rendered.

- [ ] **Step 6: Write the bar and its CSS**

`frontend/src/components/audio/audio-player-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import IconButton from "@/components/ui/icon-button";
import { AUDIO_COPY } from "@/config/audio-copy";
import { useAudioPlayer } from "@/context/audio-player-context";
import { verseQuery } from "@/lib/recitation-playlist";
import { isReaderRoute } from "@/lib/reader-route";
import styles from "./audio-player-bar.module.css";

/**
 * The strip along the bottom edge while a recording plays: previous, play/pause, next, what is
 * playing (a link back to its page), close. Rendered by AudioPlayerProvider; sits above the
 * reader toolbar on reader routes and above the phone bottom nav elsewhere. Never takes
 * focus when it appears, the reader is still reading.
 */
export default function AudioPlayerBar() {
  const pathname = usePathname();
  const { status, playlist, index, current, pause, resume, next, previous, close } = useAudioPlayer();
  if (!playlist || index == null || !current) return null;

  const clears = isReaderRoute(pathname) ? "toolbar" : "bottom-nav";
  const playing = status === "playing" || status === "loading";
  const label = current.subtitle ? `${current.title} · ${current.subtitle}` : current.title;
  const href = playlist.href && current.ref ? verseQuery(current.ref, playlist.href) : playlist.href;

  return (
    <section className={styles.bar} data-clears={clears} aria-label={AUDIO_COPY.regionLabel} role="region">
      <div className={styles.inner}>
        <div className={styles.transport}>
          <IconButton icon="skipBack" label={AUDIO_COPY.previousVerse} size="sm" onClick={previous} disabled={index === 0} />
          <button
            type="button"
            className={`${styles.playPause} ${status === "loading" ? styles.breathing : ""}`}
            aria-label={playing ? AUDIO_COPY.pause : AUDIO_COPY.resume}
            onClick={playing ? pause : resume}
          >
            <IconGlyph playing={playing} />
          </button>
          <IconButton icon="skipForward" label={AUDIO_COPY.nextVerse} size="sm" onClick={next} disabled={index + 1 >= playlist.clips.length} />
        </div>

        {status === "failed" ? (
          <div className={styles.failed}>
            <span className={styles.failedText}>{AUDIO_COPY.couldNotStart}</span>
            <button type="button" className={styles.tryAgain} onClick={resume}>
              {AUDIO_COPY.tryAgain}
            </button>
          </div>
        ) : href ? (
          <Link href={href} className={styles.title}>{label}</Link>
        ) : (
          <span className={styles.title}>{label}</span>
        )}

        <IconButton icon="close" label={AUDIO_COPY.closeRecording} size="sm" onClick={close} />
      </div>
    </section>
  );
}

function IconGlyph({ playing }: { playing: boolean }) {
  // Inline so the disabled styling of IconButton never applies to the main control.
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill={playing ? "none" : "currentColor"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={playing ? "M8 5v14M16 5v14" : "M6 4l14 8-14 8z"} />
    </svg>
  );
}
```

`IconButton` has no `disabled` prop yet; add one to `frontend/src/components/ui/icon-button.tsx` (`disabled?: boolean`, passed straight to the `<button>`), which is what the bar's previous/next use above. Add to `icon-button.module.css`:

```css
.iconButton:disabled {
  opacity: 0.4;
  cursor: default;
}
```

`frontend/src/components/audio/audio-player-bar.module.css`:

```css
/* Over the bottom nav (90) and the reader toolbar (50), under the app bar (100), the menus
   (200) and the sheets (300). Full width at every size: it belongs to the page, not a corner. */
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 95;
  height: var(--audio-bar-height);
  background: var(--surface-card);
  border-top: 1px solid var(--tint-ink-12);
  animation: rise var(--duration-slow) var(--ease-out);
}

.bar[data-clears="toolbar"] {
  bottom: var(--toolbar-height);
}

@media (max-width: 640px) {
  .bar[data-clears="bottom-nav"] {
    bottom: 56px;
  }
}

.inner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: var(--max-width-page);
  height: 100%;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.transport {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.playPause {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--fill-primary);
  color: #fff;
  cursor: pointer;
}

.playPause:hover {
  background: var(--fill-primary-hover);
}

.breathing {
  animation: breathe 1.6s ease-in-out infinite;
}

.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: var(--text-base);
  color: var(--text-primary);
  text-decoration: none;
}

a.title:hover {
  color: var(--teal-primary);
}

.failed {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.failedText {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tryAgain {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--tint-teal-20);
  border-radius: var(--radius-sm);
  color: var(--teal-primary);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
}

@keyframes rise {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: none; opacity: 1; }
}

@keyframes breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

@media (prefers-reduced-motion: reduce) {
  .bar { animation: none; }
  .breathing { animation: none; }
}

@media print {
  .bar { display: none; }
}
```

Every token above exists in `globals.css` (checked: `--fill-primary`, `--fill-primary-hover`, `--tint-teal-20`, `--tint-ink-12`, `--text-sm`, `--text-base`, `--text-secondary`, `--teal-primary`, `--font-display`, `--duration-slow`, `--ease-out`, `--radius-sm`). `#fff` is allowed by the colour test (white).

- [ ] **Step 7: Clearance and mounting**

In `frontend/src/app/globals.css`, after `--toolbar-height: 56px;`:

```css
  --audio-bar-height: 56px;
```

In `frontend/src/components/navigation/footer.module.css`, after the two `data-clears` rules:

```css
/* While a recording plays, its bar sits above whichever bar runs along the bottom edge. */
html[data-audio-bar] .footer[data-clears="toolbar"] {
  padding-bottom: calc(var(--space-10) + var(--toolbar-height) + var(--audio-bar-height));
}

html[data-audio-bar] .footer[data-clears="bottom-nav"] {
  padding-bottom: calc(var(--space-10) + var(--audio-bar-height));
}

@media (max-width: 640px) {
  html[data-audio-bar] .footer[data-clears="bottom-nav"] {
    padding-bottom: calc(var(--space-10) + 56px + var(--audio-bar-height));
  }
}
```

In `frontend/src/components/ui/back-to-top.module.css`, after its `data-clears` rules:

```css
html[data-audio-bar] .button[data-clears="toolbar"] {
  bottom: calc(var(--toolbar-height) + var(--audio-bar-height) + var(--space-4));
}

html[data-audio-bar] .button[data-clears="bottom-nav"] {
  bottom: calc(var(--audio-bar-height) + var(--space-4));
}

@media (max-width: 640px) {
  html[data-audio-bar] .button[data-clears="bottom-nav"] {
    bottom: calc(56px + var(--audio-bar-height) + var(--space-4));
  }
}
```

In `frontend/src/components/scripture/quran-reader-client.module.css`, after `.versePopup`:

```css
html[data-audio-bar] .versePopup {
  bottom: calc(var(--toolbar-height) + var(--audio-bar-height) + 10px);
  max-height: calc(100dvh - var(--toolbar-height) - var(--audio-bar-height) - 20px);
}
```

In `frontend/src/components/app-shell.tsx`, import `AudioPlayerProvider from "@/context/audio-player-context"` and wrap: `<AudioPlayerProvider>` directly around `<AuthProvider>…</AuthProvider>` (inside the fragment, after `<ApiWarmupNotice />`). Update the file's doc comment to say the player is outside auth so recordings play for everyone and outlive every page.

- [ ] **Step 8: Run the tests and the colour test**

Run: `npx vitest run src/components/audio src/config src/app/__tests__/no-hardcoded-colours.test.ts src/context/__tests__/audio-player-context.test.tsx`
Expected: all passing. The provider test now renders the real bar inside the provider (it mocks `usePathname`, which the bar reads); its button names ("Pause", "Previous verse", …) do not collide with the names that test queries ("Play", "Start").

- [ ] **Step 9: Commit**

```bash
git add frontend/src/config/audio-copy.ts frontend/src/config/__tests__/audio-copy.test.ts frontend/src/components/audio frontend/src/components/ui/icon-button.tsx frontend/src/components/ui/icon-button.module.css frontend/src/app/globals.css frontend/src/components/navigation/footer.module.css frontend/src/components/ui/back-to-top.module.css frontend/src/components/scripture/quran-reader-client.module.css frontend/src/components/app-shell.tsx
git commit -m "Show the recording bar above the toolbar and mount the player site-wide"
```

---

### Task 6: Keeping the verse being read in view

**Files:**
- Create: `frontend/src/components/audio/use-follow-reading.ts`
- Test: `frontend/src/components/audio/__tests__/use-follow-reading.test.tsx`

**Interfaces:**
- Produces: `useFollowReading(current: { chapter: number; verse: number } | null | undefined): void` — when the ref changes, scrolls `#verse-<c>-<v>` to the centre only if it is outside the viewport.

- [ ] **Step 1: Write the failing test**

```tsx
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFollowReading } from "@/components/audio/use-follow-reading";

function Page({ current }: { current: { chapter: number; verse: number } | null }) {
  useFollowReading(current);
  return (
    <>
      <div id="verse-2-1">one</div>
      <div id="verse-2-2">two</div>
    </>
  );
}

const scrollIntoView = vi.fn();
function placeVerse(id: string, top: number) {
  const el = document.getElementById(id)!;
  el.scrollIntoView = scrollIntoView;
  el.getBoundingClientRect = () => ({ top, bottom: top + 40, left: 0, right: 0, width: 0, height: 40, x: 0, y: top, toJSON() {} });
}

beforeEach(() => {
  scrollIntoView.mockClear();
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useFollowReading", () => {
  it("scrolls a verse into the centre when it is below the viewport", () => {
    const { rerender } = render(<Page current={null} />);
    placeVerse("verse-2-2", 1200);
    rerender(<Page current={{ chapter: 2, verse: 2 }} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("leaves a verse alone when it is already in view", () => {
    const { rerender } = render(<Page current={null} />);
    placeVerse("verse-2-1", 300);
    rerender(<Page current={{ chapter: 2, verse: 1 }} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls without animation under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { rerender } = render(<Page current={null} />);
    placeVerse("verse-2-2", -100);
    rerender(<Page current={{ chapter: 2, verse: 2 }} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  it("does nothing for a verse that is not on this page", () => {
    const { rerender } = render(<Page current={null} />);
    act(() => rerender(<Page current={{ chapter: 3, verse: 1 }} />));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/audio/__tests__/use-follow-reading.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the hook**

`frontend/src/components/audio/use-follow-reading.ts`:

```ts
"use client";

import { useEffect } from "react";

/**
 * Keeps the verse being read on screen. When the ref changes it finds `#verse-<c>-<v>` on the
 * page and scrolls it to the centre, but only if it is outside the viewport: a reader who has
 * scrolled ahead is not pulled back every few seconds. Used by the Quran reader and the list
 * page; a page that lacks the verse simply does nothing.
 */
export function useFollowReading(current: { chapter: number; verse: number } | null | undefined): void {
  const chapter = current?.chapter;
  const verse = current?.verse;
  useEffect(() => {
    if (chapter == null || verse == null) return;
    const el = document.getElementById(`verse-${chapter}-${verse}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (inView) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }, [chapter, verse]);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/audio/__tests__/use-follow-reading.test.tsx`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/audio/use-follow-reading.ts frontend/src/components/audio/__tests__/use-follow-reading.test.tsx
git commit -m "Keep the verse being read in view"
```

---

### Task 7: Play controls and the highlight in the Quran reader

**Files:**
- Modify: `frontend/src/components/scripture/ayah-block.tsx` (`onPlay`, `isReading` props, the button)
- Modify: `frontend/src/components/scripture/ayah-block.module.css` (`.reading`)
- Modify: `frontend/src/components/scripture/quran-reader-client.tsx` (playlist, popup button, continuous highlight, follow)
- Modify: `frontend/src/components/scripture/quran-reader-client.module.css` (`.verseReading`)
- Test: `frontend/src/components/scripture/__tests__/ayah-block.test.tsx` (create)
- Test: `frontend/src/components/scripture/__tests__/quran-reader-client-recitation.test.tsx` (create)

**Interfaces:**
- Consumes: `useAudioPlayer()`, `versePlaylist`, `useFollowReading`, `AUDIO_COPY`.
- Produces: `AyahBlock` props `onPlay?: (trigger: HTMLElement) => void`, `isReading?: boolean`.

- [ ] **Step 1: Write the failing AyahBlock test**

`frontend/src/components/scripture/__tests__/ayah-block.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AyahBlock from "@/components/scripture/ayah-block";
import styles from "@/components/scripture/ayah-block.module.css";

afterEach(cleanup);

function renderBlock(props: Partial<React.ComponentProps<typeof AyahBlock>> = {}) {
  return render(<AyahBlock chapterNumber={2} number={255} arabic="ٱللَّهُ" activeLang="english" {...props} />);
}

describe("AyahBlock recitation control", () => {
  it("offers Play recitation first among the actions and hands over the button", () => {
    const onPlay = vi.fn();
    renderBlock({ onPlay });
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("aria-label")).toBe("Play recitation");
    fireEvent.click(buttons[0]);
    expect(onPlay).toHaveBeenCalledWith(buttons[0]);
  });

  it("shows Pause, pressed, and the reading wash while this verse is being read", () => {
    renderBlock({ onPlay: () => {}, isReading: true });
    const button = screen.getByRole("button", { name: "Pause" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("verse-2-255")?.classList.contains(styles.reading)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/scripture/__tests__/ayah-block.test.tsx`
Expected: FAIL, first button is "Share verse".

- [ ] **Step 3: Add the props and the button to AyahBlock**

In `ayah-block.tsx`: add `import { AUDIO_COPY } from "@/config/audio-copy";`, props `onPlay?: (trigger: HTMLElement) => void;` and `isReading?: boolean;` (default `false`), and:

```tsx
    <div id={`verse-${chapterNumber}-${number}`} className={`${styles.block} ${isReading ? styles.reading : ""}`}>
      <div className={styles.meta}>
        <div className={styles.actions}>
          {onPlay && (
            <button
              type="button"
              className={styles.playButton}
              aria-label={isReading ? AUDIO_COPY.pause : AUDIO_COPY.playRecitation}
              aria-pressed={isReading}
              onClick={(e) => onPlay(e.currentTarget)}
            >
              <Icon name={isReading ? "pause" : "play"} size={18} />
            </button>
          )}
          <IconButton icon="share" … (unchanged)
```

Import `Icon from "@/components/ui/icon"`. In `ayah-block.module.css`:

```css
/* The verse being recited */
.reading {
  background: var(--tint-teal-8);
  border-radius: var(--radius-md);
  margin: 0 calc(-1 * var(--space-3));
  padding-left: var(--space-3);
  padding-right: var(--space-3);
}

.playButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--teal-primary);
  cursor: pointer;
}

.playButton:hover,
.playButton[aria-pressed="true"] {
  background: var(--tint-teal-8);
}
```

(`IconButton` is not used for this control because its label must change with state and it carries `aria-pressed`; keep the sizing in step with `IconButton`'s `sm`.)

- [ ] **Step 4: Run the AyahBlock test**

Run: `npx vitest run src/components/scripture/__tests__/ayah-block.test.tsx`
Expected: 2 passing.

- [ ] **Step 5: Write the failing reader test**

`frontend/src/components/scripture/__tests__/quran-reader-client-recitation.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DisplayVerse } from "@/hooks/use-chapter-verses";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/quran/juz/1/",
}));
vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ mode: "verse", fontScale: 2, showTafseer: false, lang: "english", openSettings: vi.fn() }),
}));
vi.mock("@/context/bookmarks-context", () => ({
  useBookmarks: () => ({ bookmarks: [], savePosition: vi.fn(), addBookmark: vi.fn() }),
}));
vi.mock("@/context/sign-in-prompt-context", () => ({ useSignInGate: () => (fn: () => void) => fn() }));
vi.mock("@/lib/api-readiness", () => ({ useApiReadiness: () => "ready" }));
vi.mock("@/components/bookmark-picker", () => ({ default: () => null }));
vi.mock("@/components/create-bookmark-dialog", () => ({ default: () => null }));
vi.mock("@/components/reader-toolbar", () => ({ default: () => null }));
vi.mock("@/components/ui/back-to-top", () => ({ default: () => null }));

const play = vi.fn();
let reading: { chapter: number; verse: number } | null = null;
vi.mock("@/context/audio-player-context", () => ({
  useAudioPlayer: () => ({
    status: reading ? "playing" : "closed",
    current: reading ? { ref: reading } : null,
    play,
    isCurrent: (ref: { chapter: number; verse: number }) =>
      reading != null && reading.chapter === ref.chapter && reading.verse === ref.verse,
  }),
}));

import QuranReaderClient from "@/components/scripture/quran-reader-client";

const verses: DisplayVerse[] = [
  { chapterNumber: 1, number: 7, arabic: "صِرَاطَ", rukuId: 1, hasSajdah: false },
  { chapterNumber: 2, number: 0, arabic: "بِسْمِ", rukuId: 2, hasSajdah: false },
  { chapterNumber: 2, number: 1, arabic: "الٓمٓ", rukuId: 2, hasSajdah: false },
];

function renderReader() {
  return render(
    <QuranReaderClient verses={verses} loading={false} error={null} retry={() => {}} lang="english" onLangChange={() => {}} prev={null} next={null} />,
  );
}

afterEach(() => { cleanup(); play.mockClear(); reading = null; });

describe("QuranReaderClient recitation", () => {
  it("plays the page's verses from the tapped one, basmala included", () => {
    renderReader();
    const buttons = screen.getAllByRole("button", { name: "Play recitation" });
    expect(buttons).toHaveLength(2);           // verse 0 is a BismillahBlock, without actions
    fireEvent.click(buttons[1]);                // 2:1
    expect(play).toHaveBeenCalledTimes(1);
    const [playlist, index, trigger] = play.mock.calls[0];
    expect(playlist.id).toBe("/quran/juz/1/");
    expect(playlist.href).toBe("/quran/juz/1/");
    expect(playlist.clips.map((c: { ref: unknown }) => c.ref)).toEqual([
      { chapter: 1, verse: 7 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 },
    ]);
    expect(index).toBe(2);
    expect(trigger).toBe(buttons[1]);
  });

  it("washes the verse being read", () => {
    reading = { chapter: 2, verse: 1 };
    renderReader();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(document.getElementById("verse-2-1")?.className).toMatch(/reading/);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/scripture/__tests__/quran-reader-client-recitation.test.tsx`
Expected: FAIL, no "Play recitation" buttons.

- [ ] **Step 7: Wire the reader**

In `quran-reader-client.tsx`:

```tsx
import { usePathname, useSearchParams } from "next/navigation";
import { useAudioPlayer } from "@/context/audio-player-context";
import { useFollowReading } from "@/components/audio/use-follow-reading";
import { versePlaylist } from "@/lib/recitation-playlist";
import { AUDIO_COPY } from "@/config/audio-copy";
import Icon from "@/components/ui/icon";
```

Inside the component, after `const readiness = useApiReadiness();`:

```tsx
  const pathname = usePathname() ?? "";
  const { play: playClip, current: playing, isCurrent } = useAudioPlayer();

  // The whole page is the queue: tap a verse and the recitation runs to the page's end, basmala
  // included where the page shows one. Chapter 9 has no verse 0, so none is ever asked for.
  const playlist = useMemo(
    () => versePlaylist(pathname, verses.map((v) => ({ chapter: v.chapterNumber, verse: v.number })), pathname),
    [verses, pathname],
  );
  const handlePlay = useCallback((chapterNum: number, verseNum: number, trigger: HTMLElement) => {
    const index = playlist.clips.findIndex((c) => c.ref?.chapter === chapterNum && c.ref.verse === verseNum);
    if (index >= 0) playClip(playlist, index, trigger);
  }, [playlist, playClip]);
  useFollowReading(playing?.ref);
```

Verse mode: pass to `AyahBlock`:

```tsx
                      onPlay={(trigger) => handlePlay(verse.chapterNumber, verse.number, trigger)}
                      isReading={isCurrent({ chapter: verse.chapterNumber, verse: verse.number })}
```

Continuous mode: the verse span's class gains the reading wash:

```tsx
                          className={`${styles.verseSpan} ${
                            selectedVerse?.chapter === verse.chapterNumber && selectedVerse.verse === verse.number
                              ? styles.verseSelected
                              : ""
                          } ${isCurrent({ chapter: verse.chapterNumber, verse: verse.number }) ? styles.verseReading : ""}`}
```

Popup header, before the bookmark button (works for verse 0 too, except chapter 9's, which has no bismillah entry):

```tsx
                {(() => {
                  const reading = isCurrent({ chapter: selectedVerse.chapter, verse: verse.number });
                  return (
                    <button
                      type="button"
                      className={styles.popupPlay}
                      aria-label={reading ? AUDIO_COPY.pause : AUDIO_COPY.playRecitation}
                      aria-pressed={reading}
                      onClick={(e) => handlePlay(selectedVerse.chapter, verse.number, e.currentTarget)}
                    >
                      <Icon name={reading ? "pause" : "play"} size={18} />
                    </button>
                  );
                })()}
```

In `quran-reader-client.module.css`:

```css
.verseReading {
  background-color: var(--tint-teal-8);
}

.popupPlay {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--teal-primary);
  cursor: pointer;
}

.popupPlay:hover,
.popupPlay[aria-pressed="true"] {
  background: var(--tint-teal-8);
}
```

- [ ] **Step 8: Run the reader tests and the whole suite**

Run: `npx vitest run src/components/scripture`
Expected: all passing. Then `npm test`: all passing apart from the two `list-view` tests that already fail on `main` (memory note); confirm they are the same two.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/scripture
git commit -m "Play a verse's recitation from the reader and follow it as it is read"
```

---

### Task 8: Play on a verse list

**Files:**
- Modify: `frontend/src/app/lists/view/list-view.tsx` (header Play, per-group index, follow)
- Modify: `frontend/src/components/lists/list-group-card.tsx` (`onPlay` prop, caption-line button)
- Modify: `frontend/src/components/lists/list-group-card.module.css`
- Modify: `frontend/src/components/lists/arabic-passage.tsx` (verse ids, reading class)
- Modify: `frontend/src/components/lists/arabic-passage.module.css`
- Test: `frontend/src/components/lists/__tests__/arabic-passage.test.tsx` (create)
- Test: `frontend/src/components/lists/__tests__/list-group-card.test.tsx` (create or extend if present)
- Test: `frontend/src/app/lists/__tests__/list-view.test.tsx` (extend: the two tests that already fail on `main` are left as they are)

**Interfaces:**
- Consumes: `useAudioPlayer()`, `versePlaylist`, `useFollowReading`, `AUDIO_COPY`.
- Produces: `ListGroupCard` prop `onPlay?: (trigger: HTMLElement) => void`; `ArabicPassage` verse spans carry `id="verse-<c>-<v>"` and the `reading` class when `isCurrent` says so.

- [ ] **Step 1: Write the failing ArabicPassage test**

`frontend/src/components/lists/__tests__/arabic-passage.test.tsx`:

```tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArabicPassage from "@/components/lists/arabic-passage";
import styles from "@/components/lists/arabic-passage.module.css";

vi.mock("@/context/reader-settings-context", () => ({ useReaderSettings: () => ({ lang: "english", fontScale: 2 }) }));
vi.mock("@/context/audio-player-context", () => ({
  useAudioPlayer: () => ({ isCurrent: (ref: { chapter: number; verse: number }) => ref.chapter === 2 && ref.verse === 2 }),
}));

afterEach(cleanup);

describe("ArabicPassage", () => {
  it("gives every verse the reader's id and washes the one being read", () => {
    render(
      <ArabicPassage
        chapter={2}
        verses={[
          { verseNumber: 1, arabicText: "الٓمٓ", hasSajdah: false },
          { verseNumber: 2, arabicText: "ذَٰلِكَ", hasSajdah: false },
        ]}
      />,
    );
    expect(document.getElementById("verse-2-1")).not.toBeNull();
    expect(document.getElementById("verse-2-2")?.classList.contains(styles.reading)).toBe(true);
    expect(document.getElementById("verse-2-1")?.classList.contains(styles.reading)).toBe(false);
  });
});
```

(`ArabicVerseDto` in `src/types/lists.ts` is `{ verseNumber, arabicText, hasSajdah }`; the chapter comes from the `chapter` prop.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/lists/__tests__/arabic-passage.test.tsx`
Expected: FAIL, `verse-2-1` is null.

- [ ] **Step 3: Add ids and the wash to ArabicPassage**

In `arabic-passage.tsx`: `import { useAudioPlayer } from "@/context/audio-player-context";`, `const { isCurrent } = useAudioPlayer();`, and on the verse span:

```tsx
          <span
            key={key}
            id={`verse-${key}`}
            className={`${styles.verse} ${isCurrent({ chapter, verse: verse.verseNumber }) ? styles.reading : ""}`}
          >
```

In `arabic-passage.module.css`:

```css
.reading {
  background-color: var(--tint-teal-8);
}
```

Note: `ArabicPassage` is also rendered inside the "Read more" `Sheet`, so a verse may have the same id twice on the page while the sheet is open; `useFollowReading` finds the first (the card's), which is acceptable.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/components/lists/__tests__/arabic-passage.test.tsx`
Expected: passing.

- [ ] **Step 5: Write the failing ListGroupCard test**

`frontend/src/components/lists/__tests__/list-group-card.test.tsx` (add to the existing file if one exists; the mocks below mirror what such a test needs):

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ListGroupCard from "@/components/lists/list-group-card";

vi.mock("@/hooks/use-arabic-verses", () => ({ useArabicVerses: () => ({ verses: [], failed: false }) }));
vi.mock("@/lib/api-readiness", () => ({ useApiReadiness: () => "ready" }));
vi.mock("@/context/reader-settings-context", () => ({ useReaderSettings: () => ({ lang: "english", fontScale: 2 }) }));
vi.mock("@/context/audio-player-context", () => ({ useAudioPlayer: () => ({ isCurrent: () => false }) }));

afterEach(cleanup);

describe("ListGroupCard play control", () => {
  it("offers Play from here on the caption line and hands over the button", () => {
    const onPlay = vi.fn();
    render(<ListGroupCard group={{ id: "g1", chapter: 2, fromVerse: 1, toVerse: 5, caption: "Opening" }} onPlay={onPlay} />);
    const button = screen.getByRole("button", { name: "Play from here" });
    fireEvent.click(button);
    expect(onPlay).toHaveBeenCalledWith(button);
  });

  it("shows no play control when the page gives none", () => {
    render(<ListGroupCard group={{ id: "g1", chapter: 2, fromVerse: 1, toVerse: 5, caption: null }} />);
    expect(screen.queryByRole("button", { name: "Play from here" })).toBeNull();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/components/lists/__tests__/list-group-card.test.tsx`
Expected: FAIL, no such button.

- [ ] **Step 7: Add the group button and the header Play**

`list-group-card.tsx`: add prop `onPlay?: (trigger: HTMLElement) => void`, import `AUDIO_COPY`, and in `<header>` after the caption/meta:

```tsx
        {onPlay && (
          <button
            type="button"
            className={styles.play}
            aria-label={AUDIO_COPY.playFromGroup}
            onClick={(e) => onPlay(e.currentTarget)}
          >
            <Icon name="play" size={16} />
            <span>{AUDIO_COPY.playFromGroup}</span>
          </button>
        )}
```

`list-group-card.module.css`:

```css
.play {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  background: none;
  border: none;
  padding: var(--space-1) 0;
  color: var(--teal-primary);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  cursor: pointer;
}

.play:hover {
  color: var(--teal-hover);
}
```

`list-view.tsx`: import `useAudioPlayer`, `versePlaylist`, `useFollowReading`, `AUDIO_COPY`, `Icon`. After `const owner = listOwnerName(list);` (and the hooks must be called before the early `if (!list)` return, so place the hook calls near the other hooks and compute the playlist from `state`):

```tsx
  const { play: playClip, current: playing } = useAudioPlayer();
  useFollowReading(playing?.ref);
  const listForPlay = state.kind === "loaded" ? state.list : null;   // LoadState: loading | loaded { list } | missing | failed
  const playlist = useMemo(() => {
    if (!listForPlay) return null;
    const verses: { chapter: number; verse: number }[] = [];
    for (const g of listForPlay.groups) {
      for (let v = g.fromVerse; v <= g.toVerse; v++) verses.push({ chapter: g.chapter, verse: v });
    }
    return versePlaylist(`list/${listForPlay.id}`, verses, `/lists/view/?id=${listForPlay.id}`);
  }, [listForPlay]);
  const groupStart = useCallback((gi: number) => {
    let index = 0;
    for (let i = 0; i < gi; i++) {
      const g = listForPlay!.groups[i];
      index += g.toVerse - g.fromVerse + 1;
    }
    return index;
  }, [listForPlay]);
```

In the header toolbar, as the first control:

```tsx
            {playlist && playlist.clips.length > 0 && (
              <IconButton icon="play" label={AUDIO_COPY.playList} size="sm" onClick={() => playClip(playlist, 0)} />
            )}
```

(`IconButton`'s `onClick` has no event; the header button therefore passes no trigger, and focus simply stays where it is on close.)

Each group:

```tsx
          {list.groups.map((g, gi) => (
            <ListGroupCard
              key={g.id ?? `${g.chapter}-${g.fromVerse}`}
              group={g}
              onPlay={playlist ? (trigger) => playClip(playlist, groupStart(gi), trigger) : undefined}
            />
          ))}
```

- [ ] **Step 8: Extend the list-view test**

`frontend/src/app/lists/__tests__/list-view.test.tsx` already has `list(overrides)` (a published list with groups `112:1-4` and `2:1-20`), `renderPage()` (ListView inside `SignInPromptProvider` and `ListsProvider`) and mocks for `next/navigation`, `@/lib/lists-api` and the reader settings. Add, next to the other hoisted values and mocks:

```tsx
const audio = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/context/audio-player-context", () => ({
  useAudioPlayer: () => ({ status: "closed", current: null, play: audio.play, isCurrent: () => false }),
}));
```

reset it in `beforeEach` (`audio.play.mockReset();`), and add to the `describe`:

```tsx
  it("plays every group in order from the header, and from a group onwards", async () => {
    vi.mocked(getPublishedList).mockResolvedValue(list());
    renderPage();
    const header = await screen.findByRole("button", { name: "Play" });
    fireEvent.click(header);
    const [playlist, index] = audio.play.mock.calls[0];
    expect(index).toBe(0);
    expect(playlist.id).toBe("list/k3Jd9QxP2mWa");
    expect(playlist.href).toBe("/lists/view/?id=k3Jd9QxP2mWa");
    const refs = playlist.clips.map((c: { ref: { chapter: number; verse: number } }) => `${c.ref.chapter}:${c.ref.verse}`);
    expect(refs.slice(0, 5)).toEqual(["112:1", "112:2", "112:3", "112:4", "2:1"]);
    expect(refs).toHaveLength(24);

    fireEvent.click(screen.getAllByRole("button", { name: "Play from here" })[1]);
    expect(audio.play.mock.calls[1][1]).toBe(4);   // the second group starts after al-Ikhlas's four verses
  });
```

- [ ] **Step 9: Run the list tests**

Run: `npx vitest run src/components/lists src/app/lists`
Expected: the new tests pass; only the two pre-existing `list-view` failures remain.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/lists/view frontend/src/components/lists
git commit -m "Play a verse list's groups in order from the list page"
```

---

### Task 9: Fetch and upload scripts, infra docs, privacy and about pages, CLAUDE.md

**Files:**
- Create: `frontend/scripts/fetch-recitation.mjs`
- Create: `frontend/scripts/upload-recitation.mjs`
- Modify: `frontend/package.json` (two scripts)
- Modify: `infra/README.md` (new section "Recitation audio on R2")
- Modify: `frontend/src/app/privacy/page.tsx` ("Recordings" section)
- Modify: `frontend/src/app/about/page.tsx` (credit)
- Modify: `CLAUDE.md` (a **Recitation audio** bullet under Frontend)

**Interfaces:**
- Produces: `npm run recitation:fetch`, `npm run recitation:upload`.

- [ ] **Step 1: The fetch script**

`frontend/scripts/fetch-recitation.mjs`:

```js
// Downloads the 114 chapter files of the recitation from Tarteel's CDN into
// audio/.tarteel/mp3/, using the audio_url of each chapter in the QUL export's surah.json.
// A file whose size already matches the CDN's Content-Length is skipped, so the script can be
// rerun after an interruption. About 1.8 GB in all; al-Baqarah alone is 155 MB.
//
// Usage: node scripts/fetch-recitation.mjs   (from frontend/)
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SURAH_JSON = path.resolve("../audio/.tarteel/export/surah.json");
const OUT_DIR = path.resolve("../audio/.tarteel/mp3");

const surahs = JSON.parse(await readFile(SURAH_JSON, "utf8"));
await mkdir(OUT_DIR, { recursive: true });

let bytes = 0;
for (const chapter of Object.keys(surahs).map(Number).sort((a, b) => a - b)) {
  const url = surahs[chapter].audio_url;
  const file = path.join(OUT_DIR, `${String(chapter).padStart(3, "0")}.mp3`);
  const head = await fetch(url, { method: "HEAD" });
  if (!head.ok) throw new Error(`${url}: ${head.status}`);
  const expected = Number(head.headers.get("content-length"));
  const existing = await stat(file).then((s) => s.size, () => -1);
  if (existing === expected) {
    console.log(`${chapter}: already here (${(expected / 1e6).toFixed(1)} MB)`);
    continue;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length !== expected) throw new Error(`${url}: got ${body.length} bytes, expected ${expected}`);
  await writeFile(file, body);
  bytes += body.length;
  console.log(`${chapter}: ${(body.length / 1e6).toFixed(1)} MB`);
}
console.log(`done, ${(bytes / 1e9).toFixed(2)} GB fetched`);
```

- [ ] **Step 2: The upload script**

`frontend/scripts/upload-recitation.mjs`:

```js
// Syncs the fetched chapter files to the R2 bucket behind https://audio.ishqnama.com with
// rclone, after rebuilding the timings so a bad export is never uploaded. Needs rclone on the
// path and a remote named "r2" configured with an R2 API token (Object Read & Write on the
// ishqnama-audio bucket only); see infra/README.md, "Recitation audio on R2".
//
// Usage: node scripts/upload-recitation.mjs   (from frontend/)
import { spawnSync } from "node:child_process";
import path from "node:path";

const RECITATION_ID = "abdul-basit-murattal";
const VERSION = 1;
const SOURCE = path.resolve("../audio/.tarteel/mp3");
const TARGET = `r2:ishqnama-audio/recitations/v${VERSION}/${RECITATION_ID}`;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.error || r.status !== 0) {
    console.error(`${cmd} ${args.join(" ")} failed`);
    process.exit(r.status ?? 1);
  }
}

const probe = spawnSync("rclone", ["listremotes"], { encoding: "utf8", shell: process.platform === "win32" });
if (probe.error || probe.status !== 0) {
  console.error("rclone is not installed or not on the path: https://rclone.org/install/");
  process.exit(1);
}
if (!probe.stdout.split(/\r?\n/).includes("r2:")) {
  console.error('no rclone remote named "r2"; see infra/README.md, "Recitation audio on R2"');
  process.exit(1);
}

run("node", ["scripts/build-recitation-timings.mjs"]);
run("rclone", [
  "sync", SOURCE, TARGET,
  "--checksum",
  "--header-upload", "Cache-Control: public, max-age=31536000, immutable",
  "--progress",
]);
console.log(`synced to ${TARGET}`);
```

`package.json` scripts, after `recitation:test`:

```json
    "recitation:fetch": "node scripts/fetch-recitation.mjs",
    "recitation:upload": "node scripts/upload-recitation.mjs"
```

- [ ] **Step 3: Run the fetch (one-off, ~1.8 GB) and check the scripts**

Run: `npm run recitation:fetch` (expect 114 lines and a final total near 1.8 GB; 001, 002 and 114 already present from the investigation are reported as "already here"). Run `npm run recitation:upload` only after the bucket exists (Step 4); until then expect it to stop at the rclone check with the README pointer.

- [ ] **Step 4: Document the R2 setup**

Add to `infra/README.md` after section 8 ("Custom domains"):

```markdown
## Recitation audio on R2

The Quran recitation (Abdul Basit Abdul Samad, murattal, from Tarteel's Quranic Universal
Library resource 408) is served from one Cloudflare R2 bucket shared by every environment.
Nothing here is Terraform: the Cloudflare workspace pins provider 4.x, which has no R2 custom
domain or CORS resource, and the bucket is set up once by hand.

1. R2 → Create bucket `ishqnama-audio`: location Automatic, Standard storage. Leave the
   public `r2.dev` URL off.
2. Bucket → Settings → Custom Domains → Add `audio.ishqnama.com` (zone `ishqnama.com`).
   Cloudflare creates the DNS record itself and it is **proxied** (orange cloud): the one
   record in the zone that is not DNS-only, and it must stay that way, because R2 custom
   domains only work through the proxy.
3. Bucket → Settings → CORS policy:

   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["Range"],
      "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"], "MaxAgeSeconds": 86400 }]
   ```

   The content is public and read-only, so any origin may read it.
4. R2 → Manage R2 API tokens → Create: Object Read & Write, this bucket only. Put it in the
   owner's `rclone` config as a remote named `r2` (`rclone config`, type `s3`, provider
   `Cloudflare`, the token's access key and secret, endpoint
   `https://<account id>.r2.cloudflarestorage.com`). It is never in CI or the repository.
5. From `frontend/`: `npm run recitation:fetch` (once, 1.8 GB from Tarteel's CDN into
   `audio/.tarteel/mp3/`), then `npm run recitation:upload`. Files land at
   `/recitations/v1/abdul-basit-murattal/001.mp3` … `114.mp3` with a one-year `immutable`
   cache header; a changed recording goes under `/v2/` with `version: 2` in the timings.

Release prerequisites: confirm Tarteel's terms allow hosting this recording, and keep the
credit to the reciter and QUL on the About page.

Cost: about 1.8 GB of the free 10 GB, free egress, reads far under the free 10 million a
month.
```

- [ ] **Step 5: Privacy and About pages**

`privacy/page.tsx`, before `<h2>How the site is used</h2>`:

```tsx
          <h2>Recordings</h2>
          <p>
            The recitation you can play on a verse comes from Ishqnama&apos;s own
            storage, served through Cloudflare, which sees the request the way any
            web host does. Nothing is fetched until you press Play.
          </p>
```

`about/page.tsx`, after the "About the Mufassir" paragraph:

```tsx
          <h2>About the recitation</h2>
          <p>
            The recitation you can play alongside each verse is by Qari Abdul
            Basit Abdul Samad, in the murattal style, from Tarteel&apos;s Quranic
            Universal Library.
          </p>
```

- [ ] **Step 6: CLAUDE.md**

Under **Frontend** in `CLAUDE.md`, after the **Sharing a verse** bullet, add a **Recitation audio** bullet summarising: the site-wide `AudioPlayerProvider` (`src/context/audio-player-context.tsx`, mounted around `AuthProvider`) with its content-agnostic `Clip`/`Playlist` queue and the bar above the toolbar; `src/lib/recitation-playlist.ts` builders; the bundled timings in `src/data/recitations/` generated by `npm run recitation:build` from the QUL export with the al-Fatiha remap and the basmala rule; the R2 bucket, `audio.ishqnama.com`, versioned paths and `npm run recitation:fetch` / `recitation:upload`; the `data-audio-bar` clearance attribute; copy in `src/config/audio-copy.ts`; the timing debt in `plans/recitation-timing-issues.md`; design in `plans/frontend-recitation-audio-spec.md`. Keep it one dense paragraph in the file's existing style.

- [ ] **Step 7: Build and commit**

Run (from `frontend/`): `npm run build`
Expected: the static export succeeds. Then:

```bash
git add frontend/scripts/fetch-recitation.mjs frontend/scripts/upload-recitation.mjs frontend/package.json infra/README.md frontend/src/app/privacy/page.tsx frontend/src/app/about/page.tsx CLAUDE.md
git commit -m "Fetch and upload the recitation files, and document the R2 setup"
```

---

### Task 10: Verification on a real browser and phone

**Files:** none (manual).

- [ ] **Step 1: Create the bucket, domain and CORS rule** following the README section (owner action), then `npm run recitation:upload`.

- [ ] **Step 2: Local run**

From `frontend/`: `npm run dev` (if port 3000 is held by a stale server, stop it first). Open `http://localhost:3000/quran/1/`:
- Play on 1:1: the bar appears above the toolbar, 1:1 washes, then 1:2 … 1:7; al-Fatiha 1:6 ends on "عليهم" and 1:7 starts on "غير"; the bar closes after 1:7.
- Play on 1:0 (bismillah) via continuous mode: tap the basmala, Play in the popup.

Open `/quran/juz/1/`: play 1:7; the bar should move to 2:0 (basmala from `001.mp3`), then switch to `002.mp3` for 2:1 and continue. Open `/quran/9/`: no verse 0, playback starts at 9:1.

Open `/quran/19/` and play 19:1: the overlap seeks back at the boundary (expected per the issues catalogue).

Navigate to `/library/` while playing: the bar stays and its title links back to the verse.

- [ ] **Step 3: Phone**

On a phone against dev.ishqnama.com after the deploy: play a verse, lock the screen, check the lock-screen title and that pause/next work; switch tabs and come back; check the bar clears the bottom nav on `/lists/view/?id=…` and the toolbar on a reader page.

- [ ] **Step 4: Record what was checked** in the PR description, including any timing boundary that sounded wrong, appended to `plans/recitation-timing-issues.md`.
