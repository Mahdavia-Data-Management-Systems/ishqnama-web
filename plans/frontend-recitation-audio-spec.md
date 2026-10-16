# Frontend recitation audio: a site-wide player fed from Tarteel's recordings

Design spec, 2026-10-13.

## Context

Readers should be able to hear the Quran recited, verse by verse, while they read. The
recording is Abdul Basit Abdul Samad's murattal from Tarteel's Quranic Universal Library
(QUL), resource 408 (https://qul.tarteel.ai/resources/recitation/408): one gapless MP3 per
chapter, 114 files, plus timings for every verse (`timestamp_from` / `timestamp_to` in
milliseconds) and for every word (`segments`, `[word position, from, to]`). QUL's own
documentation says to download the files and self-host them rather than hotlink
`audio-cdn.tarteel.ai`, which it calls shared infrastructure, not a production dependency.

A site-wide Spotify dock was built and reverted on this branch (commits `56ec15f`, `7f1164c`).
Its shape, one provider in the app shell owning one playback element, with reader-facing copy
under the non-technical rules, is reused here; nothing from Spotify returns.

Decisions taken with the owner:

- **Self-hosted on Cloudflare R2**, not QUL's CDN. The domain is already on Cloudflare, R2's
  free tier (10 GB, free egress, 10 M reads a month) holds one reciter with room to spare, and
  the site stays at $0 a month.
- **One reciter to start**, Abdul Basit. The data shape allows more later; there is no reciter
  setting yet.
- **Play from this verse and keep going**: the verse being read is highlighted and kept in
  view, and the recitation runs to the end of what the reader is looking at (the chapter, juz
  or ruku page, or every group of a verse list), crossing into the next chapter's file where
  the page does.
- **A bar above the reader toolbar**, not a corner dock and not controls inside the toolbar.
- **Verse timings are bundled in the app**, not fetched per chapter: about 100 KB of source,
  roughly 35 KB gzipped, and no second request before a verse can start.
- **The player is site-wide and content-agnostic.** Recordings of the Noor e Imaan essays
  will be hosted later and must play through the same player, and a verse list's Play must
  play all of its groups. Playback continues across navigation; closing the bar stops it.

## Tarteel's numbering differs from Ishqnama's

Ishqnama numbers the basmala as verse 0 of every chapter except 9. Tarteel has no verse for
it, except in al-Fatiha, where the basmala is verse 1:1. The build script (below) remaps:

| Tarteel | Ishqnama |
|---|---|
| 1:1 | 1:0 (the basmala) and, by reuse, N:0 for every chapter N ≠ 9 |
| 1:2 … 1:6 | 1:1 … 1:5 |
| 1:7, words 1–4 | 1:6 |
| 1:7, words 5–9 | 1:7 |
| N:v for N ≥ 2 | N:v, unchanged |

Tarteel's 1:7 has nine word segments; the split uses their timings (`from` of word 1 to `to`
of word 4; `from` of word 5 to `to` of word 9). The basmala of chapters 2–114 is not in
their files at all, so verse 0 of any chapter plays the basmala clip out of `001.mp3`.

No other chapter is known to differ. The build asserts every other chapter's verse count
against `src/data/suras.ts` and stops on a mismatch, so a difference we do not know about
can never ship as a silently shifted highlight.

## Goals

- Tap Play on a verse and hear it, with the verse being read highlighted and kept in view, in
  both reading modes, on chapter, juz and ruku pages, and on a verse list.
- Gapless within a chapter; a chapter boundary costs one file switch.
- Nothing is fetched until a reader presses Play; a first verse starts after one range request.
- One player for the whole site, open to anonymous readers, that an essay recording can use
  later with no change to the provider.
- Lock-screen and headset controls work on phones.
- Copy never says "player", "audio file", "stream", "load", "service" or "server"; the reader
  hears a "recitation" or a "recording".
- Telemetry records where and how a recording was played, never which verse or which text.
- $0 a month, nothing in the repo that cannot be public.

## Non-goals

