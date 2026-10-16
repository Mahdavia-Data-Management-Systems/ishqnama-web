"""Onboards a surah-by-surah Quran recitation from Tarteel's Quranic Universal Library (QUL).

Input: the QUL package zip (downloaded with the owner's QUL account), which holds two JSON files
and no audio:
  - surah.json:    114 entries keyed by chapter, each with the chapter file's `audio_url`
  - segments.json: 6,236 entries keyed "c:v" with timestamp_from / timestamp_to in ms and word
                   `segments` [[position, from, to], ...]

Output, both checked in:
  - audio/recitations/<id>/v<N>/.tarteel.json   the 114 audio URLs in chapter order. sync-audio.yml
                                                streams each one the bucket lacks straight from
                                                Tarteel's CDN into recitations/<id>/v<N>/NNN.mp3
                                                under a one-year immutable cache header, so a
                                                folder there never changes in place
  - frontend/src/data/recitations/<id>.ts       the verse timings the app bundles, `version: N`

The version is chosen here: the first release is v1; a package whose URLs equal the latest
released manifest keeps that version (a corrected timing is a new module, not a new folder);
any other change takes the next number. The package is unpacked into
.ishqnama/audio/tarteel/<package name>/ (gitignored scratch) and read from there.

Ishqnama numbers the basmala as verse 0 of every chapter except 9; Tarteel has it only as 1:1.
See plans/frontend-recitation-audio-spec.md ("Tarteel's numbering differs") and
plans/recitation-timing-issues.md for the export's known overlaps, which are reported but copied
as they are.

Usage (from frontend/, standard library only, no venv):
    python scripts/onboard_recitation.py "<package.zip>" --id abdul-basit-murattal
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AUDIO_ROOT = REPO_ROOT / "audio" / "recitations"
DATA_DIR = REPO_ROOT / "frontend" / "src" / "data" / "recitations"
WORK_ROOT = REPO_ROOT / ".ishqnama" / "audio" / "tarteel"
MANIFEST_NAME = ".tarteel.json"
ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# Verse counts of every chapter in Ishqnama's numbering (the basmala, verse 0, not counted).
CHAPTER_VERSE_COUNTS = {
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
}


class OnboardingError(Exception):
    """Something in the package or the request that must be fixed before anything is written."""


def check_id(recitation_id: str) -> None:
    """The id names the bucket folder, the module and the reader's saved `reciter` setting."""
    if not ID_PATTERN.match(recitation_id):
        raise OnboardingError(
            f"id {recitation_id!r} must be lowercase words of letters and digits joined by single hyphens, "
            "like abdul-basit-murattal"
        )


def export_name(recitation_id: str) -> str:
    return recitation_id.replace("-", "_").upper()


def remap_al_fatiha(rows: list[dict]) -> tuple[list[list[int]], list[int]]:
    """Tarteel: 1:1 basmala, 1:2-1:6 our 1:1-1:5, 1:7 nine words = our 1:6 (words 1-4) + 1:7 (words 5-9)."""
    by_verse = {r["verse"]: r for r in rows}
    v7 = by_verse.get(7)
    if v7 is None or len(v7["words"]) != 9:
        found = len(v7["words"]) if v7 else "no verse"
        raise OnboardingError(f"1:7 should have 9 word segments, found {found}")
    out = [[v - 1, by_verse[v]["from"], by_verse[v]["to"]] for v in range(2, 7)]
    out.append([6, v7["words"][0][1], v7["words"][3][2]])
    out.append([7, v7["words"][4][1], v7["words"][8][2]])
    basmala = by_verse[1]
    return out, [basmala["from"], basmala["to"]]


