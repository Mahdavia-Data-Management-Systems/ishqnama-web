using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Text.Unicode;

// Paths
var rootDir = Path.GetFullPath(args.Length > 0 ? args[0] : @"..\..\..\..\..\..");
var sqlDir = Path.Combine(rootDir, @"Database\NoorEImaan.Database\Data");
var outDir = Path.Combine(rootDir, @"IshqnamaProject\src\Ishqnama.Api\Data\SeedData");
Directory.CreateDirectory(outDir);

var jsonOptions = new JsonSerializerOptions
{
    WriteIndented = false,
    Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
};

Console.OutputEncoding = Encoding.UTF8;
Console.WriteLine($"SQL dir: {sqlDir}");
Console.WriteLine($"Output dir: {outDir}");

// 1. Languages
Console.WriteLine("Processing languages...");
var languages = new List<object>();
var langLines = File.ReadAllLines(Path.Combine(sqlDir, "Data.Languages.sql"), Encoding.UTF8);
foreach (var line in langLines)
{
    var m = Regex.Match(line, @"VALUES\('(\w+)','(\w+)',(\d)\)");
    if (!m.Success) continue;
    var code = m.Groups[1].Value.ToLowerInvariant();
    var name = m.Groups[2].Value;
    var isRtl = m.Groups[3].Value == "1";
    string? nativeName = code switch
    {
        "ur" => "اردو",
        "ar" => "العربية",
        "hi" => "हिन्दी",
        _ => null
    };
    languages.Add(new { languageCode = code, name, nativeName, isRTL = isRtl });
}
WriteJson(outDir, "languages.json", languages, jsonOptions);
Console.WriteLine($"  -> {languages.Count} languages");

// 2. Scripts
Console.WriteLine("Processing scripts...");
var scripts = new List<object>
{
    new { scriptCode = "Latn", name = "Latin", nativeName = (string?)null, isRTL = false },
    new { scriptCode = "Arab", name = "Arabic", nativeName = "العربية", isRTL = true },
    new { scriptCode = "Deva", name = "Devanagari", nativeName = "देवनागरी", isRTL = false }
};
WriteJson(outDir, "scripts.json", scripts, jsonOptions);
Console.WriteLine($"  -> {scripts.Count} scripts");

// Pre-read Ayaths for verse counts
var ayathLines = File.ReadAllLines(Path.Combine(sqlDir, "Data.Ayaths.sql"), Encoding.UTF8);
var verseCounts = new Dictionary<int, int>();
foreach (var line in ayathLines)
{
    var m = Regex.Match(line, @"VALUES\((\d+),(\d+),(\d+),(\d+),");
    if (!m.Success) continue;
    int suraId = int.Parse(m.Groups[3].Value);
    int ayathNum = int.Parse(m.Groups[4].Value);
    if (ayathNum > 0)
    {
        verseCounts.TryGetValue(suraId, out int count);
        verseCounts[suraId] = count + 1;
    }
}

var verseJuzMap = new Dictionary<(int, int), int>();
foreach (var line in ayathLines)
{
    var m = Regex.Match(line, @"VALUES\((\d+),(\d+),(\d+),(\d+),");
    if (!m.Success) continue;
    int juz = int.Parse(m.Groups[1].Value);
    int suraId = int.Parse(m.Groups[3].Value);
    int ayathNum = int.Parse(m.Groups[4].Value);
    verseJuzMap[(suraId, ayathNum)] = juz;
}

// 3. Chapters
Console.WriteLine("Processing chapters...");
var chapters = new List<object>();
var chapLines = File.ReadAllLines(Path.Combine(sqlDir, "Data.Chapters.sql"), Encoding.UTF8);
int chapNum = 0;
foreach (var line in chapLines)
{
    var m = Regex.Match(line, @"VALUES\s*\(N'((?:[^']|'')*)',\s*N'((?:[^']|'')*)',\s*(\d)\)");
    if (!m.Success) continue;
    chapNum++;
    var arabicName = UnescapeSql(m.Groups[1].Value);
    var transliteratedName = UnescapeSql(m.Groups[2].Value).Trim();
    var isMadani = m.Groups[3].Value == "1";
    verseCounts.TryGetValue(chapNum, out int vc);
    chapters.Add(new
    {
        chapterNumber = chapNum,
        arabicName = Normalize(arabicName),
        transliteratedName = Normalize(transliteratedName),
        revelationType = isMadani ? "Medinan" : "Meccan",
        verseCount = vc
    });
}
WriteJson(outDir, "chapters.json", chapters, jsonOptions);
Console.WriteLine($"  -> {chapters.Count} chapters");

