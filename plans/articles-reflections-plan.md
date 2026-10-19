# Articles: reflections (podcast recordings on an essay)

**Status: implemented 2026-10-16 (sections 1–6 and 8); section 7, the UI, is a separate later
piece of work.** The decisions at the end were confirmed with the user. One change from the draft:
a podcast recording need not belong to an essay at all (some stand alone and play elsewhere on
the site), so `url` is any released timeline's path under `/podcasts/`, not only one under
`articles/nooreimaan/`, and `--attach` takes a timeline anywhere under `audio/podcasts/`. Supersedes the recording parts of
`plans/articles-recordings-spec.md` (the separate `nooreimaan-recordings.json` manifest, the
private `ishqnama-recordings` bucket, the Worker and the signed links). That spec is older than
the podcast work and is background only; nothing in it is built.

## Goal

Each Noor e Imaan essay can carry one or more **reflections**: the Hamza and Zoya podcast
recordings already onboarded through `.claude/skills/onboarding-podcast-audio/` and released into
`audio/podcasts/articles/nooreimaan/`. The essay JSON gains one root property, `reflections`, an
array of objects, one per recording. A recording is associated with an essay after it has been
onboarded and released, and an essay may have several.

## 1. The data shape

In every file in `backend/src/Ishqnama.Application/Articles/NoorEImaan/`, after `blocks`:

```json
{
 "slug": "naskh",
 "urduTitle": "نسخ",
 "blocks": [ … ],
 "reflections": [
  {
   "title": "نسخ",
   "caption": "Naskh (abrogation)",
   "description": "A short brief on why the Mahdavi reading admits no abrogated verse.",
   "url": "articles/nooreimaan/naskh/naskh.timeline.v1.json"
  }
 ]
}
```

