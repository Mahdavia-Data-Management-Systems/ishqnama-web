# Ishqnama API — Original Project Plan (SUPERSEDED)

> **Status: SUPERSEDED** — This was the original plan for the API. The project has since evolved significantly: SQLite → PostgreSQL, Minimal API → Azure Functions (isolated worker), APIM removed, Clean Architecture adopted (see `backend/plans/clean-arch.md`), and .NET 10 → .NET 9. This file is kept for historical reference only.

## Context

The existing `NoorEImaan.Database` SQL Server Database Project stores Quranic data (verses, translations, tafseer) across 8 tables with ~19MB of seed data. It has several schema shortcomings (no indexes, NVARCHAR(MAX) everywhere, no unique constraints, naming inconsistencies, missing tables).

This plan creates a new .NET 10 Web API that redesigns the schema, seeds data into SQLite, and serves it as a read-only public API for web/mobile apps. SQLite is baked into the Docker image for Azure Container App deployment.

---

## Solution Structure

```
IshqnamaProject/
  Ishqnama.sln
  global.json                              # Pin SDK to 10.0.300

  src/
    Ishqnama.Api/                          # .NET 10 Minimal API
      Ishqnama.Api.csproj
      Program.cs
      Models/                              # EF Core entities (read-only POCOs)
        Chapter.cs
        Verse.cs
        Juz.cs
        Manzil.cs
        Ruku.cs
        Language.cs
        Script.cs
        Translation.cs
        TranslationSegment.cs
        ChapterTranslation.cs
      Data/
        QuranDbContext.cs
        Configurations/                    # IEntityTypeConfiguration<T> per entity
          ChapterConfiguration.cs
          VerseConfiguration.cs
          JuzConfiguration.cs
          ManzilConfiguration.cs
          RukuConfiguration.cs
          LanguageConfiguration.cs
          ScriptConfiguration.cs
          TranslationConfiguration.cs
          TranslationSegmentConfiguration.cs
          ChapterTranslationConfiguration.cs
        SeedData/                           # JSON seed data (converted once from SQL)
          chapters.json
          chapter-translations.json
          juz.json
          manzils.json
          rukus.json
          verses.json
          languages.json
          scripts.json
          translations.json
          translation-segments.json         # Merged tarjuma + tafseer per translation
        DataSeeder.cs                       # Reads JSON, calls HasData() or bulk inserts
      Migrations/                           # EF Core migrations
      Endpoints/                           # Minimal API endpoint groups
        ChapterEndpoints.cs
        VerseEndpoints.cs
        JuzEndpoints.cs
        RukuEndpoints.cs
        TranslationEndpoints.cs
      Dtos/                                # Response records
        ChapterDto.cs
        ChapterDetailDto.cs
        VerseDto.cs
        JuzDto.cs
        RukuDto.cs
        TranslationDto.cs
        PagedResponse.cs
      Mappings/
        DtoMappings.cs                     # Extension methods: entity → DTO
      Middleware/
        GlobalExceptionHandler.cs
      appsettings.json
      Dockerfile

  data/                                    # Output: generated quran.db (gitignored)
```

**Why this structure**: A read-only data-serving API doesn't need Clean Architecture layers. No commands, no business logic, no mutations. A single project with folder separation is sufficient. Data is seeded via EF Core migrations using JSON files — no separate DbBuilder project needed.

---

## Redesigned Schema

### Entity Models

#### Language (natural key)
```
LanguageCode TEXT PK (e.g., "en", "ur", "hi", "ar")  — ISO 639-1
Name TEXT NOT NULL (e.g., "English")
NativeName TEXT NULL (e.g., "اردو")
IsRTL INTEGER NOT NULL DEFAULT 0
```

#### Script (new table, natural key)
```
ScriptCode TEXT PK (e.g., "Latn", "Arab", "Deva")  — ISO 15924
Name TEXT NOT NULL (e.g., "Latin", "Arabic", "Devanagari")
NativeName TEXT NULL
IsRTL INTEGER NOT NULL DEFAULT 0
```

