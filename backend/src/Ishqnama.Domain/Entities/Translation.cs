namespace Ishqnama.Domain.Entities;

public sealed class Translation
{
    public int TranslationId { get; set; }
    public string LanguageCode { get; set; }
    public string ScriptCode { get; set; }
    public string BookName { get; set; }
    public string Translator { get; set; }
    public string? Description { get; set; }
    public string? BookNameInScript { get; set; }
    public string? TranslatorInScript { get; set; }
    public string? DescriptionInScript { get; set; }

    public Language Language { get; set; } = null!;
    public Script Script { get; set; } = null!;
    public ICollection<TranslationSegment> TranslationSegments { get; set; } = [];
}
