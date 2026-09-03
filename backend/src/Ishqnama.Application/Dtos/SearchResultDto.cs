namespace Ishqnama.Application.Dtos;

public sealed record SearchResultDto(
    int ChapterNumber,
    string ChapterName,
    int VerseNumber,
    string ArabicText,
    string? TranslationText,
    string? Explanation);
