# Verse lists: design spec

## Context

Readers want to put Quranic verses together by theme or purpose, for example "Related to Mahdi ahs"
or "Verses to memorize", and share them. Today a reader can only bookmark a reading position or
share a single verse. All user data is private to its owner, in the Cosmos `user-data` container
partitioned by `/userId`, and the app has no favourites at all, although some docs still mention them.

This feature adds **verse lists**:
- A list has a title, a description and ordered **groups** of verses.
- It starts as a draft and is **published** to get a shareable link that anyone can open.
- Others can **favourite** it.
- Admin-chosen **featured** lists appear on every signed-in reader's Saved page.

Favourites are built as a generic mechanism so that chapters, rukus and verse ranges (for example
Ayat al-Kursi) can be added later without new endpoints or storage.

## Decisions (agreed in brainstorming)

| Topic | Decision |
|---|---|
| Who can open a shared link | Anyone, including anonymous readers. Favouriting is gated by the sign-in prompt. |
| After publish | The list stays editable live. Unpublish returns it to draft and the link shows "not available". Delete is permanent. |
| Group content | The caption, then the **Arabic only** in continuous mode (no translation or explanation), plus a link to the passage in the reader |
| Group bounds | Always within one chapter. No verse-count limit. Long groups are cut short with **Read more**, which opens a modal. |
| Adding groups | Both ways: the list editor (chapter, from and to pickers), and **Add to list** on a verse in the reader |
| Attribution | The account's `name` claim, shown automatically on published lists |
| Storage | A new Cosmos container `lists`, partitioned by `/id`. Favourites live in `user-data`. |
| Verses payload | A new Arabic-only endpoint |
| Saved page | A **Lists** tab with a vertical list in three groups: My collection, Featured, Others |
| Featured | `FEATURED_LIST_IDS` array in frontend source |
| Functions host | No parity. Lists exist only in the Minimal API. |

## 1. Data model

### List document (container `lists`, partition key `/id`)

```json
{
  "id": "k3Jd9QxP2mWa",
  "ownerId": "<oid>",
  "ownerName": "Noor Mahdi",
  "title": "Related to Mahdi ahs",
  "description": "…",
  "status": "draft",
  "createdAt": "…", "updatedAt": "…", "publishedAt": null,
  "groups": [
    { "id": "g7Qx", "chapter": 2, "fromVerse": 1, "toVerse": 5, "caption": "…" }
  ]
}
```

- **`id`:** 12 random base62 characters from a CSPRNG. It is unguessable, appears in the link, and must match `^[A-Za-z0-9]{12}$`.
- **`title`:** required, trimmed, 1–100 characters.
- **`description`:** optional, at most 1000 characters.
- **`ownerName`:** taken from the access token's `name` claim on every owner save, so a change of name carries through. If the claim is missing, it falls back to an empty string and the UI shows "A reader".
  - Implementation must check that CIAM access tokens carry `name`. If they don't, add it as an optional claim on the `Ishqnama API` registration (a portal step documented in `infra/README.md` §6).
- **Groups:**
  - They are inline, and their order is the order of the array.
  - Each has a `4`-character random id, unique within its list.
  - The bounds rule is `1 ≤ fromVerse ≤ toVerse ≤ verseCount(chapter)`. It is checked against the existing `ChapterVerseCounts` in `UserDataService` (move it to a shared static, `QuranShape`, so both services use it).
  - `caption` is optional, at most 300 characters.
  - A list holds at most 200 groups.
- **List count:** at most 100 per owner. Creating one more returns 409.
- **Visibility:** a draft can be read only by its owner. A published list can be read by anyone.

### Favourite document (container `user-data`, the reader's partition)

```json
{ "id": "fav_list_k3Jd9QxP2mWa", "userId": "<oid>", "type": "favorite",
  "kind": "list", "listId": "k3Jd9QxP2mWa", "title": "Related to Mahdi ahs", "createdAt": "…" }
```

