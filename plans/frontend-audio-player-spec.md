# Frontend recordings: the Spotify player dock and playable links

Design spec, 2026-10-10.

## Context

Noor e Imaan content (the dua for completing the Quran, the essays, later verses and more) is
being recorded and published as podcast episodes on Spotify. A reader should be able to tap a
piece of text marked as playable anywhere on the site and hear the recording without leaving the
page, and keep reading, and keep moving between pages, while it plays.

The site had no audio of any kind before this: no `<audio>`, no iframe of its own, no play icon.

Decisions taken with the owner:

- Recordings are Spotify **podcast episodes**. Spotify plays an episode in full for anyone; a
  music track would give an anonymous listener a 30-second preview and ask them to sign in to
  Spotify inside the embed. The player accepts every Spotify kind (`episode`, `show`, `track`,
  `album`, `playlist`, `artist`) and simply behaves as Spotify does for it.
- The player is a **dock** that stays open while the reader reads and navigates, not a modal
  sheet. Closing it stops the audio.
- This work delivers the player, its hook and a reusable `PlayableLink`. Wiring real content is
  follow-up work (see the end).

## Spotify's iFrame API

From https://developer.spotify.com/documentation/embeds/references/iframe-api:

- One script, `https://open.spotify.com/embed/iframe-api/v1`, loaded `async`. When ready it
  calls `window.onSpotifyIframeApiReady(IFrameAPI)`.
- `IFrameAPI.createController(element, { uri | url, width, height }, callback)` **replaces**
  `element` with Spotify's iframe and gives `callback` an `EmbedController`.
- `EmbedController`: `loadUri(uri)`, `loadEntity(uriOrUrl)`, `play()`, `pause()`, `resume()`,
  `togglePlay()`, `seek(seconds)`, `destroy()`, `addListener(event, handler)`. No
  `removeListener` is documented, so listeners are attached once per controller and guard
  themselves against a controller that has since been replaced.
- Events: `ready`; `playback_started` (`e.data.playingURI`); `playback_update`
  (`e.data = { playingURI, isPaused, isBuffering, duration, position }`, in milliseconds).
- `play()` may be refused by a browser that wants a gesture of its own (Safari in particular).
  The embed's own play button is always visible, so the reader taps that instead.
- The embed is Spotify's branded UI and must stay visible. Our chrome wraps it; nothing hides it
  while audio plays.
- Nothing in `public/staticwebapp.config.json` sets a Content-Security-Policy or frame header,
  so nothing blocks the iframe. A CSP added later needs `frame-src https://open.spotify.com`
  and `script-src https://open.spotify.com`.

## Goals

- One player for the whole site, opened from anywhere with a Spotify link and a title.
- Nothing from Spotify is fetched until a reader presses play.
- Audio keeps playing across client-side navigation.
- The dock stays out of the way: not a dialog, no scroll lock, the page is usable under it.
- Copy never says "player", "embed", "iframe", "service", "API" or "server"; the reader hears a
  "recording".
- Telemetry records what kind of thing was played and where, never the link or the title.

## Non-goals

- Our own play, pause, seek or progress controls. The embed has them.
- Collapsing the dock to a pill. Spotify's embed has to stay visible while playing, and the
  compact 80 px embed is already the smallest honest form.
- Resuming where a reader left off, playlists of recordings, or a queue.
- Any backend change. Links are content, carried by the page that shows them.

## Design

### Files

| File | Purpose |
|---|---|
| `src/lib/spotify-link.ts` | `parseSpotifyLink(input)` → `{ kind, id, uri, url } \| null`. Accepts `open.spotify.com/{kind}/{id}` (share query and `intl-xx/` prefix dropped) and `spotify:{kind}:{id}`. |
| `src/lib/spotify-iframe-api.ts` | The API's types and `loadSpotifyIframeApi()`: injects the script once, resolves through `onSpotifyIframeApiReady`, rejects on error or after 10 s, and forgets a failure so the next play tries again. |
| `src/context/audio-player-context.tsx` | `AudioPlayerProvider` + `useAudioPlayer()`. Owns the one controller and renders `AudioPlayerDock` once. |
| `src/components/audio/audio-player-dock.tsx` | The dock: title row over the embed's host element, failure line with a way out. |
| `src/components/audio/playable-link.tsx` | Inline playable text. |
| `src/config/audio-copy.ts` | Every reader-facing string, under the copy rules. |
| `src/components/ui/icon.tsx` | `play` (solid) and `pause` glyphs. |

### Provider and hook

```ts
interface Recording { link: string; title: string; subtitle?: string }
type AudioPlayerStatus = "closed" | "starting" | "ready" | "failed";

interface AudioPlayerContextValue {
  status: AudioPlayerStatus;
  recording: Recording | null;
  playback: { isPaused; isBuffering; duration; position } | null;   // the embed's last report
  play: (recording: Recording) => void;
  togglePlay: () => void;
  close: () => void;
  isCurrent: (link: string) => boolean;
}
```

`play(recording)`:

1. The link does not parse → `failed` (reason `invalid-link`), the dock shows the failure line
   with no way out. Any embed already open is destroyed, because the failure view takes its
   place and a kept controller would point at an iframe that is gone; the next good link starts
   afresh. Guarded for safety; content we author never hits it.
2. The link is the one in the dock and the embed exists → `togglePlay()`.
3. Otherwise remember the element that had focus, set the wanted uri, the recording and the
   telemetry event (`recording-played`, `option` = kind, `route` = the route pattern).
   - Embed exists → `loadUri(uri)` then `play()`.
   - No embed → `status = "starting"`.