- Word-by-word highlighting. The raw export keeps the word segments for later.
- Repeat, remembering where a recitation stopped, or downloading for offline. (A reciter
  setting, a speed stepper and a "continue to the next verse" switch were added later, in the
  sheet's "Recitation settings" section, saved with the reader's other settings; see CLAUDE.md.)
- The essays' recordings. The provider accepts a whole-file clip today; hosting and wiring
  those files is its own piece of work.
- Any backend change beyond the three settings fields. Audio and timings are static.
- Terraforming R2. The Cloudflare workspace pins provider `~> 4.0`, which has no R2 custom
  domain or CORS resource; v5 breaks the zone resource. The bucket is hand-managed and
  documented, as the API custom domain and the Entra registrations are.

## Section 1: Data and storage

### The export

The QUL package (`surah-recitation-abdul-basit-abd-us-samad-murattal.zip`, downloaded with
the owner's QUL account) holds two JSON files and no audio:

- `surah.json`: 114 entries keyed by chapter, each `{ surah_number, audio_url, duration }`.
  `audio_url` is `https://audio-cdn.tarteel.ai/quran/surah/abdulBasit/murattal/mp3/NNN.mp3`.
  `duration` is unreliable (8,655 s for al-Baqarah, whose file and timings both say 9,685 s)
  and is not used.
- `segments.json`: 6,236 entries keyed `"c:v"`, each `{ timestamp_from, timestamp_to,
  duration_ms, duration_sec, segments }` with `segments` as `[[wordPosition, fromMs, toMs], …]`.

The MP3s (114 files, 128 kbps CBR MP3, about 1.8 GB in all; al-Baqarah is 155 MB) never
touch the repo or the owner's machine: `sync-audio.yml` streams them from those URLs into the
bucket (see **Upload**). The originals are kept as they are; re-encoding to a lower bitrate
for readers on phone data is a possible later step, not part of this work.

The package is kept anywhere by the owner (it is 650 KB, downloaded with their QUL account);
the onboarding script unpacks its two files into the gitignored
`.ishqnama/audio/tarteel/<package name>/`.

The export has been checked against our data: every chapter's verse count matches
`src/data/suras.ts`; chapter 1 is as the remap table says (1:7 has nine word segments);
verse 1 of every other chapter starts at 0 ms with no basmala audio before it. Its timing
defects are catalogued in `plans/recitation-timing-issues.md`.

### The timings build

`frontend/scripts/onboard_recitation.py`, driven by the project skill
`.claude/skills/onboarding-tarteel-audio/` (originally `build-recitation-timings.mjs` under
`npm run recitation:build`), reads the export and writes one checked-in file,
`frontend/src/data/recitations/abdul-basit-murattal.ts`:

```ts
import type { RecitationTimings } from "@/lib/recitation-playlist";

export const ABDUL_BASIT_MURATTAL: RecitationTimings = {
  id: "abdul-basit-murattal",   // also the folder name on R2
  version: 1,                   // the /v1/ in the audio path
  basmala: [0, 5110],           // [fromMs, toMs] inside 001.mp3: Tarteel's 1:1
  chapters: [                   // index 0 = chapter 1; numbered verses only
    [[1, 5110, 11230], [2, 11230, 15870], /* … */ [6, /* … */], [7, /* … */]],  // al-Fatiha, remapped
    [[1, 0, 9870], [2, 9870, 14120], /* … */],                                   // al-Baqarah, from 0 ms
    // …
  ],
};
```

Each verse row is `[verse, fromMs, toMs]`. Verse 0 is never stored per chapter: the player
derives it from `basmala` for every chapter except 9. Word segments are not copied.

The script's assertions, in order, each stopping the build with the chapter and verse named:

1. Tarteel chapter 1 has 7 verses and its verse 7 has exactly 9 word segments.
2. Every other chapter's verse count equals `suras[n].verseCount`.
3. Within a chapter the rows are in verse order and each `fromMs < toMs`.

A remap table in the script, `VERSE_REMAPS`, keyed by chapter, holds the al-Fatiha rule, so a
further chapter needing one is a single entry.

**Overlaps and gaps are known defects of the export, carried as technical debt** and listed
in full in `plans/recitation-timing-issues.md`. The build does not try to be clever: it copies
the verse spans as they are and prints every overlap, largest first, so the list stays
visible on each run. The player tolerates them (Section 2: a clip that starts before the
previous one ended is a seek backwards; a gap is a seek forwards). Correcting the data, by
listening and recording hand overrides in a committed file the build applies before its
assertions, is follow-up work listed at the end.

`src/data/__tests__/recitation-timings.test.ts` repeats checks 2 and 3 against the checked-in
data, so a hand edit cannot break it either.

### Audio on R2

One bucket, `ishqnama-audio`, behind the custom domain `https://audio.ishqnama.com`. Objects
live at `/recitations/abdul-basit-murattal/v1/001.mp3` … `114.mp3`, the originals as Tarteel
serves them, with `Cache-Control: public, max-age=31536000, immutable`. A changed recording gets
`/v2/` in its path and `version: 2` in the timings, mirroring the rule for fonts under
`/fonts/`. (The path was `/recitations/v1/<id>/` until the onboarding skill, which lays the
manifests out as `audio/recitations/<id>/v<N>/`.) One bucket serves dev, prod and localhost; audio is not environment data.

R2 serves HTTP Range requests, which seeking inside a two-hour al-Baqarah file depends on, and
the custom domain puts Cloudflare's cache in front.

### The frontend's view of it

`src/config/recitation.ts`:

```ts
export const RECITATION_AUDIO_ORIGIN =
  process.env.NEXT_PUBLIC_RECITATION_AUDIO_ORIGIN ?? "https://audio.ishqnama.com";
export const RECITATIONS: readonly RecitationOption[];   // { name, reciter, timings }: one entry, for now
export const RECITATION = RECITATIONS[0];                // the default; recitationById(id) finds a saved choice
export function chapterAudioUrl(recitation: RecitationTimings, chapter: number): string;
// → `${origin}/recitations/v${version}/${id}/${chapter padded to 3}.mp3`
```

The env var exists only for testing against another bucket; no environment sets it.

## Section 2: A site-wide player with a generic queue

### Owner

`src/context/audio-player-context.tsx` exports `AudioPlayerProvider` and `useAudioPlayer()`.
It is mounted in `app-shell.tsx` **around** `AuthProvider`, so it outlives every page and
plays for anonymous readers; the redirect bridge route returns before any provider, so the
hidden MSAL iframe never mounts it. It owns one `Audio` element, created in an effect and
never rendered, and renders the bar (Section 3) once.

### Clips and playlists

The provider knows nothing about verses or essays, only clips:

```ts
export interface Clip {
  url: string;                          // the file
  fromMs?: number;                      // omitted: from the start
  toMs?: number;                        // omitted: to the end (an essay recording)
  title: string;                        // what the bar shows: "al-Baqarah"
  subtitle?: string;                    // "Verse 255"
  ref?: { chapter: number; verse: number };   // lets a page highlight the verse being read
}

export interface Playlist {
  id: string;        // "quran/2", "juz/3", "ruku/412", "list/abc123def456"
  clips: Clip[];
  href?: string;     // the page the playlist came from; the bar's title links there
}
```

### Hook

```ts
interface AudioPlayerContextValue {
  status: "closed" | "loading" | "playing" | "paused" | "failed";
  playlist: Playlist | null;
  index: number | null;
  current: Clip | null;
  /** Starts here. The current clip of the current playlist: pauses while playing, resumes while paused. */
  play: (playlist: Playlist, index: number, trigger?: HTMLElement | null) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  /** Stops, forgets the playlist, hides the bar, returns focus to the trigger. */
  close: () => void;
  isCurrent: (ref: { chapter: number; verse: number }) => boolean;
}
```

"The same playlist" means the same `id`; a page that rebuilds its playlist array on render
does not restart playback.

### Builders

`src/lib/recitation-playlist.ts` turns content into clips from the bundled timings:

- `RecitationTimings` type and `clipFor(recitation, chapter, verse): Clip`: verse 0 is the
  `basmala` span in `chapterAudioUrl(recitation, 1)`; any other verse is its row in its own
  chapter's file. Chapter 9 has no verse 0; asking for it throws.
- `versePlaylist(id, verses: {chapter, verse}[], href): Playlist` for any ordered run. The
  reader passes its page's verses in page order, verse 0 included where the page shows a
  basmala. The list view concatenates its groups' ranges (`fromVerse` … `toVerse`, never
  verse 0) in list order.
