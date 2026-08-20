namespace Ishqnama.Domain.Entities;

public sealed class Language
{
    public string LanguageCode { get; set; }
    public string Name { get; set; }
    public string? NativeName { get; set; }
    public bool IsRTL { get; set; }

    public ICollection<ChapterTranslation> ChapterTranslations { get; set; } = [];
    public ICollection<Translation> Translations { get; set; } = [];
}
