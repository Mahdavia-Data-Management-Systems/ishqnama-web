namespace Ishqnama.Domain.Entities;

public sealed class TranslationSegment
{
    public int TranslationSegmentId { get; set; }
    public int TranslationId { get; set; }
    public int ChapterNumber { get; set; }
    public int VerseNumber { get; set; }
    public int SegmentIndex { get; set; }
    public string? TranslationText { get; set; }
    public string? Explanation { get; set; }

    public Translation Translation { get; set; } = null!;
    public Verse Verse { get; set; } = null!;
}