Each essay's recordings live in a folder named after its slug under `audio/podcasts/articles/nooreimaan/`
(all of hazf's in `hazf/`), which `--release --article <slug>` chooses; the flat layout the first
releases used was reorganised on 2026-10-19.

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | What the reader sees before pressing Play, in the recording's own script. Defaults to the timeline's `title`. |
| `caption` | no | One line under the title. Defaults to the timeline's `caption`. |
| `description` | no | A few sentences on what the discussion covers. Not in the timeline; written by hand or passed when associating. |
| `url` | yes | The **released timeline**, as a path under the podcast origin's `/podcasts/`, e.g. `articles/nooreimaan/<episode>.timeline.v<N>.json`, or wherever else under `/podcasts/` the recording was released. |

Rules:

- **Most essays will have no reflections, and some never will.** `reflections` is still always
  present, `[]` for an essay without recordings, so every file has the same shape and consumers
  never branch on a missing key. An empty list is the normal case, not an error: the API accepts
  it, the build writes it, and the essay page (section 7) shows no reflections section at all
  for it, not an empty one.
- **Order is display order.** A new reflection is appended.
- **`url` points at the timeline, not the audio.** The player needs the timeline (who speaks
  when, with which expression), and the timeline names its audio beside it (`audio`). Both files
  are released together and never change in place, so a versioned timeline URL pins one exact
  recording.
- **`url` is relative to the origin**, not absolute. The frontend joins it to
  `PODCAST_AUDIO_ORIGIN` (`https://audio.ishqnama.com/podcasts/` in every environment;
  `NEXT_PUBLIC_PODCAST_AUDIO_ORIGIN` points it at a local static server for testing, which an
  absolute URL baked into the JSON would defeat).
- **One reflection per episode.** Releasing a new version of an episode (`naskh` v2) replaces the
  `url` of the reflection that points at an older version of the same episode instead of adding
  a second one; `title` and `caption` are refreshed from the new timeline only when they still
  equal the old timeline's (a hand-edited title is kept), and `description` is kept.
- A `url` must match `^(?:[a-z0-9_-]+/)*[a-z0-9_-]+\.timeline\.v[1-9][0-9]*\.json$`, and the
  file must exist in the repo's `audio/podcasts/` folder. That folder is what `sync-audio.yml`
  copies to the bucket, so a file in the repo is a file that will be served.

## 2. Keep reflections when the essays are rebuilt

`frontend/scripts/build_nooreimaan_articles.py` deletes every JSON in the folder and writes the
essays afresh, which would drop every association. Change `main()` to read each existing file's
`reflections` (by slug) before deleting, and write it back as the last key (`[]` when the file
was new or had none). A reflection whose slug is no longer in the manifest makes the build fail
naming it, rather than dropping it silently. Tests in `scripts/test_build_nooreimaan_articles.py`
(`npm run articles:test`): carried over unchanged, default `[]`, orphan fails.

Run the build once (or a one-off script) to add `"reflections": []` to all 22 files, and check
that `git diff` shows only that line per file.

## 3. Associate a recording with an essay

Extend `frontend/scripts/diarize_podcast.py` (the onboarding skill already drives it):

- `--release <draft> --article <slug> [--description "<text>"]`: after a successful release,
  add or update the essay's reflection (rules in section 1) with the released timeline's path.
- `--attach <released timeline> --article <slug> [--description "<text>"]`: the same for a
  recording that is already released, without moving anything. This is how existing episodes are
  associated, and how one recording is attached to a second essay.
- Both refuse an unknown slug (no `<slug>.json` in the essays folder), a timeline that fails
  `--check` or whose recording is not released beside it, and a timeline outside a `podcasts/`
  folder (the `url` is its path relative to that folder). They write the essay file with the
  converter's formatting (`ensure_ascii=False, indent=1`, trailing newline, LF) so the diff is
  only the reflection.
- The essays folder is a module constant beside `RELEASE_DIR`
  (`backend/src/Ishqnama.Application/Articles/NoorEImaan/`), overridable with `--essays` for
  tests.
- Tests in `scripts/test_diarize_podcast.py` (no venv needed): append, replace on a new version,
  keep a hand-edited title and the description, unknown slug, bad timeline, formatting
  round-trip.

Update `.claude/skills/onboarding-podcast-audio/SKILL.md`: ask which essay (or essays) the
recording belongs to, and an optional one-line description; release with `--article`; report the
essay updated. Add a **Common mistakes** row: never write `reflections` by hand.

## 4. Validate in the API

`ArticleService` already parses each essay to check its slug. Also check `reflections`: present,
an array, each item an object with a non-empty `title` and a `url` matching the pattern, and
`caption`/`description` strings when present. A bad file throws with the slug and the index, as
a slug mismatch does today. That happens when the singleton is first built, which in the API is
the first essay request, not startup (`AddSingleton` is lazy); the tests build it too, so CI is
the real gate. Building it eagerly in `Program.cs` was offered and not taken. The JSON is still served verbatim, and the content ETag
changes when a reflection is added, so readers with the essay cached get the new list.

Tests in `backend/tests/Ishqnama.Application.Tests/ArticleServiceTests.cs`: every embedded
essay has `reflections`; every `url` names a file that exists under the repo's
`audio/podcasts/` (found by walking up from the test assembly to the folder with `audio/`), so a
reflection can never ship pointing at a recording that was not released.

## 5. Types

`frontend/src/types/articles.ts`:

```ts
/** A podcast recording about the essay; `url` is the released timeline under /podcasts/. */
export interface Reflection {
  title: string;
  caption?: string;
  description?: string;
  url: string;
}

export interface EssayDto {
  slug: string;
  urduTitle: string;
  blocks: Block[];
  reflections: Reflection[];
}
```

`src/lib/podcast-timeline.ts`: `reflectionEpisode(url)` returns `{ episode, version }` (for
`useEpisode`) from a reflection's `url`, throwing on one that does not match the pattern; tested
beside `episodeUrls`.

## 6. First associations

1. `naskh`: `--attach audio/podcasts/articles/nooreimaan/naskh.timeline.v1.json --article naskh`.
2. `jumla-e-mustanifa`: the released `mustanifa_brief.timeline.v1.json` named
   `mustanifa_brief.m4a`, not the versioned file, so `--attach` refused it. The user corrected
   `audio` in v1 by hand, and v1 was attached (done 2026-10-16).

## 7. Out of scope here (next plan)

Showing reflections on the essay page: a "Reflections" section in `EssayContent` listing title,
caption and description, whose Play opens `podcast-bubble.tsx` on that episode (today the bubble
lives on `/lab/podcast/` only), copy in `src/config/podcast-copy.ts` under its rules, telemetry.
This plan stops at the data, so the UI can be designed on real associated recordings.

## 8. Docs

- Root `CLAUDE.md`: in **Articles**, the `reflections` property, its rules and where the build
  keeps it; in **Podcast mascots and recordings**, `--article` / `--attach`.
- `plans/articles-recordings-spec.md`: a status line saying sections on storage, the Worker,
  the manifest and signed links are superseded by this plan.

## Verification

1. `npm run articles:test`, `python -m unittest scripts/test_diarize_podcast.py` (from
   `frontend/`), `npm test`, `npm run lint`, `npm run build`.
2. `dotnet build` and `dotnet test` in `backend/`.
3. After step 6.1: `GET /api/articles/nooreimaan/naskh` (signed in, local API) returns the
   reflection; the ETag differs from before; `/lab/podcast/?episode=articles/nooreimaan/naskh&v=1`
   still plays.
4. Rebuild the essays with `npm run articles:build` and check `git diff` is empty (the
   association survived).

## Decisions (confirmed 2026-10-16)

1. **`url` is relative to the origin**, not an absolute `https://audio.ishqnama.com/...` URL.
2. **The recordings stay public by URL for now.** The essay text needs an account, and the
   reflection list only reaches signed-in readers inside the essay JSON, but the files sit in the
   public `ishqnama-audio` bucket like the recitation, so anyone holding a link can play it. The
   old spec's Worker and signed links are dropped.
3. **The UI is out of scope**, to be worked up separately (section 7).
4. **A recording need not be a reflection.** Releasing never requires an essay; attaching is a
   separate, optional step.
