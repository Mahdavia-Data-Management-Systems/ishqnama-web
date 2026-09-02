# Plan: Azure Cosmos DB for User Data

**Status: IMPLEMENTED**

## Context

The app currently has no persistence for user-specific data. Reader settings (mode, lang, fontScale, showTafseer) are in-memory only via React context, bookmarks are local `useState` in `sura-reader-client.tsx`, and the Saved page (bookmarks/favourites/history tabs) shows empty states. The backend is entirely read-only (PostgreSQL for Quran data). This plan adds Cosmos DB (free tier) as a user data store, auth-protected write endpoints, and frontend integration.

## Prerequisites (Manual — Azure Portal)

CIAM (Entra ID External) tenants do **not** support custom API scopes on the same app registration that the SPA uses for sign-in. You must create a **separate** app registration for the API.

**App registrations:**
- **Ishqnama SPA** (frontend): `127f0236-2b16-4f7a-9394-9a27a5fc20d2` — handles user sign-in via MSAL.js redirect flow
- **Ishqnama API** (backend): `fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83` — exposes the `access_as_user` scope, used as the token audience

### Step 1: Create the API app registration

1. Go to **Azure Portal** → **App registrations** → **+ New registration**
2. Name: `Ishqnama API`
3. Supported account types: match your CIAM tenant configuration
4. No redirect URI needed
5. Click **Register**

### Step 2: Expose an API scope on the API app registration

1. Go to **App registrations** → select `Ishqnama API` (`fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83`)
2. In the left sidebar, click **Expose an API**
3. Next to "Application ID URI", click **Set** → accept default: `api://fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83`
4. Click **+ Add a scope**:
   - **Scope name**: `access_as_user`
   - **Who can consent**: Admins and users
   - **Admin consent display name**: `Access Ishqnama API`
   - **Admin consent description**: `Allows the app to access Ishqnama user data API on behalf of the signed-in user`
   - **User consent display name**: `Access your Ishqnama data`
   - **User consent description**: `Allows the app to read and write your settings, bookmarks, and history`
   - **State**: Enabled
5. Click **Add scope**

### Step 3: Grant the SPA permission to request the API scope

1. Go to **App registrations** → select the **SPA** app (`127f0236-2b16-4f7a-9394-9a27a5fc20d2`)
2. In the left sidebar, click **API permissions** → **+ Add a permission**
3. Select **My APIs** tab → select `Ishqnama API`
4. Check `access_as_user` → click **Add permissions**
5. Click **Grant admin consent for \<tenant\>**

### Result

The full scope URI used by the frontend (`src/config/auth-config.ts`):
```
api://fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83/access_as_user
```

The backend auth middleware (`AuthMiddleware.cs`) validates incoming tokens against the **API** app registration (`Auth__ClientId = fe35a79a-...`) — the token's `aud` claim will match this client ID. OIDC discovery still uses the same CIAM authority.

---

## Part 1: Infrastructure

### 1A. Terraform module: `infra/modules/azure/cosmosdb/`

Three files following existing module pattern (keyvault, functions, swa, aca):

**`variables.tf`** — inputs:
- `name` (string) — Cosmos DB account name
- `resource_group_name` (string)
- `location` (string)
- `database_name` (string, default `"ishqnama-userdata"`)
- `container_name` (string, default `"user-data"`)
- `partition_key_path` (string, default `"/userId"`)
- `tags` (map(string), default `{}`)

**`main.tf`** — provisions:
- `azurerm_cosmosdb_account` — NoSQL API (`kind = "GlobalDocumentDB"`), `free_tier_enabled = true`, Session consistency, single `geo_location` (uses `var.location`), provisioned throughput (free tier gives 1000 RU/s + 25 GB free monthly). Uses `offer_type = "Standard"`.
- `azurerm_cosmosdb_sql_database` — named `ishqnama-userdata`, `throughput = 400` (free tier covers this)
- `azurerm_cosmosdb_sql_container` — named `user-data`, `partition_key_paths = [var.partition_key_path]`, indexing policy with consistent mode, `/*` included path, `/_etag/?` excluded path, composite index on `(userId ASC, type ASC)`

