namespace Ishqnama.Application.Dtos;

public sealed record UserSettingsDto(
    string Mode,
    string Lang,
    int FontScale,
    bool ShowTafseer);