- Titles come from `suras` (`name`), subtitles are "Verse n" or "Bismillah" for verse 0.

### Playing

`play(playlist, index, trigger)`:

1. Same `playlist.id` and `index` as the current clip: `playing` → `pause()`; `paused` →
   `resume()`. Done.
2. Otherwise remember `trigger` for focus return, set the playlist and index, `status =
   "loading"`, and record `recording-played`.
3. If `clip.url` differs from `audio.src`: set `src`, `preload = "auto"`, wait for
   `loadedmetadata`, then seek to `fromMs / 1000` (or 0). If the file is already loaded: seek
   straight away.
4. `audio.play()`. The first call is inside the tap handler, which unlocks the element; later
   `src` changes on the same element may call `play()` outside a gesture in Chrome, Safari and
   Firefox. A rejection with `AbortError` (a newer play superseded it) is ignored; `playing`
   on the `playing` event.

### Advancing

While `playing`, a `requestAnimationFrame` loop reads `audio.currentTime`. When it reaches
the clip's `toMs`:

- next clip in the **same file starting where this one ends**: nothing is done to the audio;
  it runs on gapless, only `index` moves. "Where this one ends" allows the export's small
  gaps and overlaps: a start within 300 ms either side of the end counts, so the audio is not
  nudged for a few hundred milliseconds of padding;
