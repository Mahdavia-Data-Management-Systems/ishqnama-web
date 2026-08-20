namespace Ishqnama.Domain.Entities;

public sealed class Verse
{
    public int ChapterNumber { get; set; }
    public int VerseNumber { get; set; }
    public string ArabicText { get; set; }
    public int JuzNumber { get; set; }
    public int RukuId { get; set; }
    public int ManzilNumber { get; set; }
    public bool HasSajdah { get; set; }

    public Chapter Chapter { get; set; } = null!;
    public Juz Juz { get; set; } = null!;
    public Ruku Ruku { get; set; } = null!;
    public Manzil Manzil { get; set; } = null!;
    public ICollection<TranslationSegment> TranslationSegments { get; set; } = [];
}
