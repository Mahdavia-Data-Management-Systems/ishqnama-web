namespace Ishqnama.Application.Dtos;

public sealed record TranslationDto(
    int TranslationId,
    string LanguageCode,
    string ScriptCode,
    string BookName,
    string Translator,
    string? Description,
    string? BookNameInScript,
    string? TranslatorInScript,
    string? DescriptionInScript);
