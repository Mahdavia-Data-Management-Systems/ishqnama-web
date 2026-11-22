namespace Ishqnama.Domain.Entities;

/// <summary>
/// One citation of a book for a passage of a segment's explanation. <see cref="BlockOrdinal"/> is the
/// <c>n</c> of the <c>&lt;ins data-takhreej="n"&gt;</c> anchor in that explanation (1-based per
/// segment); <see cref="SortOrder"/> orders the citations under one anchor.
/// </summary>
public sealed class TranslationSegmentCitation
{
    public int CitationId { get; set; }
    public int TranslationSegmentId { get; set; }
    public short BlockOrdinal { get; set; }
    public short SortOrder { get; set; }
    public int BookId { get; set; }
    public string? Reference { get; set; }
    public string? Note { get; set; }
    public string? Url { get; set; }

    public TranslationSegment TranslationSegment { get; set; } = null!;
    public Book Book { get; set; } = null!;
}
