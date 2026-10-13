// Run: node --test scripts/test-upload-recitation.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { missingChapters } from "./upload-recitation.mjs";

async function folderWith(chapters) {
  const dir = await mkdtemp(path.join(tmpdir(), "recitation-"));
  for (const c of chapters) await writeFile(path.join(dir, `${String(c).padStart(3, "0")}.mp3`), "x");
  return dir;
}

test("reports nothing when all 114 chapter files are present", async () => {
  const dir = await folderWith(Array.from({ length: 114 }, (_, i) => i + 1));
  assert.deepEqual(await missingChapters(dir), []);
});

test("names every chapter whose file is missing, in order", async () => {
  const dir = await folderWith([1, 2, 114]);
  const missing = await missingChapters(dir);
  assert.equal(missing.length, 111);
  assert.deepEqual(missing.slice(0, 3), [3, 4, 5]);
  assert.equal(missing[missing.length - 1], 113);
});

test("treats a folder that does not exist as missing everything", async () => {
  const missing = await missingChapters(path.join(tmpdir(), "no-such-recitation-folder"));
  assert.equal(missing.length, 114);
});
