namespace Ishqnama.Domain.Entities;

public sealed class Script
{
    public string ScriptCode { get; set; }
    public string Name { get; set; }
    public string? NativeName { get; set; }
    public bool IsRTL { get; set; }

    public ICollection<Translation> Translations { get; set; } = [];
}