#### Chapter (natural key: 1–114)
```
ChapterNumber INTEGER PK (1–114)
ArabicName TEXT NOT NULL
TransliteratedName TEXT NOT NULL           -- was ChapterNameEn
RevelationType TEXT NOT NULL ("Meccan"/"Medinan")  -- was IsMadaniRevelation BIT
VerseCount INTEGER NOT NULL                -- precomputed, was derived via view
RevelationOrder INTEGER NULL               -- for future use
```

#### ChapterTranslation (composite key)
```
ChapterNumber INTEGER NOT NULL  FK → Chapter
LanguageCode TEXT NOT NULL  FK → Language
TranslatedName TEXT NOT NULL
PK (ChapterNumber, LanguageCode)
```

#### Juz (natural key: 1–30)
```
JuzNumber INTEGER PK (1–30)
ArabicName TEXT NOT NULL
TransliteratedName TEXT NOT NULL
```

#### Manzil (new table, natural key: 1–7)
```
ManzilNumber INTEGER PK (1–7)
ArabicName TEXT NOT NULL
TransliteratedName TEXT NOT NULL
```

#### Ruku (surrogate key — no single natural key)
```
RukuId INTEGER PK AUTOINCREMENT
ChapterNumber INTEGER NOT NULL  FK → Chapter
JuzNumber INTEGER NOT NULL  FK → Juz
RankInChapter INTEGER NOT NULL
RankInJuz INTEGER NOT NULL
VerseCount INTEGER NOT NULL
UNIQUE (ChapterNumber, RankInChapter)
```

#### Verse (composite natural key)
```
ChapterNumber INTEGER NOT NULL  FK → Chapter
VerseNumber INTEGER NOT NULL               -- 0 = Bismillah
ArabicText TEXT NOT NULL
JuzNumber INTEGER NOT NULL  FK → Juz
RukuId INTEGER NOT NULL  FK → Ruku
ManzilNumber INTEGER NOT NULL  FK → Manzil
HasSajdah INTEGER NOT NULL DEFAULT 0
PK (ChapterNumber, VerseNumber)
```

#### Translation (surrogate — multiple translations per language possible)
```
TranslationId INTEGER PK AUTOINCREMENT
LanguageCode TEXT NOT NULL  FK → Language   -- content language
ScriptCode TEXT NOT NULL  FK → Script       -- writing system
BookName TEXT NOT NULL
Translator TEXT NOT NULL
Description TEXT NULL
BookNameInScript TEXT NULL
TranslatorInScript TEXT NULL
DescriptionInScript TEXT NULL
UNIQUE (LanguageCode, ScriptCode, BookName)
```

#### TranslationSegment
```
TranslationSegmentId INTEGER PK AUTOINCREMENT
TranslationId INTEGER NOT NULL  FK → Translation
ChapterNumber INTEGER NOT NULL
VerseNumber INTEGER NOT NULL
SegmentIndex INTEGER NOT NULL DEFAULT 0
TranslationText TEXT NULL                  -- Tarjuma
Explanation TEXT NULL                      -- Tafseer
FK (ChapterNumber, VerseNumber) → Verse
UNIQUE (TranslationId, ChapterNumber, VerseNumber, SegmentIndex)
CHECK (TranslationText IS NOT NULL OR Explanation IS NOT NULL)
```

### Indexes
```sql
-- Verse lookups by juz, ruku, manzil
CREATE INDEX IX_Verses_JuzNumber ON Verses(JuzNumber);
CREATE INDEX IX_Verses_RukuId ON Verses(RukuId);
CREATE INDEX IX_Verses_ManzilNumber ON Verses(ManzilNumber);

-- Translation segment hot path
CREATE INDEX IX_TranslationSegments_Verse ON TranslationSegments(ChapterNumber, VerseNumber);

-- Ruku lookups
CREATE INDEX IX_Rukus_ChapterNumber ON Rukus(ChapterNumber);
CREATE INDEX IX_Rukus_JuzNumber ON Rukus(JuzNumber);

-- Chapter translation lookup
CREATE INDEX IX_ChapterTranslations_Language ON ChapterTranslations(LanguageCode);
```

---

## API Endpoints

All under `/api/`:

| Method | Route | Description | Maps to old proc |
|--------|-------|-------------|-----------------|
| GET | `/chapters` | All 114 chapters with verse counts | GetSuras |
| GET | `/chapters?lang={code}` | Chapters with translated names | GetSurasByLanguageID |
| GET | `/chapters/{num}` | Single chapter detail | — |
| GET | `/chapters/{num}/verses?translationId=&page=&pageSize=` | Verses in a chapter (paginated) | GetAyathTranslationBySura, ByPagination |
| GET | `/chapters/{num}/verses/{verseNum}` | Single verse with all translations | GetAyathTranslation |
| GET | `/juz` | All 30 juz with start/end ranges | AllAjza view |
| GET | `/juz/{num}/verses?translationId=&page=&pageSize=` | Verses in a juz | GetAyathTranslationByJuz |
| GET | `/rukus?chapterNum=&juzNum=` | Rukus filtered by chapter or juz | — |
| GET | `/rukus/{id}/verses?translationId=` | Verses in a ruku | GetAyathTranslationByRuku |
| GET | `/translations` | Available translations | GetAllTranslationsInfo |
| GET | `/verses?from={s:v}&to={s:v}&translationId=` | Verse range query | GetAyathTranslationByRange |
| GET | `/healthz` | Health check | — |

### Response Format
```json
// GET /api/chapters/1
{
  "chapterNumber": 1,
  "arabicName": "الفاتحة",
  "transliteratedName": "al-Fātiḥah",
  "revelationType": "Meccan",
  "verseCount": 7
}

// GET /api/chapters/1/verses?translationId=2
{
  "items": [
    {
      "chapterNumber": 1,
      "verseNumber": 1,
      "arabicText": "...",
      "juzNumber": 1,
      "rukuId": 1,
      "hasSajdah": false,
      "translations": [
        {
          "translationId": 2,
          "segmentIndex": 0,
          "translationText": "...",
          "explanation": "..."
        }
      ]
    }
  ],
  "page": 1,
  "pageSize": 50,
  "totalCount": 7
}
```

### Caching Strategy (immutable master data)

Since Quran data never changes, caching is maximally aggressive at every layer:

**Layer 1: In-memory preloading (startup)**
Small, frequently accessed datasets are loaded into memory at startup and served without hitting SQLite:
- Chapters list (114 records) → singleton `List<ChapterDto>`
- Juz list (30 records) → singleton `List<JuzDto>`
- Translations list (3 records) → singleton `List<TranslationDto>`

These are injected as `IReadOnlyList<T>` singletons via DI. Zero DB queries for these endpoints.

**Layer 2: OutputCache (server-side, in-memory)**
For verse endpoints that vary by query params, use .NET OutputCache with policies:
```
"Immutable"  → chapters, juz, translations lists (no vary keys, cache forever)
"ByVerse"    → /chapters/{num}/verses (VaryByQueryKeys: translationId, page, pageSize)
"SingleVerse"→ /chapters/{num}/verses/{verseNum} (VaryByRouteValues: num, verseNum)
```
Default expiration: 24 hours (server restarts clear cache anyway; data is immutable within a deployment).

**Layer 3: HTTP response headers (client + CDN caching)**
All endpoints return:
```
Cache-Control: public, max-age=2592000, immutable
ETag: "v1-{sha256-of-quran.db}"
```
- `immutable` — tells clients to never revalidate within max-age (30 days)
- ETag — allows `If-None-Match` → 304 Not Modified after max-age expires (zero body transfer)
- ETag is computed once at startup from SHA256 of `quran.db` — new deployment = new container = new hash

**Layer 4: Azure API Management (APIM)**
The API will sit behind Azure APIM, which provides:
- **Response caching** at the gateway level (APIM built-in cache policy) — offloads the container entirely
- **Rate limiting / throttling** — no need to implement in the API
- **CORS** — handled by APIM policy, not the API itself
- **API key / subscription management** — if needed later
- **Request/response transformation** — if needed later

The aggressive `Cache-Control` headers from the API work with APIM's caching. APIM can also add its own caching layer via `<cache-lookup>` / `<cache-store>` policies.

**No distributed cache needed** — single container, small dataset, in-memory is sufficient.

**Response compression**: Brotli + Gzip. Arabic text with diacritics compresses ~60-70%.

---

## Data Seeding (EF Core Migrations + JSON)