**`outputs.tf`** — `endpoint`, `primary_key` (sensitive), `connection_string` (sensitive, `primary_sql_connection_string`), `database_name`, `container_name`

### 1B. Dev environment: `infra/environments/dev/ishqnama-userdata.tf`

Contains the module instantiation and Key Vault secret (not in `main.tf` as originally planned — keeps Cosmos DB resources self-contained):

```hcl
module "cosmosdb" {
  source = "../../modules/azure/cosmosdb"

  name                = "cosmos-ishqnama-dev"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  tags                = local.tags
}

resource "azurerm_key_vault_secret" "cosmosdb_key" {
  name         = "cosmosdb-primary-key"
  value        = module.cosmosdb.primary_key
  key_vault_id = module.keyvault.id
}
```

### 1C. Functions `app_settings`: `infra/environments/dev/ishqnama-api.tf`

Added `app_settings` block to the existing `module "functions"` call:
```hcl
app_settings = {
  "CosmosDb__Endpoint"      = module.cosmosdb.endpoint
  "CosmosDb__Key"           = module.cosmosdb.primary_key
  "CosmosDb__DatabaseName"  = module.cosmosdb.database_name
  "CosmosDb__ContainerName" = module.cosmosdb.container_name
  "Auth__ClientId"          = "fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83"
  "Auth__TenantId"          = data.tfe_outputs.mdms-core.values.tenant_id
  "Auth__Authority"         = "https://${data.tfe_outputs.mdms-core.values.tenant_domain}.ciamlogin.com/${data.tfe_outputs.mdms-core.values.tenant_id}/v2.0"
}
```

These are merged with the Functions module's default `FUNCTIONS_WORKER_RUNTIME` setting via `merge()` in the module's `main.tf`.

---

## Part 2: Backend

### 2A. Domain — `Ishqnama.Domain/Entities/`

New entities (sealed classes, matching Cosmos DB document shape with camelCase serialization):

**`UserSettings.cs`**
```csharp
public sealed class UserSettings
{
    public string Id { get; set; } = "settings";
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "settings";
    public string Mode { get; set; } = "verse";
    public string Lang { get; set; } = "urdu";
    public int FontScale { get; set; } = 1;
    public bool ShowTafseer { get; set; }
}
```

**`UserBookmark.cs`**
```csharp
public sealed class UserBookmark
{
    public string Id { get; set; } = null!;     // "bookmark_{chapter}_{verse}"
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "bookmark";
    public int ChapterNumber { get; set; }
    public int VerseNumber { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
```

**`UserFavorite.cs`** — same shape as bookmark but `Type = "favorite"`, Id = `"favorite_{chapter}_{verse}"`

**`UserHistoryEntry.cs`** — simplified from plan (dropped `DefaultTtl` property):
```csharp
public sealed class UserHistoryEntry
{
    public string Id { get; set; } = null!;     // "history_{unixTimestampMs}"
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "history";
    public int ChapterNumber { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}
```

### 2B. Application — DTOs & Interface

**DTOs** (all sealed records):
- `UserSettingsDto(string Mode, string Lang, int FontScale, bool ShowTafseer)`
- `UserBookmarkDto(int ChapterNumber, int VerseNumber, DateTimeOffset CreatedAt)`
- `UserFavoriteDto(int ChapterNumber, int VerseNumber, DateTimeOffset CreatedAt)`
- `UserHistoryDto(int ChapterNumber, DateTimeOffset Timestamp)`

**`Interfaces/IUserDataRepository.cs`** — new interface (separate from `IQuranReadOnlyRepository`):
```csharp
public interface IUserDataRepository
{
    Task<UserSettingsDto?> GetSettingsAsync(string userId);
    Task SaveSettingsAsync(string userId, UserSettingsDto settings);
    Task<IReadOnlyList<UserBookmarkDto>> GetBookmarksAsync(string userId);
    Task AddBookmarkAsync(string userId, int chapterNumber, int verseNumber);
    Task RemoveBookmarkAsync(string userId, int chapterNumber, int verseNumber);
    Task<IReadOnlyList<UserFavoriteDto>> GetFavoritesAsync(string userId);
    Task AddFavoriteAsync(string userId, int chapterNumber, int verseNumber);
    Task RemoveFavoriteAsync(string userId, int chapterNumber, int verseNumber);
    Task<IReadOnlyList<UserHistoryDto>> GetHistoryAsync(string userId, int limit = 50);
    Task AddHistoryEntryAsync(string userId, int chapterNumber);
}
```

