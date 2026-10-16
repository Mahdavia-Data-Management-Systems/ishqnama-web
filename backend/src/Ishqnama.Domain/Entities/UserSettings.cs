namespace Ishqnama.Domain.Entities;

public sealed class UserSettings
{
    public string Id { get; set; } = "settings";
    public string UserId { get; set; } = null!;
    public string Type { get; set; } = "settings";
    public string Mode { get; set; } = "continuous";
    public string Lang { get; set; } = "urdu";
    public int FontScale { get; set; } = 1;
    public bool ShowTafseer { get; set; } = true;
    public bool ShowSuraRukuMarks { get; set; }
    public bool ShowJuzRukuMarks { get; set; } = true;
    public string Reciter { get; set; } = "mishari-rashid-al-afasy-murattal";
    public bool ContinueRecitation { get; set; } = true;
    public double RecitationSpeed { get; set; } = 1;
}