### Strategy
Data from the existing `Database\` SQL scripts is converted **once** into JSON files, stored as embedded resources in the API project, and seeded via EF Core migrations. No separate DbBuilder project needed.

### One-time data conversion (SQL → JSON)
During initial implementation, we parse the existing SQL data files and produce JSON seed files. This is a one-time step — after conversion, the SQL files and `Database\` project can be deleted.

The conversion handles:
- `INSERT INTO` statements → JSON arrays (chapters, juz, ruku, ayaths, languages, chapter translations, translations info)
- `exec InsertAyathTranslationSegment` calls → JSON translation segment records
- `exec UpdateTafseerSegment` calls → merged into the same segment records (Tafseer joined with Tarjuma by matching TranslationInfoID + SuraID + AyathNumber + SegmentIndex)
- Old schema values mapped to new schema (e.g., `IsMadaniRevelation: 0` → `"revelationType": "Meccan"`, `LanguageID: 2` → `"languageCode": "ur"`)

### Seed data files (in `Data/SeedData/`)
| File | Source | ~Records |
|------|--------|----------|
| `languages.json` | Data.Languages.sql | 4 |
| `scripts.json` | Derived from Languages + TranslationsInfo | 3 |
| `chapters.json` | Data.Chapters.sql | 114 |
| `chapter-translations.json` | Data.ChapterTranslations.English.sql | 114 |
| `juz.json` | Data.Juz.sql | 30 |
| `manzils.json` | Hardcoded (well-known data) | 7 |
| `rukus.json` | Data.Ruku.sql | ~556 |
| `verses.json` | Data.Ayaths.sql | ~6,236 |
| `translations.json` | Data.TranslationsInfo.NoorEImaan.sql | 3 |
| `translation-segments.json` | All 6 Tarjuma + Tafseer files (merged) | ~18,700 per translation |

### HTML in Tafseer data
The `Explanation` (Tafseer) field contains embedded HTML tags that carry semantic meaning:
- `<span lang="ar">...</span>` — marks inline text in a different language than the surrounding sentence (e.g., Arabic quotes within Urdu commentary)
- `<ins>...</ins>` — marks references to other books/sources

These tags must be **preserved as-is** in the JSON seed data and stored in the `Explanation` column. The API serves them raw — it's the client's responsibility to render the HTML. The `TranslationText` (Tarjuma) field is plain text with no HTML.

### Seeding approach
- `DataSeeder.cs` reads JSON files, deserializes into entity arrays
- Called from EF Core migration or `OnModelCreating` via `HasData()`
- For large tables (verses, translation segments): use `context.BulkInsert()` or `context.AddRange()` + `SaveChanges()` in batches
- Seeding order respects FK constraints: Languages → Scripts → Chapters → ChapterTranslations → Juz → Manzils → Rukus → Verses → Translations → TranslationSegments

### Database generation
```bash
# Create migration (one-time)
dotnet ef migrations add InitialCreate --project src/Ishqnama.Api

# Generate quran.db
dotnet ef database update --project src/Ishqnama.Api
# Or: dotnet run --project src/Ishqnama.Api -- --seed
```
The generated `quran.db` is placed in `data/` and baked into the Docker image.

---

## Unicode Handling (Arabic, Urdu, Hindi)

### JSON serialization
Configure `System.Text.Json` to output Unicode directly instead of `\uXXXX` escaping:
```csharp
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
});
```
Without this, Arabic text becomes unreadable escaped sequences and response size bloats ~4x.

### Unicode normalization
Normalize all text to **NFC** (composed form) during seed data conversion. Arabic Quranic text with diacritics (tashkeel) can be NFC or NFD — different byte sequences that render identically. NFC ensures consistent storage and comparison.
```csharp
text.Normalize(NormalizationForm.FormC)
```

### SQLite collation
SQLite uses BINARY collation by default (byte comparison, not Unicode-aware). This is acceptable because:
- Data is queried by chapter/verse number, not by text search
- All sorting is by numeric keys, not alphabetical
- If full-text search is needed later, add SQLite FTS5 with `unicode61` tokenizer

### Encoding
- JSON seed files: UTF-8, no BOM
- SQLite TEXT columns: stored as UTF-8 natively
- API responses: `Content-Type: application/json; charset=utf-8` (default in ASP.NET Core)

### RTL support
`IsRTL` flag on Language and Script tables signals clients how to render. API serves the flag — bidirectional rendering is the client's responsibility.

---

## Docker & Deployment

### Dockerfile (multi-stage)
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore
RUN dotnet publish src/Ishqnama.Api -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
COPY data/quran.db /app/data/quran.db
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8000/healthz || exit 1
USER $APP_UID
ENTRYPOINT ["dotnet", "Ishqnama.Api.dll"]
```