**`Services/UserDataService.cs`** — thin service wrapping `IUserDataRepository`:
- Validates `chapterNumber` (1–114), `verseNumber` (≥ 1) using `ArgumentOutOfRangeException.ThrowIf*`
- Clamps history `limit` to 1–200 via `Math.Clamp`
- Pass-through for get operations (no extra validation needed)

### 2C. Infrastructure — Cosmos DB SDK

**NuGet added**: `Microsoft.Azure.Cosmos` v3.46.1 to `Ishqnama.Infrastructure.csproj`

**Build note**: `Microsoft.Azure.Cosmos` requires Newtonsoft.Json. Since we use `CosmosSerializationOptions` with `PropertyNamingPolicy = CamelCase` (not Newtonsoft), added `<AzureCosmosDisableNewtonsoftJsonCheck>true</AzureCosmosDisableNewtonsoftJsonCheck>` to both `Ishqnama.Infrastructure.csproj` and `Ishqnama.Functions.csproj` (transitive dependency).

**`Repositories/CosmosUserDataRepository.cs`** — implements `IUserDataRepository`:
- Primary constructor: `CosmosUserDataRepository(CosmosClient, string databaseName, string containerName)`
- `Container` property: `cosmosClient.GetContainer(databaseName, containerName)`
- All operations use `PartitionKey(userId)` for efficient single-partition queries
- Settings: `ReadItemAsync` (catch 404 → null) / `UpsertItemAsync`
- Bookmarks/Favorites: SQL query with `ORDER BY c.createdAt DESC`, add via `UpsertItemAsync` (idempotent), delete via `DeleteItemAsync` (catch 404 → no-op)
- History: SQL query with `ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit`, add generates Id from `DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()`

**`DependencyInjection.cs`** — added `AddUserDataInfrastructure()` extension:
```csharp
public static IServiceCollection AddUserDataInfrastructure(
    this IServiceCollection services, string endpoint, string key,
    string databaseName, string containerName)
{
    services.AddSingleton(_ =>
    {
        var options = new CosmosClientOptions
        {
            SerializerOptions = new CosmosSerializationOptions
            {
                PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
            }
        };

        // Bypass self-signed cert for local Cosmos DB emulator
        if (endpoint.Contains("localhost:8081", StringComparison.OrdinalIgnoreCase))
        {
            options.HttpClientFactory = () =>
            {
                var handler = new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback =
                        HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                };
                return new HttpClient(handler);
            };
            options.ConnectionMode = ConnectionMode.Gateway;
        }

        return new CosmosClient(endpoint, key, options);
    });
    services.AddSingleton<IUserDataRepository>(sp =>
        new CosmosUserDataRepository(
            sp.GetRequiredService<CosmosClient>(), databaseName, containerName));
    return services;
}
```

### 2D. Functions — Auth Middleware & Endpoints

**NuGet added**: `Microsoft.Identity.Web` v3.8.3 to `Ishqnama.Functions.csproj` (provides `Microsoft.IdentityModel.Protocols.OpenIdConnect`, `System.IdentityModel.Tokens.Jwt`, `Microsoft.IdentityModel.Tokens`)

**`Middleware/AuthMiddleware.cs`**:
- Implements `IFunctionsWorkerMiddleware` (same pattern as `CorsMiddleware`, `ExceptionHandlingMiddleware`)
- Constructor takes `IConfiguration` + `ILogger<AuthMiddleware>`
- Reads `Auth:ClientId` and `Auth:Authority` from config (uses `:` separator — .NET normalizes `__` to `:` when loading environment variables)
- Creates `ConfigurationManager<OpenIdConnectConfiguration>` for OIDC discovery (`{authority}/.well-known/openid-configuration`)
- Route check: `httpContext.Request.Path.StartsWithSegments("/api/user")` — only protects `/api/user/*` routes
- Token extraction: parses `Authorization: Bearer <token>` header
- Validation: `JwtSecurityTokenHandler.ValidateToken()` with `TokenValidationParameters` (issuer from OIDC config, audience = clientId, signing keys from OIDC config, lifetime validation)
- User ID: extracts `oid` claim (falls back to `sub` claim)
- Stores in `httpContext.Items["UserId"]`
- Returns 401 JSON response on missing/invalid token or missing user ID
- Non-user routes pass through unmodified (existing anonymous endpoints unaffected)

