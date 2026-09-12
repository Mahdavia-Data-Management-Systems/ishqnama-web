using System.Text.Json.Serialization;
using Ishqnama.Api.Contracts;
using Ishqnama.Application.Dtos;

namespace Ishqnama.Api.Json;

/// <summary>
/// Source-generated serializer metadata for every type that crosses the wire, so the trimmed
/// self-contained publish never depends on reflection for JSON.
/// </summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
// Quran
[JsonSerializable(typeof(ChapterDto))]
[JsonSerializable(typeof(List<ChapterDto>))]
[JsonSerializable(typeof(ChapterDetailDto))]
[JsonSerializable(typeof(ChapterTranslationDto))]
[JsonSerializable(typeof(JuzDto))]
[JsonSerializable(typeof(List<JuzDto>))]
[JsonSerializable(typeof(RukuDto))]
[JsonSerializable(typeof(List<RukuDto>))]
[JsonSerializable(typeof(TranslationDto))]
[JsonSerializable(typeof(List<TranslationDto>))]
[JsonSerializable(typeof(VerseDto))]
[JsonSerializable(typeof(List<VerseDto>))]
[JsonSerializable(typeof(TranslationSegmentDto))]
[JsonSerializable(typeof(PagedResponse<VerseDto>))]
[JsonSerializable(typeof(SearchResultDto))]
[JsonSerializable(typeof(PagedResponse<SearchResultDto>))]
// User data
[JsonSerializable(typeof(UserSettingsDto))]
[JsonSerializable(typeof(UserBookmarkDto))]
[JsonSerializable(typeof(List<UserBookmarkDto>))]
[JsonSerializable(typeof(IReadOnlyList<UserBookmarkDto>))]
[JsonSerializable(typeof(UserHistoryDto))]
[JsonSerializable(typeof(List<UserHistoryDto>))]
[JsonSerializable(typeof(IReadOnlyList<UserHistoryDto>))]
[JsonSerializable(typeof(CreateBookmarkRequest))]
[JsonSerializable(typeof(UpdatePositionRequest))]
[JsonSerializable(typeof(HistoryRequest))]
// Envelopes
[JsonSerializable(typeof(ErrorResponse))]
[JsonSerializable(typeof(HealthResponse))]
[JsonSerializable(typeof(string))]
internal sealed partial class IshqnamaJsonContext : JsonSerializerContext;