- same file, elsewhere (a bigger gap or overlap in the timings, or a verse the reader
  skipped to): seek;
- a different file (verse 0's basmala in `001.mp3`, a new chapter on a juz or ruku page or in
  a list): step 3 above.

`requestAnimationFrame` pauses in a background tab, so the `timeupdate` event (about 4 Hz)
runs the same check, and listening with the screen off keeps advancing. A clip with no
`toMs` ends on `ended`; `ended` is also handled for a file shorter than its timings say.
After the last clip the audio is paused and `status` returns to `closed`.

`next()` and `previous()` move one clip (step 3 if needed) and are no-ops at the ends.

### Media Session

Where `navigator.mediaSession` exists, the provider sets `metadata` (`title`, `artist`
"Abdul Basit Abdul Samad", `album` "Ishqnama") per clip, `playbackState`, and handlers for
`play`, `pause`, `nexttrack` and `previoustrack`, so the lock screen and headset buttons
control it.

### Failure and offline

An `error` event on the audio, or a `play()` rejection other than `AbortError`, sets
`failed` and keeps the playlist and index, so the bar can offer **Try again**, which repeats
step 3 for the same clip. `NotAllowedError` (the browser wanted a gesture) is reported as
`reason: "blocked"`, anything else as `"audio"`. The window `offline` event pauses; the
reader resumes by hand.

`close()` pauses, clears `src`, forgets the playlist, hides the bar and moves focus to the
trigger if it is still in the document.

### Telemetry

Two events in `telemetry-events.ts`: `recording-played` (`route`, the route pattern, which
already tells a reader page from a list page) and `recording-failed` (`reason` = `audio` |
`blocked`). The provider sends them, so it needs nothing from the page that pressed Play. No
new property key, so no verse, title or URL can be sent.

## Section 3: The bar, the highlight and the Play controls

### The bar

