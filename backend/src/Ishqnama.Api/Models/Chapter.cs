namespace Ishqnama.Api.Models;

public sealed class Chapter
{
    public int ChapterNumber { get; set; }
    public string ArabicName { get; set; }
    public string TransliteratedName { get; set; }
    public string RevelationType { get; set; }
    public int VerseCount { get; set; }
    public int? RevelationOrder { get; set; }

    public ICollection<Verse> Verses { get; set; } = [];
    public ICollection<Ruku> Rukus { get; set; } = [];
    public ICollection<ChapterTranslation> ChapterTranslations { get; set; } = [];
}
