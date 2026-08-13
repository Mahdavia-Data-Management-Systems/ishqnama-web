namespace Ishqnama.Api.Models;

public sealed class ChapterTranslation
{
    public int ChapterNumber { get; set; }
    public string LanguageCode { get; set; }
    public string TranslatedName { get; set; }

    public Chapter Chapter { get; set; } = null!;
    public Language Language { get; set; } = null!;
}