// 4. Chapter Translations
Console.WriteLine("Processing chapter translations...");
var chapTranslations = new List<object>();
var ctLines = File.ReadAllLines(Path.Combine(sqlDir, "Data.ChapterTranslations.English.sql"), Encoding.UTF8);
foreach (var line in ctLines)
{
    var m = Regex.Match(line, @"VALUES\((\d+),(\d+),'((?:[^']|'')*)'\)");
    if (!m.Success) continue;
    int chNum = int.Parse(m.Groups[1].Value);
    int langId = int.Parse(m.Groups[2].Value);
    chapTranslations.Add(new
    {
        chapterNumber = chNum,
        languageCode = MapLanguageId(langId),
        translatedName = UnescapeSql(m.Groups[3].Value)
    });
}
WriteJson(outDir, "chapter-translations.json", chapTranslations, jsonOptions);
Console.WriteLine($"  -> {chapTranslations.Count} chapter translations");

// 5. Juz
Console.WriteLine("Processing juz...");
var juzList = new List<object>();
var juzLines = File.ReadAllLines(Path.Combine(sqlDir, "Data.Juz.sql"), Encoding.UTF8);
int juzNum = 0;
foreach (var line in juzLines)
{
    var m = Regex.Match(line, @"VALUES\s*\(N'((?:[^']|'')*)',\s*N'((?:[^']|'')*)'\)");
    if (!m.Success) continue;
    juzNum++;
    juzList.Add(new
    {
        juzNumber = juzNum,
        arabicName = Normalize(UnescapeSql(m.Groups[1].Value)),
        transliteratedName = Normalize(UnescapeSql(m.Groups[2].Value))
    });
}
WriteJson(outDir, "juz.json", juzList, jsonOptions);
Console.WriteLine($"  -> {juzList.Count} juz");

// 6. Manzils
Console.WriteLine("Processing manzils...");
var manzils = new List<object>
{
    new { manzilNumber = 1, arabicName = "المنزل الأول", transliteratedName = "al-Manzil al-Awwal" },
    new { manzilNumber = 2, arabicName = "المنزل الثاني", transliteratedName = "al-Manzil ath-Thānī" },
    new { manzilNumber = 3, arabicName = "المنزل الثالث", transliteratedName = "al-Manzil ath-Thālith" },
    new { manzilNumber = 4, arabicName = "المنزل الرابع", transliteratedName = "al-Manzil ar-Rābiʿ" },
    new { manzilNumber = 5, arabicName = "المنزل الخامس", transliteratedName = "al-Manzil al-Khāmis" },
    new { manzilNumber = 6, arabicName = "المنزل السادس", transliteratedName = "al-Manzil as-Sādis" },
    new { manzilNumber = 7, arabicName = "المنزل السابع", transliteratedName = "al-Manzil as-Sābiʿ" }
};
WriteJson(outDir, "manzils.json", manzils, jsonOptions);
Console.WriteLine($"  -> {manzils.Count} manzils");

// 7. Rukus
Console.WriteLine("Processing rukus...");
var rukus = new List<object>();
var rukuLines = File.ReadAllLines(Path.Combine(sqlDir, "Data.Ruku.sql"), Encoding.UTF8);
int rukuId = 0;
foreach (var line in rukuLines)
{
    var m = Regex.Match(line, @"VALUES\((\d+),(\d+),(\d+),(\d+),(\d+)\)");
    if (!m.Success) continue;
    rukuId++;
    rukus.Add(new
    {
        rukuId,
        chapterNumber = int.Parse(m.Groups[1].Value),
        juzNumber = int.Parse(m.Groups[2].Value),
        rankInChapter = int.Parse(m.Groups[3].Value),
        rankInJuz = int.Parse(m.Groups[4].Value),
        verseCount = int.Parse(m.Groups[5].Value)
    });
}
WriteJson(outDir, "rukus.json", rukus, jsonOptions);
Console.WriteLine($"  -> {rukus.Count} rukus");

// 8. Verses
Console.WriteLine("Processing verses...");
var verses = new List<object>();
foreach (var line in ayathLines)
{
    var m = Regex.Match(line, @"VALUES\((\d+),(\d+),(\d+),(\d+),N'((?:[^']|'')*)',(\d+),(\d)\)");
    if (!m.Success) continue;
    verses.Add(new
    {
        chapterNumber = int.Parse(m.Groups[3].Value),
        verseNumber = int.Parse(m.Groups[4].Value),
        arabicText = Normalize(UnescapeSql(m.Groups[5].Value)),
        juzNumber = int.Parse(m.Groups[1].Value),
        rukuId = int.Parse(m.Groups[2].Value),
        manzilNumber = int.Parse(m.Groups[6].Value),
        hasSajdah = m.Groups[7].Value == "1"
    });
}
WriteJson(outDir, "verses.json", verses, jsonOptions);
Console.WriteLine($"  -> {verses.Count} verses");