**`Functions/UserDataFunctions.cs`** — 10 HTTP trigger functions:

| Function | Method | Route | Description |
|----------|--------|-------|-------------|
| GetUserSettings | GET | `user/settings` | Returns `UserSettingsDto` or null |
| SaveUserSettings | PUT | `user/settings` | Body: `UserSettingsDto` |
| GetUserBookmarks | GET | `user/bookmarks` | Returns `UserBookmarkDto[]` |
| AddUserBookmark | POST | `user/bookmarks` | Body: `{ chapterNumber, verseNumber }` |
| RemoveUserBookmark | DELETE | `user/bookmarks/{chapter}/{verse}` | Route params |
| GetUserFavorites | GET | `user/favorites` | Returns `UserFavoriteDto[]` |
| AddUserFavorite | POST | `user/favorites` | Body: `{ chapterNumber, verseNumber }` |
| RemoveUserFavorite | DELETE | `user/favorites/{chapter}/{verse}` | Route params |
| GetUserHistory | GET | `user/history` | Query param: `limit` (default 50) |
| AddUserHistory | POST | `user/history` | Body: `{ chapterNumber }` |

Private request models: `BookmarkRequest(int ChapterNumber, int VerseNumber)`, `HistoryRequest(int ChapterNumber)` — sealed records inside the class.

All functions extract userId via `GetUserId(httpContext)` → `(string)httpContext.Items["UserId"]!`. All use `AuthorizationLevel.Anonymous` (auth handled by middleware, not Azure Functions keys).

**`Program.cs`** changes:
- Middleware pipeline order: CORS → **Auth** → ExceptionHandling → CacheHeaders
- Cosmos DB registration is **conditional**: only registers if both `CosmosDb:Endpoint` and `CosmosDb:Key` config values are non-empty (allows backend to start without Cosmos DB for read-only Quran endpoints). Note: C# code uses `:` separator for config lookups — .NET's configuration system normalizes the `__` from environment variables / `local.settings.json` to `:`.
- Added `services.AddScoped<UserDataService>()`

**CORS middleware** (`CorsMiddleware.cs`) updated:
- `Access-Control-Allow-Methods`: `"GET, POST, PUT, DELETE, OPTIONS"` (was `"GET, OPTIONS"`)
- `Access-Control-Allow-Headers`: `"Content-Type, Accept, Authorization"` (was `"Content-Type, Accept"`)

**`local.settings.json`** — added Cosmos DB emulator + auth settings:
```json
{
  "Values": {
    "CosmosDb__Endpoint": "https://localhost:8081",
    "CosmosDb__Key": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    "CosmosDb__DatabaseName": "ishqnama-userdata",
    "CosmosDb__ContainerName": "user-data",
    "Auth__ClientId": "fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83",
    "Auth__TenantId": "74c3a531-69e8-4b19-92dc-498a4ab5aaf7",
    "Auth__Authority": "https://mahdavisonlinedev.ciamlogin.com/74c3a531-69e8-4b19-92dc-498a4ab5aaf7/v2.0"
  }
}
```

> The Cosmos DB Emulator key above is the well-known default emulator key. Run `bash start-local.sh` from the `backend/` directory to auto-start the emulator container via Podman alongside PostgreSQL.

---

## Part 3: Frontend

### 3A. Token acquisition — `src/lib/api-client.ts`

Added `authenticatedApiFetch<T>()` alongside existing `apiFetch<T>()`:
- Imports `InteractionRequiredAuthError` from `@azure/msal-browser`, `msalInstance` from auth-provider, `apiScope` from auth-config
- Gets active account via `msalInstance.getActiveAccount()`
- If no account: calls `acquireTokenRedirect()` (navigates away) and throws
- Calls `acquireTokenSilent()` with scope `api://fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83/access_as_user` (the API app registration)
- On `InteractionRequiredAuthError`: falls back to `acquireTokenRedirect()`
- Attaches `Authorization: Bearer <token>` header
- Handles JSON body serialization (`Content-Type: application/json`)
- Handles empty response bodies (PUT/POST/DELETE return 200 with no body) — reads as text, parses only if non-empty

