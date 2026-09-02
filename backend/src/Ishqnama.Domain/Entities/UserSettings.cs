namespace Ishqnama.Domain.Entities;

public sealed class UserSettings
{
    public string Id { get; set; } = "settings";
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "settings";
    public string Mode { get; set; } = "verse";
    public string Lang { get; set; } = "urdu";
    public int FontScale { get; set; } = 1;
    public bool ShowTafseer { get; set; }
}