// 9. Translations
Console.WriteLine("Processing translations...");
var scriptMap = new Dictionary<int, string> { { 1, "Latn" }, { 2, "Arab" }, { 3, "Deva" } };
var translationsList = new List<Dictionary<string, object?>>();
var tiLines = File.ReadAllLines(Path.Combine(sqlDir, "Data.TranslationsInfo.NoorEImaan.sql"), Encoding.UTF8);
var tiContent = string.Join("\n", tiLines);

var tiMatches = Regex.Matches(tiContent,
    @"VALUES\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*(?:N'((?:[^']|'')*)'|'((?:[^']|'')*)')\s*,\s*(?:N'((?:[^']|'')*)'|'((?:[^']|'')*)')\s*,\s*(?:N'((?:[^']|'')*)'|'((?:[^']|'')*)')\s*\)",
    RegexOptions.Singleline);

int transId = 0;
foreach (Match tm in tiMatches)
{
    transId++;
    int langId = int.Parse(tm.Groups[1].Value);
    int scriptId = int.Parse(tm.Groups[2].Value);
    translationsList.Add(new Dictionary<string, object?>
    {
        ["translationId"] = transId,
        ["languageCode"] = MapLanguageId(langId),
        ["scriptCode"] = scriptMap[scriptId],
        ["bookName"] = UnescapeSql(tm.Groups[3].Value),
        ["translator"] = UnescapeSql(tm.Groups[4].Value),
        ["description"] = UnescapeSql(tm.Groups[5].Value),
        ["bookNameInScript"] = NormalizeOrNull(GetGroup(tm, 6, 7)),
        ["translatorInScript"] = NormalizeOrNull(GetGroup(tm, 8, 9)),
        ["descriptionInScript"] = NormalizeOrNull(GetGroup(tm, 10, 11))
    });
}
WriteJson(outDir, "translations.json", translationsList, jsonOptions);
Console.WriteLine($"  -> {translationsList.Count} translations");

// 10. Translation Segments (merge Tarjuma + Tafseer)
Console.WriteLine("Processing translation segments...");
var segmentMap = new Dictionary<(int, int, int, int), (string? translation, string? explanation)>();

var tarjumaFiles = new[]
{
    ("Data.TranslationSegment.NoorEImaan.Tarjuma.English.sql", 1),
    ("Data.TranslationSegment.NoorEImaan.Tarjuma.Urdu.sql", 2),
    ("Data.TranslationSegment.NoorEImaan.Tarjuma.Hindi.sql", 3)
};

var translationIdToLang = new Dictionary<int, string>();

foreach (var (fileName, langId) in tarjumaFiles)
{
    Console.WriteLine($"  Reading {fileName}...");
    var content = File.ReadAllText(Path.Combine(sqlDir, fileName), Encoding.UTF8);
    int count = 0;
    var matches = Regex.Matches(content,
        @"exec\s+InsertAyathTranslationSegment\s+@TranslationInfoID\s*=\s*(\d+),\s*@SuraID\s*=\s*(\d+),\s*@AyathNumber\s*=\s*(\d+),\s*@SegmentIndex\s*=\s*(\d+),\s*@Translation\s*=\s*N'((?:[^']|'')*)',\s*@Explanation\s*=\s*N'((?:[^']|'')*)'",
        RegexOptions.Singleline);
    foreach (Match m in matches)
    {
        int tId = int.Parse(m.Groups[1].Value);
        int suraId = int.Parse(m.Groups[2].Value);
        int ayathNum = int.Parse(m.Groups[3].Value);
        int segIdx = int.Parse(m.Groups[4].Value);
        string translationText = UnescapeSql(m.Groups[5].Value);
        string explanation = UnescapeSql(m.Groups[6].Value);

        translationIdToLang.TryAdd(tId, MapLanguageId(langId));

        var key = (tId, suraId, ayathNum, segIdx);
        segmentMap[key] = (
            string.IsNullOrEmpty(translationText) ? null : Normalize(translationText),
            string.IsNullOrEmpty(explanation) ? null : Normalize(explanation)
        );
        count++;
    }
    Console.WriteLine($"    -> {count} tarjuma records");
}

