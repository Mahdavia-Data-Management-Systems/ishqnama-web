namespace Ishqnama.Application.Dtos;

public sealed record UserSettingsDto(
    string Mode,
    string Lang,
    int FontScale,
    bool ShowTafseer,
    // Defaults apply when a client omits them, so an older frontend's save keeps the juz rail on.
    bool ShowSuraRukuMarks = false,
    bool ShowJuzRukuMarks = true,
    // The recitation settings came later still: the one reciter, running on past the verse.
    string Reciter = "abdul-basit-murattal",
    bool ContinueRecitation = true);
