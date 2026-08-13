namespace Ishqnama.Api.Dtos;

public sealed record ChapterDetailDto(
    int ChapterNumber,
    string ArabicName,
    string TransliteratedName,
    string RevelationType,
    int VerseCount,
    int? RevelationOrder,
    IReadOnlyList<ChapterTranslationDto> Translations);

public sealed record ChapterTranslationDto(
    string LanguageCode,
    string TranslatedName);
