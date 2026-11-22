namespace Ishqnama.Domain.Entities;

/// <summary>A source book cited by the tafseer (takhreej).</summary>
public sealed class Book
{
    public int BookId { get; set; }
    public string Title { get; set; }
    public string? Author { get; set; }
    public short? AuthorDeathYearHijri { get; set; }
    public string? Kind { get; set; }

    public ICollection<TranslationSegmentCitation> Citations { get; set; } = [];
}