def build_timings(segments: dict, counts: dict[int, int]) -> dict:
    """The timings table from a parsed segments.json: `basmala` [from, to] inside chapter 1's
    file, `chapters` (index 0 is chapter 1, rows [verse, fromMs, toMs]) and `overlaps`, the
    (ms, chapter, verse) of every verse starting before the previous one ended, largest first.
    `counts` is the verse count per chapter in Ishqnama's numbering."""
    by_chapter: dict[int, list[dict]] = {}
    for key, e in segments.items():
        c, v = (int(x) for x in key.split(":"))
        by_chapter.setdefault(c, []).append(
            {"verse": v, "from": e["timestamp_from"], "to": e["timestamp_to"], "words": e["segments"]}
        )

    chapter_numbers = sorted(counts)
    chapters: list[list[list[int]]] = [[] for _ in range(chapter_numbers[-1])]
    basmala = None
    overlaps: list[tuple[int, int, int]] = []

    for c in chapter_numbers:
        rows = sorted(by_chapter.get(c, []), key=lambda r: r["verse"])
        expected = counts[c]
        if len(rows) != expected:
            raise OnboardingError(f"chapter {c}: expected {expected} verses, found {len(rows)}")
        if c == 1:
            ours, basmala = remap_al_fatiha(rows)
        else:
            ours = [[r["verse"], r["from"], r["to"]] for r in rows]
        prev_to = None
        for v, from_ms, to_ms in ours:
            if not from_ms < to_ms:
                raise OnboardingError(f"{c}:{v}: from {from_ms} is not before to {to_ms}")
            if prev_to is not None and from_ms < prev_to:
                overlaps.append((prev_to - from_ms, c, v))
            prev_to = to_ms
        chapters[c - 1] = ours

    if basmala is None:
        raise OnboardingError("chapter 1 did not yield the basmala span")
    overlaps.sort(key=lambda o: -o[0])
    return {"basmala": basmala, "chapters": chapters, "overlaps": overlaps}


def audio_urls(surahs: dict, counts: dict[int, int]) -> list[str]:
    """The chapter files' URLs in chapter order. Each must end in /NNN.mp3 for its chapter:
    sync-audio.yml names the bucket file after the URL, and the app asks for NNN.mp3."""
    by_chapter = {int(k): v for k, v in surahs.items()}
    urls = []
    for c in sorted(counts):
        url = (by_chapter.get(c) or {}).get("audio_url")
        if not url:
            raise OnboardingError(f"surah.json: no audio_url for chapter {c}")
        if not url.startswith("https://"):
            raise OnboardingError(f"chapter {c}: {url} is not an https URL")
        if not url.endswith(f"/{c:03d}.mp3"):
            raise OnboardingError(f"chapter {c}: {url} must end in /{c:03d}.mp3")
        urls.append(url)
    return urls


def choose_version(recitation_dir: Path, urls: list[str]) -> tuple[int, int | None]:
    """(version to write, latest released version or None). A package whose URLs equal the
    latest release's keeps its version; any other change takes the next number."""
    released = {}
    if recitation_dir.is_dir():
        for folder in recitation_dir.iterdir():
            m = re.fullmatch(r"v(\d+)", folder.name)
            manifest = folder / MANIFEST_NAME
            if m and manifest.is_file():
                released[int(m.group(1))] = manifest
    if not released:
        return 1, None
    latest = max(released)
    if json.loads(released[latest].read_text(encoding="utf-8")) == urls:
        return latest, latest
    return latest + 1, latest


def render_timings(recitation_id: str, version: int, timings: dict) -> str:
    rows = "\n".join(
        "    [" + ",".join(f"[{v},{f},{t}]" for v, f, t in chapter) + "]," for chapter in timings["chapters"]
    )
    basmala_from, basmala_to = timings["basmala"]
    return (
        "// Generated by scripts/onboard_recitation.py from Tarteel's QUL export, through the\n"
        "// onboarding-tarteel-audio skill. Do not edit by hand; onboard the package again. Rows are\n"
        "// [verse, fromMs, toMs] inside the chapter's file; the basmala (verse 0 of every chapter but 9)\n"
        "// is the span in chapter 1's file.\n"
        'import type { RecitationTimings } from "@/lib/recitation-playlist";\n'
        "\n"
        f"export const {export_name(recitation_id)}: RecitationTimings = {{\n"
        f"  id: {json.dumps(recitation_id)},\n"
        f"  version: {version},\n"
        f"  basmala: [{basmala_from}, {basmala_to}],\n"
        "  chapters: [\n"
        f"{rows}\n"
        "  ],\n"
        "};\n"
    )