An effect runs on `status === "starting"`, after the dock has rendered its host element:
`loadSpotifyIframeApi()`, then a child `div` is created with `document.createElement` (so
React never owns the node Spotify swaps out) and handed to `createController` with
`{ uri, width: "100%", height: 80 }`. On `ready` the controller is kept, `status = "ready"`,
and `play()` is called; `playback_update` is mirrored into `playback`. The uri is read after
the script arrives, so a recording chosen while the first was still starting is the one that
plays. If the script fails or times out: `status = "failed"` (reason `unavailable`) and
`recording-failed` is recorded. The next `play` starts over.

`close()` destroys the controller (Spotify removes its iframe), clears the state and returns
focus to the element that started the recording: the last focused element outside the dock,
since once the dock is open its own title holds focus and must not be recorded as the place to
go back to (it unmounts on close).

While open the provider sets `data-audio-dock` on `<html>`; `--audio-dock-height` in
`globals.css` is the dock's phone height, and the footer and the back-to-top button add it to
their bottom clearance under that attribute at phone widths.

The provider is mounted in `app-shell.tsx` **around** `AuthProvider`: recordings play for
everyone, and the dock has to outlive every page. The redirect bridge route returns before any
provider, so the hidden MSAL iframe never sees it.

### The dock

Spotify's embed is a loud, dark, rounded card we cannot restyle, so our chrome is quiet and
unmistakably ours: one line in the sheets' subtitle style (EB Garamond italic in
`--gold-label`) saying what is playing in our words, a close button, and the embed beneath.
No eyebrow, no "Now playing", no progress bar or play button of our own.

```
Phone (≤640px), full width above the bottom nav or the reader toolbar:
┌────────────────────────────────────────────────┐
│  Dua for completing the Quran               ✕  │  title row, 40px
│  ┌──────────────────────────────────────────┐  │
│  │  [cover] Episode title        ▶ ───────  │  │  Spotify compact embed, 80px
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
│            bottom nav (56px) / toolbar          │

From 641px up: a 360px card in the bottom right corner, --radius-lg, --shadow-modal,
--space-4 from the right edge and from the toolbar (reader routes) or the viewport bottom.
The back-to-top button keeps the bottom left.
```

- `position: fixed; z-index: 95`: over the bottom nav (90) and reader toolbar (50), under the
  app bar (100), menus (200) and sheets (300).
- `data-clears="toolbar" | "bottom-nav"` from `isReaderRoute(pathname)`, the pattern the footer
  and back-to-top use.
- The sheets' `rise` entrance, none under reduced motion. No exit animation; it unmounts.
- `role="region"` named "Recording". The title takes focus when the dock opens so a keyboard
  reader lands on it; focus goes back to the link on close. No scroll lock, no focus trap.
- `starting`: the host breathes like the loading rail (`--tint-ink-6`); `ready`: the iframe;
  `failed`: "This recording couldn't start." and "Open it in Spotify" (the clean URL, new tab).
- Hidden in print. Every colour is a token; Spotify's green never appears in our CSS.

### `PlayableLink`

```tsx
<PlayableLink link="https://open.spotify.com/episode/…" title="Dua for completing the Quran">
  Listen to the dua
</PlayableLink>
```

A `<button type="button">` (an action, not navigation) that inherits the surrounding font and
size, in `--teal-primary` with a dotted gold underline, a small solid play glyph before the
words (logical margin, so it leads in RTL too). `aria-pressed` and the pause glyph while it is
the recording playing. Tapping it again pauses and resumes. Not gated: the page around it does
any gating.

### Copy

`src/config/audio-copy.ts`, enforced by `src/config/__tests__/audio-copy.test.ts` (no
technical words, under twelve words, sentence case with "Spotify" allowed):

| Key | Text |
|---|---|
| `regionLabel` | Recording |
| `closeRecording` | Close recording |
| `couldNotStart` | This recording couldn't start. |
| `openInSpotify` | Open it in Spotify |
| `play` / `pause` | Play / Pause |

### Telemetry and privacy

`recording-played` (`option` = kind, `route`) and `recording-failed` (`reason` =
`unavailable | invalid-link`). No new property key, so a link or title can never be sent. The
privacy page has a "Recordings" section saying the player inside the page comes from Spotify,
which sees the play and may set its own cookies, and that nothing is sent until play is pressed.

## Testing

- `spotify-link.test.ts`: every accepted form, every rejected one.
- `spotify-iframe-api.test.ts`: one script, resolves on the global callback, cached, rejects
  on error and on timeout, tries afresh after a failure.
- `audio-player-context.test.tsx`: a fake `IFrameAPI` whose `createController` swaps the element
  for an iframe and whose controller records calls and fires events. Covers first play, second
  recording, the recording chosen mid-start, toggle, playback mirroring, close with focus
  return, fresh embed after close, both failures, and that telemetry never carries the link.
- `audio-player-dock.test.tsx`, `playable-link.test.tsx`, `icon.test.tsx`, `audio-copy.test.ts`.

## Follow-ups (content wiring)

- **Khatm dua** (`/nooreimaan/dua/`): one `PlayableLink` for the whole dua, with the link as a
  constant beside `KHATM_DUA` in `src/data/khatm-dua.ts`. The page is a server component, so
  the link is a small client child.
- **Essays**: a `spotifyUrl` per essay through the Python converter, the embedded JSON and the
  `EssayDto`, surfaced as a `PlayableLink` under the essay title.
- **Verses**: `IconButton icon="play"` beside Share / Add to list on `ayah-block.tsx` and the
  verse popup, once there is a per-sura or per-ruku link source.