var tafseerFiles = new[]
{
    ("Data.TranslationSegment.NoorEImaan.Tafseer.English.sql", 1),
    ("Data.TranslationSegment.NoorEImaan.Tafseer.Urdu.sql", 2),
    ("Data.TranslationSegment.NoorEImaan.Tafseer.Hindi.sql", 3)
};

foreach (var (fileName, langId) in tafseerFiles)
{
    Console.WriteLine($"  Reading {fileName}...");
    var content = File.ReadAllText(Path.Combine(sqlDir, fileName), Encoding.UTF8);
    int count = 0;
    var matches = Regex.Matches(content,
        @"exec\s+UpdateTafseerSegment\s+@TranslationInfoID\s*=\s*(\d+),\s*@SuraID\s*=\s*(\d+),\s*@AyathNumber\s*=\s*(\d+),\s*@SegmentIndex\s*=\s*(\d+),\s*@Explanation\s*=\s*N'((?:[^']|'')*)'",
        RegexOptions.Singleline);
    foreach (Match m in matches)
    {
        int tId = int.Parse(m.Groups[1].Value);
        int suraId = int.Parse(m.Groups[2].Value);
        int ayathNum = int.Parse(m.Groups[3].Value);
        int segIdx = int.Parse(m.Groups[4].Value);
        string explanation = UnescapeSql(m.Groups[5].Value);

        translationIdToLang.TryAdd(tId, MapLanguageId(langId));

        var key = (tId, suraId, ayathNum, segIdx);
        if (segmentMap.TryGetValue(key, out var existing))
        {
            segmentMap[key] = (existing.translation,
                string.IsNullOrEmpty(explanation) ? existing.explanation : Normalize(explanation));
        }
        else
        {
            segmentMap[key] = (null, string.IsNullOrEmpty(explanation) ? null : Normalize(explanation));
        }
        count++;
    }
    Console.WriteLine($"    -> {count} tafseer records");
}

// Group segments by (juz, language) and write per-juz-per-language files
var segmentsByJuzAndLang = segmentMap
    .OrderBy(kvp => kvp.Key.Item1)
    .ThenBy(kvp => kvp.Key.Item2)
    .ThenBy(kvp => kvp.Key.Item3)
    .ThenBy(kvp => kvp.Key.Item4)
    .GroupBy(kvp => (
        juz: verseJuzMap.GetValueOrDefault((kvp.Key.Item2, kvp.Key.Item3), 0),
        lang: translationIdToLang.GetValueOrDefault(kvp.Key.Item1, "en")
    ))
    .OrderBy(g => g.Key.juz)
    .ThenBy(g => g.Key.lang);

int totalSegments = 0;
int fileCount = 0;
foreach (var group in segmentsByJuzAndLang)
{
    var juzSegments = group.Select(kvp => new Dictionary<string, object?>
    {
        ["translationId"] = kvp.Key.Item1,
        ["chapterNumber"] = kvp.Key.Item2,
        ["verseNumber"] = kvp.Key.Item3,
        ["segmentIndex"] = kvp.Key.Item4,
        ["translationText"] = kvp.Value.translation,
        ["explanation"] = kvp.Value.explanation
    }).ToList();

    var fileName = $"translation-segments-juz-{group.Key.juz:D2}-{group.Key.lang}.json";
    WriteJson(outDir, fileName, juzSegments, jsonOptions);
    Console.WriteLine($"  -> {fileName}: {juzSegments.Count} segments");
    totalSegments += juzSegments.Count;
    fileCount++;
}
Console.WriteLine($"  -> {totalSegments} total translation segments across {fileCount} files");

Console.WriteLine("\nDone! All JSON seed files generated.");

// --- Helpers ---

static string UnescapeSql(string s) => s.Replace("''", "'");

static string Normalize(string s) => s.Normalize(NormalizationForm.FormC);

static string? NormalizeOrNull(string s) =>
    string.IsNullOrEmpty(s) ? null : s.Normalize(NormalizationForm.FormC);

static string MapLanguageId(int id) => id switch
{
    1 => "en",
    2 => "ur",
    3 => "hi",
    4 => "ar",
    _ => throw new ArgumentException($"Unknown language ID: {id}")
};

static string GetGroup(Match m, int g1, int g2) =>
    m.Groups[g1].Success ? m.Groups[g1].Value :
    m.Groups[g2].Success ? m.Groups[g2].Value : "";

static void WriteJson(string dir, string fileName, object data, JsonSerializerOptions options)
{
    var path = Path.Combine(dir, fileName);
    var json = JsonSerializer.Serialize(data, options);
    File.WriteAllText(path, json, new UTF8Encoding(false));
}
