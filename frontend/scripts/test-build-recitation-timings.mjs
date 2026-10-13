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
