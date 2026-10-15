---
name: onboarding-podcast-audio
description: Use when a podcast recording for the Hamza and Zoya mascots arrives (an m4a, mp3 or wav from NotebookLM or voice actors, one or two voices) and the site needs to know which mascot speaks when and with which expression, or when a recording's timeline file must be checked or redone
---

# Onboarding podcast audio

## Overview

Claude cannot hear a recording. `frontend/scripts/diarize_podcast.py` does the
listening: it finds speech, tells the voices apart, names them after the
mascots by pitch (Hamza is the lower voice, Zoya the higher), transcribes
every turn and writes `<recording>.timeline.json` beside the recording. The
site plays that timeline against the audio: the speaking mascot's avatar
glows and shows the turn's expression. Your part is what the script cannot
do: run it, judge the voices, choose each turn's expression from the
transcript, and mark the file reviewed.

## Setup, once per machine

```
cd frontend
py -3.13 -m venv .venv-podcast
.venv-podcast/Scripts/python -m pip install -r scripts/podcast-requirements.txt
```

Python 3.13, not 3.14. The first run downloads two models (about 600 MB)
into `~/.cache/ishqnama-podcast`. No account, token or GPU is needed.

## Steps

1. The recording lives at `frontend/design/podcast/audio/<episode>.<ext>`.
   Keep the name the user gave it; the timeline takes the same name.
2. Run, from `frontend/` (about 1.5x real time on a CPU):

   ```
   .venv-podcast/Scripts/python scripts/diarize_podcast.py design/podcast/audio/<episode>.m4a --language ur
   ```

   Add `--title "<the topic, in the recording's script>"` and
   `--caption "<one line under it>"`, which the bubble heads itself with; ask
   the user for them if the request does not say (the article's Urdu title
   and its English title make a good pair). Add `--speakers zoya` (or
   `hamza`) when the user says a recording is one known mascot. Read what it prints: the number of voices and whether it
   was detected or forced, how far apart the two clusters are, each
   mascot's median pitch, the pitch confidence, and the turn table.
3. Judge the voices with these predicates, nothing else:
   - `pitch confidence: high` and two voices whose medians sit on either
     side of 155 Hz, or one voice: accept the mapping.
   - `pitch confidence: low`, or the voices look wrong to the user: quote
     the first turn of each voice (its times) and ask the user to listen
     and say who is who, then rerun with `--map hamza=<cluster>,zoya=<cluster>`.
   - The voice count looks wrong (a solo brief came out as two voices, or
     a pair as one): rerun with `--voices 1` or `--voices 2`.
4. Open the timeline and read every turn's `text`. Set each turn's
   `expression` by the rules below, then set `expressionsReviewed` to
   `true`. Change nothing else by hand.
5. Check it:

   ```
   .venv-podcast/Scripts/python scripts/diarize_podcast.py --check design/podcast/audio/<episode>.timeline.json
   ```

   It must print `ok`.
6. Report: voices and detection, turn count, each mascot's median pitch,
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

`version` 1, `audio`, `durationMs`, `language`, `speakers` (per mascot:
`cluster`, `medianPitchHz`, `speechMs`), `pitchConfidence` high, low or
override, `voices` 1 or 2, `voiceDetection` auto or forced,
`expressionsReviewed`, and `turns` of `speaker`, `fromMs`, `toMs`,
`expression`, `text`. Turns are ordered and never overlap. A pause under
1.2 s stays inside a turn, a run under 0.6 s joins its neighbour (a
listener's "hmm" never flickers the glow), and a turn over 30 s is split
at its widest pause so the expression can change. Where the served copy of
the audio and timeline will live is for the feature spec; until then both
stay beside each other in `design/podcast/audio/`.

## Common mistakes

| Mistake | Instead |
|---|---|
| Building a pipeline by hand (pyannote needs a gated token; average-linkage clustering split a real pair into one voice plus a one-second sliver) | Run the script; it is tested against known turn times and both voice counts |
| Deciding who is Hamza from the roles (the explainer "must" be Hamza, the asker Zoya) | Pitch decides; a solo brief can be either mascot and NotebookLM swaps roles freely |
| Marking an exclamation as `laughing` | Laughing needs laughter in the text |
| Writing `listening` as a turn's expression, or inventing a fourth value | Three values only; `--check` rejects anything else |
| Setting `expressionsReviewed` before reading every turn | Read all the turns, then set it |
| Editing `fromMs` or `toMs` by hand | Boundaries come from the audio; rerun with other flags instead |
| Committing `.venv-podcast`, model caches or scratch files | Only the recording and its timeline belong in the repo |

Three or more voices are not supported: the cast is one or two mascots.
