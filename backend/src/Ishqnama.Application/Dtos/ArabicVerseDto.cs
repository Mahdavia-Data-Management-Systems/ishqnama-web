namespace Ishqnama.Application.Dtos;

/// <summary>Just enough of a verse to print it in continuous Arabic: no translations, no tafseer.</summary>
public sealed record ArabicVerseDto(int VerseNumber, string ArabicText, bool HasSajdah);
