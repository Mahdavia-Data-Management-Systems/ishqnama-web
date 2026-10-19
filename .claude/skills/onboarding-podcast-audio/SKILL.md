---
name: onboarding-podcast-audio
description: Use when a podcast recording for the Hamza and Zoya mascots arrives (an m4a, mp3 or wav from NotebookLM or voice actors, one or two voices) and the site needs to know which mascot speaks when and with which expression, or when a recording's timeline file must be checked, redone or released into the served audio folder
---

# Onboarding podcast audio

## Overview

Claude cannot hear a recording. `frontend/scripts/diarize_podcast.py` does the
listening: it finds speech, tells the voices apart, names them after the
mascots by pitch (Hamza is the lower voice, Zoya the higher), transcribes
every turn and writes a draft `<episode>.timeline.json` beside the
recording. The site plays that timeline against the audio: the speaking
mascot's avatar glows and shows the turn's expression. Your part is what
the script cannot do: ask where the recording is, run the script, judge the
voices, choose each turn's expression from the transcript, mark the file
reviewed, release the pair into the served folder, and attach it to the
essays it is a reflection on, if any.

## Setup, once per machine

```
cd frontend
py -3.13 -m venv .venv-podcast
.venv-podcast/Scripts/python -m pip install -r scripts/podcast-requirements.txt
```

Python 3.13, not 3.14. The first run downloads two models (about 600 MB)
into `~/.cache/ishqnama-podcast`. No account, token or GPU is needed.

## Steps

A fresh recording goes through all seven. To check or release a draft the
user already reviewed, start at step 5; to redo one, at step 1.

1. Ask the user for these before anything else runs, in one message.
   There is no folder recordings arrive in: the user keeps them anywhere
   on the machine.
   - **The path of the recording** (m4a, mp3 or wav). Required. Ask for it
     even when a file with a likely name is lying around; never guess.
   - **A name for the episode.** Optional. It replaces the recording's own
     filename as the episode's name, the one the released files carry
     (`mustanifa_brief` gives `mustanifa_brief.v1.m4a` and
     `mustanifa_brief.timeline.v1.json`). Without one, the episode is named
     after the recording's file. A name is one plain word for a filename:
     letters, digits, `_` or `-`, no folder, extension or version.
   - **A title and a caption** for the topic, which the bubble heads
     itself with: the title in the recording's script, the caption one
     line under it (the article's Urdu title and its English title make a
     good pair). Ask unless the request gives them.
   - **The essay or essays it is a reflection on.** Optional: a recording
     can stand alone and play elsewhere on the site. When it belongs to
     Noor e Imaan essays, their slugs (the file names in
     `backend/src/Ishqnama.Application/Articles/NoorEImaan/`, e.g. `naskh`)
     and, if the user wants one, a description of a few sentences for the
     essay page. The first slug also names the folder the files are
     released into (`audio/podcasts/articles/nooreimaan/<slug>/`); a
     recording about no essay needs a folder of its own, so ask where
     under `audio/podcasts/` it should live.

   A request that already states any of these is not asked for them
   again. Ask with `AskUserQuestion` when it is available, else in
   chat, and wait for the answer. Quote the path in the commands below; it
   may hold spaces.
2. Run, from `frontend/` (about 1.5x real time on a CPU):

   ```
   .venv-podcast/Scripts/python scripts/diarize_podcast.py "<path>" --language ur
   ```

   Add `--name <name>` when the user gave one, `--title "<title>"` and
   `--caption "<caption>"` (double quotes hold the Urdu and its spaces),
   and `--speakers zoya` (or `hamza`) when the user says a recording is
   one known mascot. The draft timeline is written beside the recording:
   `<name>.timeline.json` with a name, else the recording's own name with
   `.timeline.json` in place of its extension. It names the recording as
   it is; the recording is not renamed or moved until the release in
   step 6.

   Read what it prints: the number of voices and whether it was detected
   or forced, how far apart the two clusters are, each mascot's median
   pitch, the pitch confidence, and the turn table.
3. Judge the voices with these predicates, nothing else:
   - `pitch confidence: high` and two voices whose medians sit on either
     side of 155 Hz, or one voice: accept the mapping.
   - `pitch confidence: low`, or the voices look wrong to the user: quote
     the first turn of each voice (its times) and ask the user to listen
     and say who is who, then rerun with `--map hamza=<cluster>,zoya=<cluster>`.
   - The voice count looks wrong (a solo brief came out as two voices, or
     a pair as one): rerun with `--voices 1` or `--voices 2`.
4. Open the draft timeline and read every turn's `text`. Set each turn's
   `expression` by the rules below, then set `expressionsReviewed` to
   `true`. Change nothing else by hand.
5. Check it, naming the draft the script said it wrote:

   ```
   .venv-podcast/Scripts/python scripts/diarize_podcast.py --check "<folder of the recording>/<episode>.timeline.json"
   ```

   It must print `ok`.
