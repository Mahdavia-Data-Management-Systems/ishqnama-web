// Syncs the fetched chapter files to the R2 bucket behind https://audio.ishqnama.com with
// rclone, after rebuilding the timings so a bad export is never uploaded. Needs rclone on the
// path and a remote named "r2" configured with an R2 API token (Object Read & Write on the
// ishqnama-audio bucket only); see infra/README.md, "Recitation audio on R2".
//
// `rclone sync` makes the bucket match the local folder, deletions included, so the sync only
// runs when all 114 chapter files are present locally: a thinned-out folder (the files are
// 1.8 GB and may be deleted to free space) can never delete the recitation from the bucket.
//
// Usage: node scripts/upload-recitation.mjs   (from frontend/)
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RECITATION_ID = "abdul-basit-murattal";
const VERSION = 1;
const CHAPTERS = 114;
const SOURCE = path.resolve("../audio/.tarteel/mp3");
const TARGET = `r2:ishqnama-audio/recitations/v${VERSION}/${RECITATION_ID}`;

/** Chapter numbers whose `NNN.mp3` is not in `dir`; every chapter when the folder is absent. */
export async function missingChapters(dir) {
  const present = new Set(await readdir(dir).catch(() => []));
  const missing = [];
  for (let c = 1; c <= CHAPTERS; c++) {
    if (!present.has(`${String(c).padStart(3, "0")}.mp3`)) missing.push(c);
  }
  return missing;
}

// No shell: with one, Node joins the arguments unquoted on Windows, and the repository path
// (which has spaces) and the Cache-Control header would reach rclone as several arguments.
// rclone and node are executables, so they are found on the path without a shell.
function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.error || r.status !== 0) {
    console.error(`${cmd} ${args.join(" ")} failed`);
    process.exit(r.status ?? 1);
  }
}

async function main() {
  const missing = await missingChapters(SOURCE);
  if (missing.length) {
    console.error(
      `${missing.length} of ${CHAPTERS} chapter files are missing from ${SOURCE} (${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}); ` +
        "not syncing, since that would delete them from the bucket. Run `npm run recitation:fetch` first.",
    );
    process.exit(1);
  }

  const probe = spawnSync("rclone", ["listremotes"], { encoding: "utf8" });
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
    // The bucket is made by hand (infra/README.md); rclone must never try to create one, which
    // it otherwise does when a bucket-scoped token cannot answer its existence check.
    "--s3-no-check-bucket",
    "--header-upload", "Cache-Control: public, max-age=31536000, immutable",
    "--progress",
  ]);
  console.log(`synced to ${TARGET}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