### SQLite Configuration for Container
```csharp
// Connection: read-only, no journaling
"Data Source=/app/data/quran.db;Mode=ReadOnly"

// PRAGMAs at startup:
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
PRAGMA cache_size = -20000;     // 20MB — entire DB in memory
PRAGMA mmap_size = 268435456;   // 256MB mmap
PRAGMA temp_store = MEMORY;
```

### Azure Container App
- Single container, no sidecar needed
- Min replicas: 1, Max: 3
- Ingress: internal (APIM is the public-facing gateway)
- Port: 8000
- No volume mounts — DB is in the image
- APIM handles: CORS, rate limiting, caching policies, API keys

---

## NuGet Packages

### Ishqnama.Api
- `Microsoft.EntityFrameworkCore.Sqlite` (10.x)
- `Microsoft.EntityFrameworkCore.Design` (10.x) — for migrations
- `Microsoft.AspNetCore.OutputCaching` (built-in)

---

## Implementation Steps

### Step 1: Solution scaffold
- Create `Ishqnama.sln`, `global.json`, `Ishqnama.Api.csproj`
- Add NuGet references
- Create folder structure

### Step 2: Entity models + EF Core configurations
- Create all 10 entity classes in `Models/`
- Create all `IEntityTypeConfiguration<T>` in `Data/Configurations/`
- Create `QuranDbContext` with `OnConfiguring` for SQLite
- Set `QueryTrackingBehavior.NoTracking` globally

### Step 3: Convert SQL data to JSON seed files
- Parse existing SQL data files from `Database\NoorEImaan.Database\Data\`
- Convert INSERT and EXEC statements into JSON arrays
- Merge Tarjuma + Tafseer into unified translation segment records
- Map old schema values to new schema (IDs → natural keys, bit flags → strings)
- Save as JSON files in `src/Ishqnama.Api/Data/SeedData/`

### Step 4: Data seeder + EF Core migration
- Create `DataSeeder.cs` to read JSON files and seed via EF Core
- Create initial migration: `dotnet ef migrations add InitialCreate`
- Run migration to generate `data/quran.db`
- Verify data integrity (counts match: 114 chapters, 30 juz, ~6,236 verses)

### Step 5: DTOs + Mappings
- Create response DTOs as `sealed record` types
- Create `DtoMappings.cs` with extension methods

### Step 6: API Endpoints
- Create each endpoint group using `MapGroup` and `TypedResults`
- Wire up pagination, filtering by translationId, language
- Add OutputCache policies
- Add response compression (Brotli, Gzip)
- Add ETag middleware
- Add health check endpoint
- Add global exception handler

### Step 7: Program.cs wiring
- Register DbContext, OutputCache, Compression, Exception handler
- CORS handled by Azure APIM — not configured in the API
- Map all endpoint groups
- Configure SQLite PRAGMAs on startup
- Compute ETag hash on startup

### Step 8: Dockerfile + .dockerignore
- Multi-stage build
- Copy `quran.db` into image
- Health check, non-root user

---

## Verification

1. **Build**: `dotnet build` succeeds
2. **Migration**: `dotnet ef database update` produces `data/quran.db` with correct schema and data
3. **Data integrity**: Verify row counts in SQLite match source data (114 chapters, 30 juz, ~6,236 verses, ~56,100 translation segments)
4. **API smoke test**: `dotnet run --project src/Ishqnama.Api` and test:
   - `GET /api/chapters` → 114 items
   - `GET /api/chapters/1/verses` → 7 verses + Bismillah
   - `GET /api/juz` → 30 items
   - `GET /api/translations` → 3 items
   - `GET /api/chapters/2/verses?translationId=2&page=1&pageSize=10` → paginated with translations
   - `GET /healthz` → 200 OK
5. **Docker**: `docker build` and `docker run` → API responds on port 8000
