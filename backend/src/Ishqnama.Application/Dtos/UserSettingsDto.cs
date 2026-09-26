namespace Ishqnama.Application.Dtos;

public sealed record UserSettingsDto(
    string Mode,
    string Lang,
    int FontScale,
    bool ShowTafseer,
    // Defaults apply when a client omits them, so an older frontend's save keeps the juz rail on.
    bool ShowSuraRukuMarks = false,
    bool ShowJuzRukuMarks = true);
