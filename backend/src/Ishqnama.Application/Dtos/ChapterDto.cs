namespace Ishqnama.Application.Dtos;

public sealed record ChapterDto(
    int ChapterNumber,
    string ArabicName,
    string TransliteratedName,
    string RevelationType,
    int VerseCount,
    string? TranslatedName = null);
