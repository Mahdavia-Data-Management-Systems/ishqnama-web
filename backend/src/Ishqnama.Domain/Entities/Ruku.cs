namespace Ishqnama.Domain.Entities;

public sealed class Ruku
{
    public int RukuId { get; set; }
    public int ChapterNumber { get; set; }
    public int JuzNumber { get; set; }
    public int RankInChapter { get; set; }
    public int RankInJuz { get; set; }
    public int VerseCount { get; set; }

    public Chapter Chapter { get; set; } = null!;
    public Juz Juz { get; set; } = null!;
    public ICollection<Verse> Verses { get; set; } = [];
}
