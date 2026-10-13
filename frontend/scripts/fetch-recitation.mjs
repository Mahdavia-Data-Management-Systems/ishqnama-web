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