**Note**: MSAL v5 `InteractionRequiredAuthError` constructor requires `(errorCode, correlationId, ...)` — cannot construct with just a message. Handled by checking for no active account separately before the try/catch.

### 3B. Auth config — `src/config/auth-config.ts`

Added API scope constant pointing to the **API** app registration (not the SPA):
```typescript
export const apiScope = "api://fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83/access_as_user";
```

### 3C. Auth provider — `src/components/auth-provider.tsx`

Changed `const msalInstance` to `export const msalInstance` so `api-client.ts` can import it.

### 3D. User data API — `src/lib/user-api.ts`

New file with typed wrapper functions (all use `authenticatedApiFetch`):

```typescript
// Settings
getUserSettings(signal?) → Promise<UserSettingsDto | null>
saveUserSettings(settings, signal?) → Promise<void>

// Bookmarks
getUserBookmarks(signal?) → Promise<UserBookmarkDto[]>
addBookmark(chapterNumber, verseNumber) → Promise<void>
removeBookmark(chapterNumber, verseNumber) → Promise<void>

// Favorites
getUserFavorites(signal?) → Promise<UserFavoriteDto[]>
addFavorite(chapterNumber, verseNumber) → Promise<void>
removeFavorite(chapterNumber, verseNumber) → Promise<void>

// History
getUserHistory(signal?) → Promise<UserHistoryDto[]>
addHistoryEntry(chapterNumber) → Promise<void>
```

### 3E. Types — `src/types/user.ts`

New file with TypeScript interfaces:
- `UserSettingsDto { mode, lang, fontScale, showTafseer }`
- `UserBookmarkDto { chapterNumber, verseNumber, createdAt: string }`
- `UserFavoriteDto { chapterNumber, verseNumber, createdAt: string }`
- `UserHistoryDto { chapterNumber, timestamp: string }`

### 3F. Reader settings persistence — `src/context/reader-settings-context.tsx`

- Added `useEffect` on mount (when `isAuthenticated`): calls `getUserSettings()`, populates state with response or keeps defaults on failure
- Added `loaded` state flag to prevent saving before initial load completes
- Added `persistSettings()` callback with 500ms debounce via `useRef<setTimeout>`
- Each setter (`setMode`, `setLang`, `setFontScale`, `setShowTafseer`) now calls `persistSettings()` after updating local state
- `saveUserSettings()` failures are caught silently — settings remain in-memory
- Cleanup: `AbortController` on unmount aborts the initial load fetch

### 3G. Bookmarks persistence — `src/app/quran/[sura]/sura-reader-client.tsx`

- Added `useIsAuthenticated()` hook import from `@azure/msal-react`
- Added `useEffect` on mount: fetches all bookmarks via `getUserBookmarks()`, filters to current sura, populates `bookmarked` Set
- Added `useEffect` on mount: records reading history via `addHistoryEntry(suraNumber)` (fires once per sura visit)
- Updated `toggleBookmark()`: wraps in `useCallback` with optimistic local state update, then calls `addBookmark()` or `removeBookmark()` API in background (failures silent)
- Both effects depend on `[isAuthenticated, suraNumber]` and clean up via `AbortController`

### 3H. Saved page — `src/app/saved/page.tsx`

- Added `useIsAuthenticated()` hook — only fetches data when authenticated
- Added state for `bookmarks`, `favorites`, `history` arrays + `loading` flag
- Added `useEffect` per `tab` change: fetches appropriate data via `getUserBookmarks()` / `getUserFavorites()` / `getUserHistory()`
- Renders list items with:
  - Bookmarks/Favorites: `"{suraName} — Verse {verseNumber}"` + `"{chapter}:{verse}"` metadata
  - History: `"{suraName}"` + formatted date
- Each item is a button linking to `/quran/{chapterNumber}/`
- Keeps empty state (`<EmptyState>`) when no items exist
- Shows "Loading..." text during fetch
- Sura name lookup via static `suras` data (`@/data/suras`)