6. Release it. This moves the recording and the timeline out of the user's
   folder into the essay's own folder, `audio/podcasts/articles/nooreimaan/<slug>/`
   at the repo root (every recording about an essay sits in that essay's
   folder, so all of hazf's are in `hazf/`; the whole `audio/` folder is
   what `sync-audio.yml` copies to the bucket, so a file there is served
   under a one-year immutable cache header and must never change in place)
   under versioned names, points the released timeline's `audio` at the
   versioned recording, and adds the recording to that essay's
   `reflections` in its JSON, titled and captioned from the timeline, with
   `url` the released timeline's path under `/podcasts/` (add
   `--description "<text>"` when the user gave one):

   ```
   .venv-podcast/Scripts/python scripts/diarize_podcast.py --release "<folder of the recording>/<episode>.timeline.json" --article <slug>
   ```

   The script picks the versions: each file takes one more than the highest
   `<episode>.vN.<ext>` or `<episode>.timeline.vN.json` already in the
   folder, and a recording byte-for-byte identical to a released one keeps
   that version, so a corrected timeline adds only `timeline.v2.json`. A new
   version of an episode already on the essay replaces its `url` and keeps
   a hand-edited title and the description. It refuses a draft that fails
   the check. Never choose a version, a folder or a name for the files
   yourself, and never edit a released file: redo the draft and release
   again. The new files are untracked until the user commits them; the
   skill does not commit.

   A recording about no essay has no folder of its own: release it with
   `--into "../audio/podcasts/<folder the user chose>"` in place of
   `--article`. For a second essay, or a recording released earlier, attach
   without releasing again (the files stay where they were released):

   ```
   .venv-podcast/Scripts/python scripts/diarize_podcast.py --attach "../audio/podcasts/articles/nooreimaan/<slug>/<episode>.timeline.vN.json" --article <slug>
   ```

   `--title` and `--caption` there set the reflection's own. It refuses an
   unknown essay, a timeline outside `audio/podcasts/`, one failing the
   check, or one whose recording is not released beside it.
7. Report: the episode's name and the two released paths with their
   versions, each essay the recording was attached to (or that it stands
   alone) (and that an unchanged recording kept its version, when it
   did), voices and detection, turn count, each mascot's median pitch,
   every turn marked laughing or thoughtful with the words that decided
   it, and anything odd (a turn under a second, a turn over 30 s with no
   pause to split at, a transcript too rough to read, which
   `--whisper-model medium` improves at the cost of time).

## Expression rules

A turn's expression is what the speaking mascot shows. The other mascot
shows listening on its own, so `listening` is never written in the file.

- `laughing`: the text contains laughter itself (haha, hehe, ہا ہا, ہنس,
  "[laughs]"), or a joke the speaker then laughs at. An exclamation of
  delight (wah, arey wah, bohat khoob, great, exactly) is `speaking`.
- `thoughtful`: the speaker is weighing something: the turn's last
  sentence is a question of more than four words (Whisper seldom writes
  the `؟`, so read the Urdu: ...کیا, ...نا, ...ہوگا, ...چاہیے, or a `?`),
  or the turn opens with a weighing phrase (suppose, imagine, maybe, I
  wonder, what if, فرض کریں, سوچیں, شاید, میرے خیال میں). A short "ji?"
  or "haan?", or a tag the other mascot dropped in, is `speaking`.
- `speaking`: everything else, including backchannels (ji ji, bilkul,
  hmm, beshak, right).

## The timeline file

`version` 1, `audio` (the recording's file name beside the timeline: as
given in the draft, `<episode>.vN.<ext>` once released), `durationMs`,
`language`, `speakers` (per mascot: `cluster`, `medianPitchHz`,
`speechMs`), `pitchConfidence` high, low or override, `voices` 1 or 2,
`voiceDetection` auto or forced, `expressionsReviewed`, and `turns` of
`speaker`, `fromMs`, `toMs`, `expression`, `text`. Turns are ordered and
never overlap. A pause under 1.2 s stays inside a turn, a run under 0.6 s
joins its neighbour (a listener's "hmm" never flickers the glow), and a
turn over 30 s is split at its widest pause so the expression can change.
Released episodes live in `audio/podcasts/articles/nooreimaan/<slug>/` in
the repo, one folder per essay, laid out as the bucket serves them under
`/podcasts/`.

## Common mistakes

| Mistake | Instead |
|---|---|
| Running the script on a file you found, or on a path from an earlier episode, without asking | Ask the user for the recording's path first, every time it is not in the request |
| Copying the files into `audio/podcasts/` by hand, choosing a version or a folder, or editing a released file | `--release --article <slug>` moves the pair into the essay's folder, versions them and rewrites `audio`; a change is a new release |
| Renaming the recording by hand, or editing `audio` in the draft, to give the episode a name | Rerun with `--name`; the release carries it onto both files |
| Building a pipeline by hand (pyannote needs a gated token; average-linkage clustering split a real pair into one voice plus a one-second sliver) | Run the script; it is tested against known turn times and both voice counts |
| Deciding who is Hamza from the roles (the explainer "must" be Hamza, the asker Zoya) | Pitch decides; a solo brief can be either mascot and NotebookLM swaps roles freely |
| Marking an exclamation as `laughing` | Laughing needs laughter in the text |
| Writing `listening` as a turn's expression, or inventing a fourth value | Three values only; `--check` rejects anything else |
| Setting `expressionsReviewed` before reading every turn | Read all the turns, then set it |
| Editing `fromMs` or `toMs` by hand | Boundaries come from the audio; rerun with other flags instead |
| Committing `.venv-podcast`, model caches, drafts or scratch files | Only the released pair under `audio/podcasts/` belongs in the repo |
| Writing or editing an essay's `reflections` by hand, or attaching every recording to some essay | `--article` on the release, or `--attach`; a recording with no essay stays unattached |

Three or more voices are not supported: the cast is one or two mascots.
