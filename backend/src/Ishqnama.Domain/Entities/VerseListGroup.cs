namespace Ishqnama.Domain.Entities;

/// <summary>A run of verses within one chapter, with an optional caption.</summary>
public sealed class VerseListGroup
{
    public string Id { get; set; } = null!;
    public int Chapter { get; set; }
    public int FromVerse { get; set; }
    public int ToVerse { get; set; }
    public string? Caption { get; set; }
}