**`page.module.css`** — added list styles: `.list`, `.item`, `.itemButton`, `.itemTitle`, `.itemMeta`, `.loadingText` with hover state and proper spacing

---

## Files Created

| File | Layer | Description |
|------|-------|-------------|
| `infra/modules/azure/cosmosdb/variables.tf` | Infra | Module inputs |
| `infra/modules/azure/cosmosdb/main.tf` | Infra | Cosmos DB account, database, container |
| `infra/modules/azure/cosmosdb/outputs.tf` | Infra | Module outputs |
| `infra/environments/dev/ishqnama-userdata.tf` | Infra | Module instantiation + Key Vault secret |
| `backend/src/Ishqnama.Domain/Entities/UserSettings.cs` | Domain | Settings entity |
| `backend/src/Ishqnama.Domain/Entities/UserBookmark.cs` | Domain | Bookmark entity |
| `backend/src/Ishqnama.Domain/Entities/UserFavorite.cs` | Domain | Favorite entity |
| `backend/src/Ishqnama.Domain/Entities/UserHistoryEntry.cs` | Domain | History entity |
| `backend/src/Ishqnama.Application/Dtos/UserSettingsDto.cs` | Application | Settings DTO |
| `backend/src/Ishqnama.Application/Dtos/UserBookmarkDto.cs` | Application | Bookmark DTO |
| `backend/src/Ishqnama.Application/Dtos/UserFavoriteDto.cs` | Application | Favorite DTO |
| `backend/src/Ishqnama.Application/Dtos/UserHistoryDto.cs` | Application | History DTO |
| `backend/src/Ishqnama.Application/Interfaces/IUserDataRepository.cs` | Application | Repository interface |
| `backend/src/Ishqnama.Application/Services/UserDataService.cs` | Application | Validation service |
| `backend/src/Ishqnama.Infrastructure/Repositories/CosmosUserDataRepository.cs` | Infrastructure | Cosmos DB implementation |
| `backend/src/Ishqnama.Functions/Middleware/AuthMiddleware.cs` | Functions | JWT auth middleware |
| `backend/src/Ishqnama.Functions/Functions/UserDataFunctions.cs` | Functions | 10 HTTP endpoints |
| `frontend/src/lib/user-api.ts` | Frontend | Typed API wrapper |
| `frontend/src/types/user.ts` | Frontend | TypeScript DTOs |
| `backend/start-local.sh` | Backend | Local dev startup script (Podman containers + func start) |
| `backend/cosmos-init/01-seed.csh` | Backend | Cosmos DB emulator init script (creates database + container) |

## Files Modified

| File | Change |
|------|--------|
| `infra/environments/dev/ishqnama-api.tf` | Added `app_settings` with Cosmos DB + auth config |
| `backend/src/Ishqnama.Infrastructure/Ishqnama.Infrastructure.csproj` | Added `Microsoft.Azure.Cosmos` v3.46.1 + `AzureCosmosDisableNewtonsoftJsonCheck` |
| `backend/src/Ishqnama.Infrastructure/DependencyInjection.cs` | Added `AddUserDataInfrastructure()` extension method |
| `backend/src/Ishqnama.Functions/Ishqnama.Functions.csproj` | Added `Microsoft.Identity.Web` v3.8.3 + `AzureCosmosDisableNewtonsoftJsonCheck` |
| `backend/src/Ishqnama.Functions/Program.cs` | Added AuthMiddleware, conditional Cosmos DB registration, UserDataService |
| `backend/src/Ishqnama.Functions/local.settings.json` | Added Cosmos DB emulator + auth settings with real tenant values |
| `backend/src/Ishqnama.Functions/Middleware/CorsMiddleware.cs` | Added POST/PUT/DELETE methods and Authorization header to CORS |
| `frontend/src/lib/api-client.ts` | Added `authenticatedApiFetch()` with MSAL token acquisition |
| `frontend/src/config/auth-config.ts` | Added `apiScope` constant |
| `frontend/src/components/auth-provider.tsx` | Exported `msalInstance` |
| `frontend/src/context/reader-settings-context.tsx` | Added API load/save with debounce |
| `frontend/src/app/quran/[sura]/sura-reader-client.tsx` | Added bookmark API sync + history recording |
| `frontend/src/app/saved/page.tsx` | Fetches real data, renders bookmark/favorite/history lists |
| `frontend/src/app/saved/page.module.css` | Added list/item styles |
| `backend/src/Ishqnama.Functions/local.settings.json.example` | Added Cosmos DB, CORS, Auth placeholder settings |

