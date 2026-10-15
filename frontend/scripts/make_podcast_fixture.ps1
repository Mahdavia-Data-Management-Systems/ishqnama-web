# Builds a synthetic two-voice conversation with known turn boundaries, for
# testing scripts/diarize_podcast.py. Windows only: it uses the voices that
# ship with Windows (System.Speech). Usage:
#
#   powershell -File scripts/make_podcast_fixture.ps1 -OutDir <dir>
#
# Writes <dir>/conversation.wav (16 kHz mono PCM) and
# <dir>/conversation.expected.json, whose "turns" carry the true speaker and
# the millisecond range of every turn, with the pauses between them.

param(
  [Parameter(Mandatory = $true)] [string] $OutDir,
  [string] $MaleVoice = "Microsoft David Desktop",
  [string] $FemaleVoice = "Microsoft Zira Desktop"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech

$rate = 16000
$turns = @(
  @{ speaker = "female"; text = "Welcome back. Today I want to ask you about patience, because the Quran keeps returning to it, and I never feel I understand what it is asking of me." },
  @{ speaker = "male";   text = "That is a good place to start, because patience in the Quran is not sitting still. It is holding your ground while something is being asked of you." },
  @{ speaker = "female"; text = "So it is active? I always pictured it as waiting quietly for the difficulty to pass." },
  @{ speaker = "male";   text = "Waiting is part of it, but the verses pair it with prayer, with gratitude, and with keeping your word. Each of those takes effort while you wait." },
  @{ speaker = "female"; text = "Give me an example from everyday life, something a student would recognise." },
  @{ speaker = "male";   text = "An exam result that goes badly. Patience is not pretending it does not hurt. It is refusing to let the hurt decide what you do next." },
  @{ speaker = "female"; text = "That is a different picture from the one I had. It makes the verses feel much closer to home." },
  @{ speaker = "male";   text = "And that is why the book comes back to it so often. It is a daily skill, not a rare virtue." }
)
# Pause after each turn, in milliseconds, varied so boundaries are not all alike.
$pauses = @(600, 450, 800, 500, 700, 400, 650, 0)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo($rate, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

$pcm = New-Object System.IO.MemoryStream
$expected = New-Object System.Collections.ArrayList
$positionMs = 0

for ($i = 0; $i -lt $turns.Count; $i++) {
  $turn = $turns[$i]
  $voice = if ($turn.speaker -eq "male") { $MaleVoice } else { $FemaleVoice }
  $synth.SelectVoice($voice)

  $chunk = New-Object System.IO.MemoryStream
  $synth.SetOutputToAudioStream($chunk, $format)
  $synth.Speak($turn.text)
  $synth.SetOutputToNull()

  $bytes = $chunk.ToArray()
  $durationMs = [int][math]::Round($bytes.Length * 1000.0 / ($rate * 2))
  $pcm.Write($bytes, 0, $bytes.Length)
  [void]$expected.Add(@{ speaker = $turn.speaker; fromMs = $positionMs; toMs = $positionMs + $durationMs })
  $positionMs += $durationMs

  $pauseBytes = New-Object byte[] ([int]($rate * 2 * $pauses[$i] / 1000))
  $pcm.Write($pauseBytes, 0, $pauseBytes.Length)
  $positionMs += $pauses[$i]
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$wavPath = Join-Path $OutDir "conversation.wav"
$data = $pcm.ToArray()
$writer = New-Object System.IO.BinaryWriter([System.IO.File]::Create($wavPath))
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
$writer.Write([int](36 + $data.Length))
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("WAVEfmt "))
$writer.Write([int]16)          # fmt chunk size
$writer.Write([int16]1)         # PCM
$writer.Write([int16]1)         # mono
$writer.Write([int]$rate)
$writer.Write([int]($rate * 2)) # byte rate
$writer.Write([int16]2)         # block align
$writer.Write([int16]16)        # bits per sample
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
$writer.Write([int]$data.Length)
$writer.Write($data)
$writer.Close()

$json = @{
  audio = "conversation.wav"
  durationMs = $positionMs
  voices = @{ male = $MaleVoice; female = $FemaleVoice }
  turns = $expected
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $OutDir "conversation.expected.json"), $json)
Write-Output "Wrote $wavPath ($positionMs ms, $($expected.Count) turns)"
