---
name: onboarding-tarteel-audio
description: Use when a Quran recitation package from Tarteel's Quranic Universal Library (QUL) arrives (a zip holding surah.json and segments.json, no audio) for a new reciter or a corrected export, and the site needs the chapter files served from the audio bucket and the verse timings bundled in the app
---

# Onboarding Tarteel audio

## Overview

A QUL surah-by-surah recitation is a zip of two JSON files and no audio:
`surah.json` names the 114 chapter files on Tarteel's CDN and
`segments.json` gives every verse's start and end in them.
`frontend/scripts/onboard_recitation.py` does the work: it unpacks the
package, checks it, writes the URL manifest that `sync-audio.yml` streams
into the R2 bucket straight from Tarteel's CDN (the MP3s, about 1.8 GB,
never touch the repo or the owner's machine), and writes the verse timings
module the app bundles. Your part is what the script cannot do: ask where
the package is and what the recitation is called, run the script, read
its report, add a new reciter to the settings list, and run the tests.

Standard-library Python 3, no venv, no network.

## Steps

1. Ask the user for these before anything else runs, in one message.
   There is no folder packages arrive in: the user keeps them anywhere on
   the machine (`.ishqnama/audio/tarteel/` is a fine place; it is
   gitignored scratch, and the script unpacks there).
   - **The path of the package zip.** Required. Ask for it even when a
     file with a likely name is lying around; never guess.
   - **The recitation's id.** Required. It names the bucket folder, the
     module and the reader's saved `reciter` setting, so it never changes
     once released: lowercase words of letters and digits joined by
     single hyphens, reciter then style, like `abdul-basit-murattal`.
     A corrected export of a reciter already on the site reuses that id.
   - **For a new reciter, the two names** the settings sheet and the lock
     screen show: `name` ("Abdul Basit Abdul Samad - Murattal") and
     `reciter` ("Abdul Basit Abdul Samad").

   A request that already states any of these is not asked for them
   again. Ask with `AskUserQuestion` when it is available, else in chat,
   and wait for the answer. Quote the path in the command; it may hold
   spaces.
2. Run, from `frontend/`:

   ```
   python scripts/onboard_recitation.py "<path of the zip>" --id <id>
   ```

   It checks everything before writing anything: the zip holds both files,
   every chapter has an `https` URL ending in `/NNN.mp3` for its number
   (the bucket file is named after the URL and the app asks for
   `NNN.mp3`), every chapter has the verse count the app expects, chapter
   1 is in Tarteel's shape (its 1:7 has nine word segments, since Tarteel's
   1:1 is the basmala and the script remaps al-Fatiha to our numbering),
   and every verse starts before it ends. Then it writes:
   - `audio/recitations/<id>/v<N>/.tarteel.json`: the 114 URLs in chapter
     order, which `sync-audio.yml` streams into the bucket at
     `/recitations/<id>/v<N>/NNN.mp3` under a one-year immutable cache
     header on the next `cloudflare-release.yml` run.
   - `frontend/src/data/recitations/<id>.ts`: the timings, `version: N`.

   The script picks `N`: 1 for a first release; the latest released
   version when the package's URLs equal its manifest (a corrected timing
   changes only the module, the bucket folder is already right); the next
   number otherwise, so the old folder stays for readers whose caches hold
   it. Never choose a version, rename a folder or edit a released manifest
   yourself.
3. Read what it prints: the version and why, the two files, and the
   overlapping verse pairs in the export (a verse starting before the
   previous one ended). Overlaps are copied as they are, not fixed; the
   known ones for Abdul Basit are catalogued in
   `plans/recitation-timing-issues.md`. A new reciter's overlaps belong in
   a section of that file; a known reciter's should match the catalogue.
4. For a new reciter, add a row to `RECITATIONS` in
   `frontend/src/config/recitation.ts` importing the new module (the
   generated export is the id in upper snake case, `ABDUL_BASIT_MURATTAL`).
   The first row stays the default; the backend's `UserSettingsDto`
   defaults `reciter` to its id, so changing the default is a backend
   change too. A corrected export of a known reciter needs no code change.
5. Run the tests, from `frontend/`:

   ```
   python -m unittest scripts/test_onboard_recitation.py
   npm test
   ```

   `npm test` covers the checked-in timings against the chapter data and
   the URL the player builds.
6. Report: the id, the version and whether it was kept or new, the two
   written paths, the overlap count (and, for a new reciter, the largest
   few), and that the bucket fills on the next `cloudflare-release.yml`
   run from the Actions tab, after which Play on any verse uses the new
   files. The new files are untracked until the user commits them; the
   skill does not commit.

## Common mistakes

| Mistake | Instead |
|---|---|
| Running the script on a zip you found, or on a path from an earlier onboarding, without asking | Ask the user for the package's path first, every time it is not in the request |
| Making up an id from the zip's name (`surah-recitation-abdul-basit-abd-us-samad-murattal`) | The id is the user's choice and a saved setting; ask |
| Downloading the MP3s, or uploading anything with `rclone` | The manifest is the release; `sync-audio.yml` streams the files from Tarteel's CDN |
| Choosing a version, moving a manifest into another `v<N>` folder, or editing one that is released | The script versions; a change is another run |
| Hand-editing the timings module to fix an overlap | It is generated; overlaps are catalogued debt, fixed at the source in a later export |
| Unpacking the zip somewhere and pointing the script at `segments.json` | The script takes the zip and unpacks it into `.ishqnama/audio/tarteel/<package name>/` |
| Committing the unpacked files or the zip | Only the manifest and the module belong in the repo |

Only surah-by-surah packages (one file per chapter, an `audio_url` per
chapter in `surah.json`) are supported; anything else fails the checks.