def unpack(package: Path, work_root: Path) -> tuple[dict, dict]:
    """Unpacks surah.json and segments.json (wherever they sit in the zip) into
    work_root/<package name>/ and returns them parsed."""
    if not package.is_file():
        raise OnboardingError(f"{package} is not a file")
    if not zipfile.is_zipfile(package):
        raise OnboardingError(f"{package} is not a zip package")
    work_dir = work_root / package.stem
    found = {}
    with zipfile.ZipFile(package) as z:
        for name in ("surah.json", "segments.json"):
            members = [m for m in z.namelist() if m.rsplit("/", 1)[-1] == name]
            if not members:
                raise OnboardingError(f"{package.name}: no {name} in the package")
            work_dir.mkdir(parents=True, exist_ok=True)
            target = work_dir / name
            target.write_bytes(z.read(members[0]))
            found[name] = json.loads(target.read_text(encoding="utf-8"))
    return found["surah.json"], found["segments.json"]


def onboard(
    package: Path,
    recitation_id: str,
    audio_root: Path = AUDIO_ROOT,
    data_dir: Path = DATA_DIR,
    work_root: Path = WORK_ROOT,
    counts: dict[int, int] = CHAPTER_VERSE_COUNTS,
) -> dict:
    """Checks the package end to end, then writes the manifest and the module. Nothing is
    written when a check fails. Returns the report: version, previous_version, manifest,
    module, chapters, overlaps."""
    check_id(recitation_id)
    surahs, segments = unpack(package, work_root)
    urls = audio_urls(surahs, counts)
    timings = build_timings(segments, counts)
    recitation_dir = audio_root / recitation_id
    version, previous = choose_version(recitation_dir, urls)

    manifest = recitation_dir / f"v{version}" / MANIFEST_NAME
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(urls, indent=2) + "\n", encoding="utf-8", newline="\n")
    module = data_dir / f"{recitation_id}.ts"
    module.parent.mkdir(parents=True, exist_ok=True)
    module.write_text(render_timings(recitation_id, version, timings), encoding="utf-8", newline="\n")

    return {
        "version": version,
        "previous_version": previous,
        "manifest": manifest,
        "module": module,
        "chapters": len(timings["chapters"]),
        "overlaps": timings["overlaps"],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Onboard a Tarteel QUL surah-by-surah recitation package.")
    parser.add_argument("package", help="path of the QUL package zip")
    parser.add_argument(
        "--id", required=True, dest="recitation_id",
        help="the recitation's id, like abdul-basit-murattal: the bucket folder, the module name and the saved setting",
    )
    args = parser.parse_args(argv)
    try:
        report = onboard(Path(args.package), args.recitation_id)
    except OnboardingError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    def rel(p: Path) -> str:
        try:
            return p.relative_to(REPO_ROOT).as_posix()
        except ValueError:
            return str(p)

    kept = report["previous_version"] == report["version"]
    print(f"version: v{report['version']}" + (" (same URLs as the latest release, kept)" if kept else
          "" if report["previous_version"] is None else f" (after v{report['previous_version']})"))
    print(f"wrote {rel(report['manifest'])}")
    print(f"wrote {rel(report['module'])} ({report['chapters']} chapters)")
    overlaps = report["overlaps"]
    if overlaps:
        print(f"{len(overlaps)} overlapping verse pairs in the export (see plans/recitation-timing-issues.md):")
        for ms, c, v in overlaps:
            print(f"  {c}:{v - 1} -> {c}:{v}  {ms / 1000:.2f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