---

## Implementation Notes

1. **Newtonsoft.Json bypass**: `Microsoft.Azure.Cosmos` v3.46.1 requires a Newtonsoft.Json reference by default. Since we use the built-in `CosmosSerializationOptions` (not Newtonsoft), `<AzureCosmosDisableNewtonsoftJsonCheck>true</AzureCosmosDisableNewtonsoftJsonCheck>` is set in both `.csproj` files that transitively reference the package.

2. **MSAL v5 constructor change**: `InteractionRequiredAuthError` in `@azure/msal-browser` v5 requires `(errorCode, correlationId, ...)` — not a single message string. The `authenticatedApiFetch` handles the no-active-account case with a separate check before the try/catch block.

3. **Conditional Cosmos DB registration**: `Program.cs` only calls `AddUserDataInfrastructure()` if both `CosmosDb:Endpoint` and `CosmosDb:Key` config values are non-empty. C# config lookups use `:` separator because .NET normalizes `__` from environment variables to `:`. The `local.settings.json` and Terraform `app_settings` correctly use `__` (the standard for env var names on Windows). This allows the backend to start without Cosmos DB (existing read-only endpoints continue to work).

4. **Key Vault secret placement**: Placed the `azurerm_key_vault_secret` for the Cosmos DB key in `ishqnama-userdata.tf` (alongside the module) rather than `main.tf`, keeping all Cosmos DB resources in one file.

5. **CORS update**: The CORS middleware was updated to allow `POST`, `PUT`, `DELETE` methods and the `Authorization` header, which are required by the new user data endpoints.

6. **Middleware ordering**: Auth middleware runs after CORS (so preflight OPTIONS requests get proper CORS headers before auth check) but before ExceptionHandling and CacheHeaders.

7. **SSG warnings**: During `npm run build`, MSAL logs `"window is not defined"` errors — these are expected during static site generation and do not affect the build or runtime behavior.

8. **Cosmos DB emulator SSL bypass**: The `AddUserDataInfrastructure()` method detects `localhost:8081` in the endpoint and configures `DangerousAcceptAnyServerCertificateValidator` + `ConnectionMode.Gateway` to work with the emulator's self-signed certificate. Gateway mode is required when using a custom `HttpClientFactory`. This has no effect in production (endpoint won't be localhost).

9. **Separate API app registration (CIAM requirement)**: Entra ID External (CIAM) tenants do not support custom API scopes on the same app registration used for SPA sign-in. A separate app registration (`Ishqnama API`: `fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83`) was created to expose the `access_as_user` scope. The SPA app registration (`127f0236-...`) has an API permission grant for this scope. The backend `Auth__ClientId` is set to the API app's client ID because the access token's `aud` claim will be the API app. The frontend `apiScope` is hardcoded to `api://fe35a79a-4d68-4e7c-bfa7-6ef1c4af4f83/access_as_user` (not derived from the SPA's client ID env var).

---

## Verification

1. **Infra**: `terraform fmt -check -recursive` — passes ✅
2. **Backend build**: `dotnet build` from `backend/` — 0 errors, 0 warnings ✅
3. **Frontend build**: `npm run build` in `frontend/` — 125 static pages generated ✅
4. **Backend local run**: Run `cd backend && bash start-local.sh` (starts PostgreSQL + Cosmos DB emulator via Podman, waits for readiness, launches `func start`), then test:
   - `GET /api/user/settings` with Bearer token → 200 (null/default settings)
   - `PUT /api/user/settings` with body → 200
   - `POST /api/user/bookmarks` with body → 200
   - `GET /api/user/bookmarks` → 200 with bookmark list
   - Request without token → 401
   - Existing endpoints (`GET /api/chapters`) → still work without token
5. **Frontend local**: `npm run dev`, sign in, change reader settings, reload — settings should persist
6. **E2E**: Sign in → read a sura → bookmark a verse → go to Saved page → see bookmark listed