`src/components/audio/audio-player-bar.tsx`, rendered by the provider while `status !==
"closed"`. Full width, `position: fixed`, `z-index: 95` (over the bottom nav at 90 and the
reader toolbar at 50, under the app bar at 100, menus at 200 and sheets at 300). On reader
routes (`isReaderRoute(pathname)`) it sits at `bottom: var(--toolbar-height)`; elsewhere
above the phone bottom nav, and at the viewport bottom on desktop, through the same
`data-clears` attribute the footer uses. One 56 px row on `--surface-card` with a hairline
top like the toolbar:

```
│ ⏮  ⏯  ⏭   al-Baqarah · Verse 255                                   ✕ │
```

- The title is a link to `playlist.href` plus `?verse=<c>-<v>` (or `?verse=<v>` on a chapter
  page) of the current clip, so a reader who has moved elsewhere can get back to the verse
  being read. Without `href` it is plain text.
- Previous and next are disabled at the ends of the playlist.
- `loading`: the play button breathes, the loading rail's idiom. `failed`: the title gives
  way to "This recording couldn't start." and a **Try again** button.
- `role="region"` named "Recording". It never takes focus when it opens; the reader tapped a
  verse and is still reading. On close, focus returns to the trigger.
- The sheets' `rise` entrance, none under reduced motion. Hidden in print. Every colour a
  token; icons from `Icon`.

While open the provider sets `data-audio-bar` on `<html>`. `--audio-bar-height: 56px` in
`globals.css`; the footer, the back-to-top button and the continuous-mode verse popup add it
to their bottom clearance under that attribute, so nothing sits under the bar.

### The highlight

`isCurrent({chapter, verse})` drives one visual in three places: `AyahBlock` gets an
`isReading` prop (a soft `--tint-teal-8` wash on the block), the continuous-mode `verseSpan`
and the lists' `ArabicPassage` verse spans get a `reading` class. Both themes use tokens.

`useFollowReading(current)` in `src/components/audio/use-follow-reading.ts`, used by the
reader and the list view: when the reading verse changes it finds `#verse-<c>-<v>` and
scrolls it to the centre **only if it is outside the viewport**, so a reader scrolling ahead
is not pulled back; smooth unless the reader prefers reduced motion. `ArabicPassage` gives
its verse spans that id if it does not already.

### Play controls

Open to everyone, no sign-in gate, like the reader itself.

- **Verse mode**: `IconButton icon="play"` first in the verse's actions row in
  `ayah-block.tsx`, becoming `pause` with `aria-pressed` while that verse is being read.
  Label "Play recitation" / "Pause".
- **Continuous mode**: the same button in the verse popup's header in
  `quran-reader-client.tsx`; nothing is added inside the running text. The popup's
  bismillah entry (verse 0) has one too.
- **List view** (`src/app/lists/view/list-view.tsx`): a **Play** button beside the list's
  title (all groups in order) and a small play button on each group's caption line (from that
  group to the end of the list). Featured, published and own lists alike.
- `Icon` gains `play`, `pause`, `skipBack` and `skipForward`.

The reader builds its playlist with `useMemo` from `verses` and the route (`id` from the
route, `href` the current pathname); the list view from `list.groups`.

### Copy

`src/config/audio-copy.ts`, enforced by `src/config/__tests__/audio-copy.test.ts` (no
technical words, under twelve words, sentence case):

| Key | Text |
|---|---|
| `regionLabel` | Recording |
| `playRecitation` | Play recitation |
| `pause` | Pause |
| `resume` | Play |
| `previousVerse` / `nextVerse` | Previous verse / Next verse |
| `closeRecording` | Close recording |
| `couldNotStart` | This recording couldn't start. |
| `tryAgain` | Try again |
| `playList` | Play |
| `playFromGroup` | Play from here |
| `bismillah` | Bismillah |
| `verse(n)` | Verse n |

The privacy page gets a "Recordings" section: the recordings come from the site's own storage,
served through Cloudflare, which sees the request as any web host does; nothing is fetched
until Play is pressed. The About page credits the reciter and Tarteel's QUL as the source.

## Section 4: Infrastructure, upload, testing, follow-ups

### Cloudflare, by hand

Documented step by step in a new `infra/README.md` section, "Recitation audio on R2":