- **The id is derived from the target**, so saving the same favourite twice is an idempotent upsert:
  - today: `fav_list_<id>`
  - later: `fav_chapter_<c>`, `fav_ruku_<id>`, `fav_verses_<c>_<from>_<to>`
- **`kind` is a discriminator.** Only `list` is implemented now. A new kind needs one validator, one id builder and one tile.
- **The `list` rules:** the list must be published, not mine, and not featured. A featured list can't be favourited because the frontend hides the button, and the API doesn't need to know about featured lists.
- **`title`** is a copy, so the Saved page shows favourites without another read. It is refreshed whenever the list is fetched again.

## 2. API (`backend/src/Ishqnama.Api`)

### Owner routes: `/api/user/lists`
These use the existing `/user` group, so they require authorisation and are never cached.

| Method | Route | Body / result |
|---|---|---|
| GET | `/user/lists` | `VerseListSummaryDto[]`, newest `updatedAt` first |
| POST | `/user/lists` | `{title, description?}` creates a draft and returns `VerseListDto` |
| GET | `/user/lists/{id}` | full `VerseListDto` (draft or published) |
| PUT | `/user/lists/{id}` | `{title, description?}` |
| PUT | `/user/lists/{id}/groups` | the full group array, which replaces the old one (add, remove, reorder, captions) |
| POST | `/user/lists/{id}/groups` | one group appended. Used by Add to list from the reader. |
| POST | `/user/lists/{id}/publish` · `/unpublish` | changes the status. `publishedAt` is set on first publish. |
| DELETE | `/user/lists/{id}` | deletes the list |

- An owner check failure returns **404**, the same as not found.
- Exceptions map to status codes as in `UserDataEndpoints.cs`: `ArgumentException` → 400, `InvalidOperationException` → 409, `KeyNotFoundException` → 404.

### Public routes (anonymous)

| Method | Route | Notes |
|---|---|---|
| GET | `/api/lists/{id}` | a published `VerseListDto` without `ownerId`. Returns 404 for a draft, a missing id or a malformed id, and a malformed id never reaches Cosmos. |
| GET | `/api/lists?ids=a,b,c` | summaries of the published lists among at most 50 ids, using `ReadManyItemsAsync`. Missing ids and drafts are left out. |
| GET | `/api/chapters/{c}/arabic?from=&to=` | `[{verseNumber, arabicText, hasSajdah}]` from `CachedQuranReadOnlyRepository`. Omitting both bounds returns the whole chapter. Otherwise it returns 400 unless `1 ≤ from ≤ to ≤ count`. It keeps the default 30-day immutable cache. |

- `CacheHeaderMiddleware` adds `/api/lists` to its exclusions, so a list that is edited live is never cached.
- `/api/chapters/*/arabic` stays cached, because the Quran text never changes.

### Favourite routes: `/api/user/favorites`

| Method | Route | Notes |
|---|---|---|
| GET | `/user/favorites` | `FavoriteDto[]` |
| PUT | `/user/favorites` | `{kind: "list", listId}`. An idempotent upsert that checks the list is published and not mine. |
| DELETE | `/user/favorites/{id}` | |

### Backend structure

The new code follows the existing patterns:
- **Domain:** `VerseList` and `VerseListGroup`, plus `UserFavorite` (`Type = "favorite"`).
- **Application:**
  - `IVerseListRepository`, and `IUserDataRepository` extended with favourite methods
  - `VerseListService`, which holds the validation, visibility rules and favourite id building
  - DTOs and request records
- **Infrastructure:** `CosmosVerseListRepository`, built from the same `CosmosClient` with container setting `CosmosDb:ListsContainerName` (default `lists`). It is registered in `AddUserDataInfrastructure`. My lists are a cross-partition query: `WHERE c.ownerId = @oid`.
- **Api:** `VerseListEndpoints.cs` and `FavoriteEndpoints.cs`. The `chapters/{c}/arabic` route goes in the existing verse/chapter endpoints.
  - **Every new DTO and request type goes in `Json/IshqnamaJsonContext.cs`**, because the JSON is source-generated and the publish is trimmed.
  - The owner name is read in `AuthExtensions` with `GetUserName()`, which returns the `name` claim.

