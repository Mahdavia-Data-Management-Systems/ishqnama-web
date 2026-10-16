# Articles: recordings

**Superseded 2026-10-16 by `plans/articles-reflections-plan.md`:** recordings on an essay are
now the essay JSON's `reflections`, pointing at podcast timelines in the public bucket under
`/podcasts/`; the separate manifest, the private bucket, the Worker and the signed links below
are not built. Kept as background only.

**Status: reviewed with the user (2026-10-14), to be implemented.** The implementation plan goes in
`plans/articles-recordings-plan.md`. The companion work, essays in other languages, is postponed
indefinitely and kept apart in `plans/articles-translations-spec.md`; nothing here depends on it.

## Context

The 22 Noor e Imaan essays are Urdu-only: one committed JSON file per essay, embedded in the API
and served verbatim to signed-in readers (`GET /api/articles/nooreimaan/{slug}`), rendered by
`EssayBody` under a reader toolbar (`plans/frontend-articles-spec.md`). An essay may now carry one
or more **recordings**: podcast-style discussions, a short summary, an in-depth discourse, a talk
on why the essay matters. They are not readings of the text. Each has a title, a caption, a
language (Urdu for now, English later) and a file. The reader must see the title and caption
before pressing Play. Hosting is a private Cloudflare R2 bucket behind a Cloudflare Worker on
`audio.ishqnama.com/recordings/*`, deployed from `infra/environments/cloudflare/`.

Decisions taken with the user: a free list of recordings per essay with title, caption and
language; a Worker-gated bucket, never a public one; **all audio comes from `audio.ishqnama.com`**,
the host that already serves the recitation, with no second audio host. The Worker takes only
the `/recordings/*` path on that host: a Workers route on a hostname takes precedence over an R2
custom domain on the same hostname, so `/recitations/*` keeps going straight to the public
`ishqnama-audio` bucket as today and `/recordings/*` goes to the Worker.

**One consequence of the Worker choice:** an `<audio>` element cannot send the bearer token, so the
Worker cannot check it. Instead the API (which has already validated the token) mints a
**short-lived signed link** for each recording, and the Worker verifies the signature and expiry
before streaming the object. The signing key is shared between the Worker and the API through
Terraform. Both buckets stay on the free tier; a Worker on the free plan serves 100k requests a day,
far above this readership.

## Storage and gating (infra)

All in `infra/environments/cloudflare/` (applied by the `setup-zone` job, which `infra-dev` already
waits for), new file `recordings.tf` plus `workers/recordings.js`:

- `cloudflare_r2_bucket.recordings`: `ishqnama-recordings`, no custom domain and no `r2.dev` URL,
  reachable only through the Worker's binding. The recitations stay in the public `ishqnama-audio`
  bucket; the two are never mixed, or the recordings would be public by URL.
- `random_password.recordings_signing_key` (48 chars; add the `random` provider to this
  environment's `providers.tf`).
- `cloudflare_workers_script.recordings`: name `ishqnama-recordings`, `module = true`,
  `content = file("workers/recordings.js")`, `r2_bucket_binding` `RECORDINGS` and
  `secret_text_binding` `SIGNING_KEY`.
- `cloudflare_workers_route.recordings`: `zone_id = module.ishqnama.zone_id`,
  `pattern = "audio.ishqnama.com/recordings/*"`, `script_name` from the script. No DNS change:
  `audio.ishqnama.com` is the hand-made R2 custom domain (proxied; `infra/README.md` section
  "Recitation audio on R2"), and the route rides on that proxied record. The pattern must stay
  this narrow: a wider one (`audio.ishqnama.com/*`) would swallow the recitation. Both resource
  names exist in provider 4.52 (`cloudflare_workers_script` with `r2_bucket_binding` /
  `secret_text_binding` blocks; `cloudflare_workers_route` with `pattern` and `script_name`).
- Output: `recordings_signing_key` (sensitive). No origin output: the origin is the recitation's,
  `https://audio.ishqnama.com`.
- Dev and prod: `data "tfe_outputs" "cloudflare"` (org `MDMS`, workspace `ishqnama-web-cloudflare`),
  secret `recordings-signing-key` → Container App env `Recordings__SigningKey` in
  `ishqnama-api.tf` (both environments). `Recordings__Origin` is not set in the cloud: the API's
  default is `https://audio.ishqnama.com`; only local development overrides it.
- Manual steps for `infra/README.md` (new section "Essay recordings on R2 behind a Worker"): extend
  the `CLOUDFLARE_API_TOKEN` of the `cloudflare` GitHub environment with Workers Scripts: Edit,
  Workers R2 Storage: Edit and Zone Workers Routes: Edit; in Terraform Cloud share the
  `ishqnama-web-cloudflare` workspace's state with `ishqnama-web-dev` and `ishqnama-web-prod` (as
  `core-*` already is); extend the owner's rclone R2 token to the new bucket (or add a second
  remote); rotate the key by tainting the `random_password`.

