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