## 3. Frontend (`frontend/src`)

### Routes
The static export means ids go in the query string.

**`/lists/view/?id=…`** (public, outside `/saved/`)
- The header shows the title, the description, and "Compiled by <ownerName>" with an initials avatar.
- **Each group** shows:
  - its caption
  - its reference ("Al-Baqarah 2:1–5", from the chapter names in static data)
  - the Arabic in continuous mode, reusing the reader's continuous verse and marker components. Ruku, sajdah and juz-quarter marks come from `src/data/rukus.ts` and `juz-quarters.ts`.
  - an "Open in reader" link to `/quran/<c>/?verse=<from>`
- **Read more:** a group longer than `GROUP_PREVIEW_VERSES = 10` shows only its first 10 verses, then **Read more**, which opens the full group in a bottom-sheet modal. The preview uses the same response cut short, because one request for each group, cached per `c:from-to` for the visit, is the simplest approach.
- **Actions:**
  - **Share** works the same way as `share-verse-sheet` (`navigator.share`, falling back to copying the link).
  - **Favourite** is `useSignInGate("favorites")`, shown when I'm not the owner and the list isn't featured.
  - The owner sees **Edit** instead.
- A draft, a missing list or a malformed id shows "This list isn't available".

**`/lists/edit/?id=…`** (behind `ProtectedRoute`)
- Fields for the title and description.
- **Group rows:**
  - a chapter picker
  - from and to pickers, bounded by the chapter's verse count from static data
  - a caption
  - move up/down and Remove
  - **Add group** at the end
- **Saving:** edits save themselves after a short pause, like `reader-settings-context.tsx`. A quiet "Saving…" or "Saved" line follows the readiness copy rules.
- **Publish and Unpublish:**
  - Publish confirms first with "Your name will show on this list, and anyone with the link can see it."
  - Once published, the page offers Share and Unpublish.
- **Delete** sits behind the existing confirm dialog.
- The editor fetches again when the window regains focus, so groups added from the reader in another tab show up.

### Saved page: Lists tab (`src/app/saved/page.tsx`)

A new tab next to Bookmarks and History.

**Rows.** A **vertical list**, not a rail. Each row shows:
- the title
- the description, cut to two lines
- an initials avatar with the owner's name
- for my own rows, a Draft or Published badge and an Edit action

A row links to the list's view page.

**Three sub-headed groups:**
1. **My collection:** my lists, both drafts and published, with **New list** at the top. New list opens a create dialog modelled on `create-bookmark-dialog.tsx` and then goes to the editor.
2. **Featured:** `FEATURED_LIST_IDS` from `src/config/featured-lists.ts`, fetched with `/api/lists?ids=`. Unpublished or missing entries are left out without any message.
3. **Others:** the reader's list favourites. A favourite whose list is gone shows "No longer available" with Remove.

**De-duplication:**
- My own list stays in My collection even if it's featured.
- A featured list I have favourited shows only under Featured.

**Loading** uses skeleton rows and the warming caption, as the Bookmarks tab does.

### Add to list from the reader

The verse action menu (continuous block and verse-mode popup, next to Share and Bookmark) gets **Add to list**, gated by `useSignInGate("lists")`. It opens a bottom sheet with:
- this verse filled in as from and to, where the to-ayah is editable within the chapter
- a caption
- a choice of one of my lists (drafts and published) or **New list…**
- the action `POST …/groups`, followed by "Added to <title>"

### Wiring

- **`src/lib/user-api.ts`:** the owner and favourite wrappers.
- **`src/lib/api.ts`:** `getPublicList`, `getListSummaries(ids)`, and `getChapterArabic(c, from, to)` (using `apiFetch`, with no auth).
- **`src/types/lists.ts`:** the DTO types.
- **`src/context/lists-context.tsx`:**
  - follows `bookmarks-context.tsx`: `status`, and a fetch again on `onReady()` after a failure
  - creating a list has a 90 s abort
  - holds my lists and my favourites
  - is mounted in `app-shell.tsx` after `BookmarksProvider`