**Signed link**: `https://audio.ishqnama.com/recordings/<key>?exp=<unix seconds>&sig=<base64url,
no padding, of HMAC-SHA256(key, "<path>\n<exp>")>`, where `<path>` is the URL path including the
leading slash and the `/recordings/` prefix. Keys are `nooreimaan/<slug>/<file>.mp3` (the Worker
strips `/recordings/` from the path to get the bucket key), file names restricted to
`[a-z0-9-]+\.mp3` by the manifest check, so there is no percent-encoding ambiguity. Lifetime 24 h.
The prefix is free today: the recitation lives under `/recitations/<id>/v1/`, and nothing else is in
the public bucket.

**Worker** `workers/recordings.js` (plain ES module, no build step, no dependencies): GET/HEAD only
(405 otherwise); 403 when `exp`/`sig` are missing, expired or the HMAC (WebCrypto, constant-time
compare) does not match; 404 for a path outside `/recordings/`; `env.RECORDINGS.get(key,
{ range: request.headers })` with 404 when absent (no `onlyIf`: the response is `no-store`, so the browser never revalidates and a 304 path
would be dead code); responds 200 or 206 with `Content-Range` (from `object.range`),
`Accept-Ranges: bytes`, `Content-Length`, `ETag`, the object's `Content-Type`
(`writeHttpMetadata`), `Cache-Control: private, no-store`, and the same CORS headers the recitation
bucket exposes. Tested with `node --test` (`workers/recordings.test.mjs`, run by a new
`npm run recordings:test` from `frontend/`): a fake `env` with an in-memory bucket, a fixed key
vector shared with the C# signer test, expired and tampered links, a Range request.

## Backend

- **Manifest** `backend/src/Ishqnama.Application/Articles/nooreimaan-recordings.json` (own
  `EmbeddedResource` line; hand-written):
  `{ "<slug>": [ { "id": "summary", "language": "urdu", "title": "…", "caption": "…",
  "speaker"?: "…", "durationSeconds"?: 612, "file": "summary.mp3" } ] }`. `language` is the
  language spoken in the recording; it has nothing to do with the language the essay is read in.
- `RecordingsOptions` (`Origin` default `https://audio.ishqnama.com`, `SigningKey`,
  `LinkLifetimeHours` default 24) bound from `Recordings` in `Program.cs`, beside the existing
  `Auth`/`CosmosDb` reads. Links are `{Origin}/recordings/{key}?exp=&sig=`.
- `RecordingLinkSigner` in Application (pure: `Sign(path, expiresAt)` → URL; `HMACSHA256`, no
  packages), unit-tested with the shared vector.
- `ArticleService` loads the manifest: slugs must be known essays, ids unique per essay, language
  in {urdu, english}, file name matches the pattern. `GetRecordings(slug)` returns the rows.
- `GET /articles/nooreimaan/{slug}/recordings` (`RequireAuthorization`): `RecordingDto[]`
  (`id, language, title, caption, speaker?, durationSeconds?, url`), `[]` for an essay without
  recordings, 404 for an unknown slug. Add `RecordingDto`/`List<RecordingDto>` to
  `IshqnamaJsonContext`. When `Recordings:SigningKey` is unset the API logs a warning at startup
  and the endpoint returns `[]` (recordings off), so a misconfigured deploy never ships unsigned
  links. `/api/articles` is already `private, no-cache`.
- Backend `CLAUDE.md`: the route, the manifest, the options.

## Upload tooling

- `frontend/scripts/upload-recordings.mjs` (`npm run recordings:upload`, `--check` for validation
  only), modelled on the former `upload-recitation.mjs` (removed when the recitation moved to the manifest-driven `sync-audio.yml`): reads the manifest, requires every listed file under
  the gitignored `audio/recordings/nooreimaan/<slug>/`, requires the `r2:` remote, then
  `rclone copy` (never `sync`, so nothing is deleted from the bucket) to
  `r2:ishqnama-recordings/nooreimaan` with `--checksum`; no cache header (the Worker sets it).
  `missingRecordings()` tested with `node --test` under `recordings:test`.

## Frontend

- **Types**: `RecordingDto` in `src/types/articles.ts`. **API**: `getEssayRecordings(slug)` in
  `articles-api.ts`. **Hook** `src/hooks/use-essay-recordings.ts`: same shape as `useEssay`
  (per-visit cache, retry on `onReady`, `refresh()` that drops the cache).