1. R2 → create bucket `ishqnama-audio` (location Automatic, Standard storage, no public
   `r2.dev` URL).
2. Bucket → Settings → Custom Domains → `audio.ishqnama.com` on the `ishqnama.com` zone.
   Cloudflare adds the DNS record itself and it is **proxied**: the one record on the zone
   that is not DNS-only, and it must stay that way, since R2 custom domains only work through
   the proxy.
3. CORS policy on the bucket: `AllowedOrigins ["*"]`, `AllowedMethods ["GET", "HEAD"]`,
   `AllowedHeaders ["Range"]`, `ExposeHeaders ["Content-Length", "Content-Range",
   "Accept-Ranges"]`, `MaxAgeSeconds 86400`. Public, read-only content.
4. An R2 API token with Object Read & Write on that bucket only, kept as the `prod`
   environment's `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` secrets for `sync-audio.yml`;
   never in the repo, and no longer on the owner's machine.
5. Release prerequisites: confirm QUL's terms allow hosting this recording, and credit the
   reciter and QUL on the About page.

The Terraform Cloudflare workspace is untouched. Cost: about 1.5 GB of the 10 GB allowance,
free egress, reads well under 10 M a month: $0.

### Upload

The onboarding skill writes the 114 CDN URLs to `audio/recitations/<id>/v<N>/.tarteel.json`.
`sync-audio.yml`, run by `cloudflare-release.yml`, lists the bucket folder and streams every
URL it lacks straight from Tarteel's CDN with `rclone copyurl` under the immutable cache
header; it never deletes. A second run uploads nothing. (Originally the owner fetched the
files with `npm run recitation:fetch` and pushed them with `npm run recitation:upload` over a
local `rclone` remote; both scripts are gone.)

### Testing

- `frontend/scripts/test_onboard_recitation.py` (`python -m unittest`) with a fixture export
  in the package's shape: the al-Fatiha remap, the basmala extraction, the overlap report,
  each assertion failing on bad input, the URL check, the version choice and a zip end to end.
- `src/data/__tests__/recitation-timings.test.ts`: the checked-in data against `suras`,
  ordered and non-overlapping.
- `src/lib/__tests__/recitation-playlist.test.ts`: verse 0 → the basmala clip from file 1,
  chapter 9 has none, a list's groups concatenate across chapters, URLs and titles.
- `src/context/__tests__/audio-player-context.test.tsx` with a fake `Audio` (controllable
  `currentTime`, manual events, recorded calls): first play, pause and resume by replaying
  the same clip, gapless advance within a file, the seek within a file, the file switch for a
  basmala and for a new chapter, a playlist spanning two files, a whole-file clip ending on
  `ended`, stop at the end, failure and Try again, close with focus return, playback
  surviving a route change, and that telemetry never carries a title or URL.
- `src/components/audio/__tests__/audio-player-bar.test.tsx`,
  `use-follow-reading.test.ts` (scrolls only when out of view), `audio-copy.test.ts`,
  `icon.test.tsx`; `ayah-block` and `list-view` tests for the Play button and the reading
  class.
- A manual check on a phone before merging: lock-screen controls, the chapter switch on a juz
  page, the basmala before a chapter, and al-Fatiha 1:6 and 1:7.

### Follow-ups

- **Timing corrections** (technical debt from the export, catalogued in
  `plans/recitation-timing-issues.md`): listen to each listed verse, starting with 55:70–71
  and the single-word opening verses, and record the right boundaries in a committed
  overrides file the build applies before its assertions.
- **Re-encoding** to about 64 kbps mono (roughly half the data for readers on phones;
  al-Baqarah from 155 MB to 77 MB) under a `/v2/` path, if the originals prove heavy in use.

- Essay recordings: host the files under `/recordings/v1/…` on the same bucket, a URL per
  essay through the converter and `EssayDto`, and a one-clip playlist behind a play control
  under the essay title.
- Word-by-word highlighting from the word segments.
- A reciter setting once there is a second recitation.
