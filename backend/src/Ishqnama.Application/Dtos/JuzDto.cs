namespace Ishqnama.Application.Dtos;

public sealed record JuzDto(
    int JuzNumber,
    string ArabicName,
    string TransliteratedName,
    int? StartChapter = null,
    int? StartVerse = null,
    int? EndChapter = null,
    int? EndVerse = null);