- **`EssayRecordings`** (`src/components/articles/essay-recordings.tsx` + css), rendered by
  `EssayContent` above the body once the essay has loaded (inside the gate, so signed-in only).
  Nothing is rendered while loading, on failure, or when the list is empty: the text never waits
  for it. Otherwise a quiet section: heading "Recordings" (`AUDIO_COPY.recordingsHeading`), then one
  row per recording: a round Play button (the pause icon while this one plays, `aria-pressed`, the
  AyahBlock pattern), the title (`lang`/`dir` and Nastaleeq for Urdu), the caption muted beneath,
  and a meta line with the language name, the speaker when given, and the duration as "12 min".
  The playing row is washed `--tint-teal-8` like the verse being read. Design pass with the
  frontend-design skill; tokens only.
- **Playback**: one `Playlist` per recording, `{ id: \`article/${slug}/${rec.id}\`, clips: [{ url,
  title: rec.title, subtitle: essay English title }], href: essayPath(slug), reciter: rec.speaker }`,
  played with `play(playlist, 0, e.currentTarget)` from `useAudioPlayer()` (same-id `play` already
  toggles pause/resume). "This one is playing" is `status !== "closed" && player.playlist?.id ===
  id`, since `isCurrent` matches verse refs only. No `ref`, so `useFollowReading` is unaffected.
  `isReaderRoute` already counts essay pages, so the bar sits above the toolbar; the bar's title
  links back to the essay through `href`. When the bar reports `failed` for one of this essay's
  playlists (an expired link after a day-old tab), the component calls `refresh()` so the next Play
  carries fresh links.
- **Copy** in `src/config/audio-copy.ts` (checked by its test: sentence case, under 12 words,
  none of the banned words): `recordingsHeading`, `playRecording`, `minutes(n)`, language names.
- **Telemetry**: the provider's existing `recording-played` (`route`) and `recording-failed`
  (`reason`) cover it; no new event.
- Root `CLAUDE.md`: extend the **Articles** bullet (recordings, Worker, scripts).

## Files

Backend: `Services/ArticleService.cs`, `Services/RecordingLinkSigner.cs` (new),
`Endpoints/ArticleEndpoints.cs`, `Json/IshqnamaJsonContext.cs`, `Program.cs`,
`Ishqnama.Application.csproj`, `Articles/nooreimaan-recordings.json` (new),
`tests/.../ArticleServiceTests.cs`, `RecordingLinkSignerTests.cs` (new).

Frontend: `types/articles.ts`, `lib/articles-api.ts`, `hooks/use-essay-recordings.ts` (new),
`components/articles/{essay-content,essay-recordings}.tsx` and css, `config/audio-copy.ts`,
`scripts/upload-recordings.mjs` (new), `package.json` scripts, tests beside each.

Infra: `infra/environments/cloudflare/{recordings.tf,providers.tf,outputs.tf}`,
`infra/environments/cloudflare/workers/recordings.js` (+ test),
`infra/environments/{dev,prod}/{data.tf,ishqnama-api.tf}`, `infra/README.md`.

## Verification

1. `npm run recordings:test` (Worker, upload script), `npm test`, `npm run lint`, `npm run build`
   in `frontend/`; `dotnet build` and `dotnet test` in `backend/`; `terraform fmt -check -recursive`
   and `terraform validate` in `infra/environments/cloudflare`.
2. Put a sample `nooreimaan-recordings.json` entry with a local MP3 in place; `npm run
   recordings:upload --check` passes, and fails on a missing file, an unknown slug or a file name
   outside the pattern.
3. API locally (`docker-compose up -d`): `/recordings` → 401 without a token, `[]` without a
   signing key, signed links with one (`Recordings__SigningKey` and `Recordings__Origin` as env
   vars on the compose `api` service).
4. Worker locally: `node --test` covers the signature; for an end-to-end check point
   `Recordings__Origin` at a local Range-capable static server over `audio/recordings/` (it ignores
   the query string), as the recitation audio was verified.
5. `npm run dev` with Playwright, signed in: the recordings section lists title, caption, language
   and duration; Play opens the bar above the toolbar with the title linking back; a second press
   pauses; the row washes teal; the end closes the bar; an essay without recordings shows no
   section. Screenshots at 1280 and 375 px, light and dark.
6. After deploy: `terraform apply` of the cloudflare workspace creates the bucket, Worker and
   route; `npm run recordings:upload`; on dev.ishqnama.com a signed link plays, the same link with
   `exp` edited returns 403, the raw key with no query returns 403, and a recitation file
   (`/recitations/abdul-basit-murattal/v1/001.mp3`) still plays untouched.
