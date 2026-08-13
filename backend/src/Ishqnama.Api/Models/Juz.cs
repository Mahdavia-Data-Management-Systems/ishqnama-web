namespace Ishqnama.Api.Models;

public sealed class Juz
{
    public int JuzNumber { get; set; }
    public string ArabicName { get; set; }
    public string TransliteratedName { get; set; }

    public ICollection<Verse> Verses { get; set; } = [];
    public ICollection<Ruku> Rukus { get; set; } = [];
}
