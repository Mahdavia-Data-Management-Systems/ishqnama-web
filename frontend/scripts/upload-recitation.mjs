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