- **`src/config/sign-in-copy.ts`:** `lists` and `favorites` entries. They must pass the non-technical copy test.
- **Readiness copy:** any new reader-facing text goes in `src/config/readiness-copy.ts` or a new `src/config/lists-copy.ts` under the same rules.
- **`src/lib/telemetry-events.ts`:** the events `list-created`, `list-published`, `list-group-added` and `list-favorited`. Their properties are counts only, never titles or captions. Update the privacy page's "How the site is used" section.
- **`src/lib/robots.ts`:** `Disallow: /lists/` in the production rules. The sitemap is unchanged, and the sitemap test still passes.
- **Metadata:** `/lists/` gets a server `layout.tsx` using `pageMetadata()`, with a generic title. The list title can't be known at build time.

## 4. Infra

- **Cosmos container:** `infra/modules/azure/cosmosdb/main.tf` gets a second container, `lists`, partitioned by `/id`, on the shared 400 RU/s database throughput, so it stays $0. Expose its name as an output.
- **Container App settings:** `infra/environments/{dev,prod}/ishqnama-api.tf` gets the env var `CosmosDb__ListsContainerName`.
- **Local emulator:** `backend/cosmos-init/01-seed.csh` runs `mkcon lists /id`.

## 5. Edge cases

- **Two tabs open:** an owner editing in two tabs gets last-write-wins on the whole document. That's acceptable for one person's own data.
- **Add to list while editing:** Add to list appends on the server, and the editor fetches again on focus.
- **Owner viewing their own list:** the owner can't favourite it. The view page shows Edit instead.
- **Inputs:** text from readers is always rendered as text, never as HTML.
- **Cold start:** every new fetch goes through `api-client.ts`, so the loading rail, the warm-up notice and the readiness states all apply.

## 6. Privacy and docs

- **Privacy page:**
  - a paragraph saying that publishing a list makes its title, description, verses and the owner's account name visible to anyone with the link
  - remove the stale favourites wording
- **`CLAUDE.md`, `backend/CLAUDE.md`:** document lists and favourites, and fix the stale favourites mentions.
- **`infra/README.md`:** document the `name` claim step, if it turns out to be needed.

## 7. Testing and verification

- **Backend:** add a new `backend/tests/Ishqnama.Application.Tests` (xUnit), the first backend test project, and add it to the solution and `pr-validation.yml`. It covers:
  - the `VerseListService` rules: title and description lengths, chapter and verse bounds, a group crossing into another chapter, 200 groups, 100 lists
  - the draft and published visibility rules
  - favourite id building and the "published and not mine" rule
  - the arabic range checks
- **Frontend (Vitest):** tests for
  - the lists context
  - the editor's group validation
  - the Saved Lists tab's grouping and de-duplication
  - group preview cut-off and Read more
  - sign-in gating of Favourite and Add to list
  - the robots `/lists/` disallow
  - plus the copy and colour-token tests, which pick up the new code automatically
- **Manual end-to-end:** run `docker-compose up -d` (with the emulator seeded with `lists`) and `npm run dev`, then:
  1. create a list
  2. add a group in the editor and one from the reader
  3. publish
  4. open the link in a private window, which shows Arabic only and Read more on a long group
  5. sign in as a second account and favourite it, so it appears under Others
  6. add its id to `FEATURED_LIST_IDS` and check it moves to Featured
  7. unpublish and check the link says not available, and Others says "No longer available"
- **Final checks:** `npm run lint`, `npm test`, `npm run build`, `dotnet build`, `dotnet test`, `terraform fmt -check`.

## Out of scope

Favourite kinds other than `list`; browsing or searching public lists; translations or tafseer on list
pages; editing by more than one person; moderation tools; parity in the Functions host.
