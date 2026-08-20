namespace Ishqnama.Domain.Entities;

public sealed class Manzil
{
    public int ManzilNumber { get; set; }
    public string ArabicName { get; set; }
    public string TransliteratedName { get; set; }

    public ICollection<Verse> Verses { get; set; } = [];
}
