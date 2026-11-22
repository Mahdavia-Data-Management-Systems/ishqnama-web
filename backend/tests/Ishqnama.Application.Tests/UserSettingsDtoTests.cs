using System.Text.Json;
using Ishqnama.Application.Dtos;

namespace Ishqnama.Application.Tests;

public sealed class UserSettingsDtoTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public void A_body_from_an_older_client_leaves_takhreej_on()
    {
        var settings = JsonSerializer.Deserialize<UserSettingsDto>(
            """{"mode":"verse","lang":"urdu","fontScale":2,"showTafseer":false}""", Web);

        Assert.NotNull(settings);
        Assert.True(settings.ShowTakhreej);
        Assert.False(settings.ShowTafseer);
    }

    [Fact]
    public void A_body_that_turns_takhreej_off_is_kept()
    {
        var settings = JsonSerializer.Deserialize<UserSettingsDto>(
            """{"mode":"verse","lang":"urdu","fontScale":2,"showTafseer":true,"showTakhreej":false}""", Web);

        Assert.False(settings!.ShowTakhreej);
    }

    [Fact]
    public void Takhreej_is_written_as_showTakhreej()
    {
        var json = JsonSerializer.Serialize(new UserSettingsDto("verse", "urdu", 1, true), Web);

        using var document = JsonDocument.Parse(json);
        Assert.True(document.RootElement.GetProperty("showTakhreej").GetBoolean());
    }
}
