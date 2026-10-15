"""Speaker turns, transcript and a timeline file for a two-mascot podcast recording.

Given one recording of one or two voices, this finds who speaks when, names
the voices after the mascots by pitch (Hamza is the lower voice, Zoya the
higher), transcribes each turn, and writes a timeline JSON the site can play
against: the speaking mascot's avatar glows and swaps expression in time with
the audio.

Usage:
    python scripts/diarize_podcast.py AUDIO [--out FILE] [--language ur]
        [--title "..."] [--caption "..."]
        [--speakers hamza=low,zoya=high | --speakers zoya] [--voices auto|1|2]
        [--map hamza=1,zoya=0] [--whisper-model small] [--no-transcript]
    python scripts/diarize_podcast.py --check FILE

A recording with one voice (a solo brief) is detected on its own: when the
two clusters of a two-way split sit close together, they are one speaker,
named by absolute pitch. --speakers with a single name, or --voices, forces
the count.

Everything runs locally on the CPU with no account or token: Silero VAD finds
speech, a SpeechBrain ECAPA model embeds short windows of it, the windows are
clustered into the speakers, and faster-whisper transcribes. The first run
downloads the ECAPA and Whisper models (a few hundred MB) into the cache dir.

Pure functions (turn building, mascot naming, word attachment, checking) take
plain Python data and import nothing heavy, so they are unit-tested without
the models; see test_diarize_podcast.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

SAMPLE_RATE = 16000
FRAME_MS = 20            # label grid
WINDOW_MS = 1500         # embedding window
HOP_MS = 250             # embedding window hop
SMOOTH_FRAMES = 15       # median filter width over the label grid (300 ms)
MAX_GAP_MS = 1200        # a pause shorter than this does not end a turn
MIN_TURN_MS = 600        # a run shorter than this is absorbed by a neighbour
PITCH_SAMPLE_MS = 40000  # how much of each speaker is pitch-tracked
PITCH_CONFIDENT_RATIO = 1.15
LOW_VOICE_MAX_HZ = 155   # a lone voice below this median pitch is the low mascot
LONE_VOICE_UNSURE_HZ = (140, 170)
MAX_TURN_MS = 30000      # a longer turn is split at its pauses so expressions can change
MIN_PIECE_MS = 3000      # ...but never into a piece shorter than this
ONE_VOICE_MAX_CENTROID_DISTANCE = 0.35  # cosine distance between the two clusters' centroids
# Measured: two voices (synthetic English pair, NotebookLM Urdu pair) 0.73;
# one voice split in two 0.14 to 0.15.

EXPRESSIONS = ("speaking", "laughing", "thoughtful")
DEFAULT_SPEAKERS = "hamza=low,zoya=high"
TIMELINE_VERSION = 1
CACHE_DIR = Path(os.environ.get("ISHQNAMA_PODCAST_CACHE", Path.home() / ".cache" / "ishqnama-podcast"))


def log(message: str) -> None:
    print(f"[diarize] {message}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------- audio ----

def decode_audio(path: Path):
    """Decode any container PyAV reads (m4a, mp3, wav...) to float32 mono 16 kHz."""
    import av
    import numpy as np

    resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
    chunks = []
    with av.open(str(path)) as container:
        stream = container.streams.audio[0]
        for frame in container.decode(stream):
            for out in resampler.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):
            chunks.append(out.to_ndarray().reshape(-1))
    if not chunks:
        raise SystemExit(f"No audio decoded from {path}")
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def speech_regions(wav) -> list[tuple[int, int]]:
    """Speech spans in ms from Silero VAD."""
    import torch
    from silero_vad import get_speech_timestamps, load_silero_vad

    model = load_silero_vad()
    spans = get_speech_timestamps(
        torch.from_numpy(wav), model, sampling_rate=SAMPLE_RATE,
        min_speech_duration_ms=200, min_silence_duration_ms=250, speech_pad_ms=60,
    )
    return [(s["start"] * 1000 // SAMPLE_RATE, s["end"] * 1000 // SAMPLE_RATE) for s in spans]


def plan_windows(regions: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Fixed windows stepping through each speech region; a short region is one window."""
    windows = []
    for start, end in regions:
        if end - start <= WINDOW_MS:
            windows.append((start, end))
            continue
        at = start
        while at + WINDOW_MS <= end:
            windows.append((at, at + WINDOW_MS))
            at += HOP_MS
        if windows[-1][1] < end:
            windows.append((end - WINDOW_MS, end))
    return windows


def embed_windows(wav, windows: list[tuple[int, int]]):
    import numpy as np
    import torch
    from speechbrain.inference.speaker import EncoderClassifier
    from speechbrain.utils.fetching import LocalStrategy

    # Download straight into our cache: the default symlinks into the Hugging
    # Face cache, which Windows refuses without a developer-mode privilege.
    encoder = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir=str(CACHE_DIR / "ecapa"),
        run_opts={"device": "cpu"},
        local_strategy=LocalStrategy.COPY_SKIP_CACHE,
    )
    embeddings = np.zeros((len(windows), 192), dtype=np.float32)
    batch_size = 32
    for first in range(0, len(windows), batch_size):
        batch = windows[first:first + batch_size]
        clips = [wav[s * SAMPLE_RATE // 1000:e * SAMPLE_RATE // 1000] for s, e in batch]
        longest = max(len(c) for c in clips)
        padded = np.zeros((len(clips), longest), dtype=np.float32)
        lengths = np.zeros(len(clips), dtype=np.float32)
        for i, clip in enumerate(clips):
            padded[i, :len(clip)] = clip
            lengths[i] = len(clip) / longest
        with torch.no_grad():
            out = encoder.encode_batch(torch.from_numpy(padded), torch.from_numpy(lengths))
        embeddings[first:first + len(batch)] = out.squeeze(1).cpu().numpy()
    return embeddings


def unit_vectors(embeddings):
    import numpy as np

    return embeddings / np.maximum(np.linalg.norm(embeddings, axis=1, keepdims=True), 1e-9)


def cluster_windows(unit, count: int) -> list[int]:
    """k-means over unit embeddings. Average-linkage agglomerative clustering
    was tried first and split a real two-voice podcast into everything plus a
    one-second sliver; k-means and spectral clustering agree with each other."""
    from sklearn.cluster import KMeans

    model = KMeans(n_clusters=count, n_init=10, random_state=0)
    return [int(label) for label in model.fit_predict(unit)]


# ---------------------------------------------------------- pure logic ----

def _median_filter(values: list[int], width: int) -> list[int]:
    half = width // 2
    out = []
    for i in range(len(values)):
        window = sorted(values[max(0, i - half):i + half + 1])
        out.append(window[len(window) // 2])
    return out


def build_turns(regions, windows, labels, duration_ms: int) -> list[dict]:
    """Turn the per-window cluster labels into ordered speaking turns.

    Every 20 ms frame inside speech takes the label of the windows covering it,
    each window weighted by how close the frame is to its centre, so a boundary
    lands where the nearest windows change rather than where a window edge is.
    Labels are then median-filtered inside each region, runs become segments,
    a pause shorter than MAX_GAP_MS between two runs of one speaker is folded
    into the turn, and a run shorter than MIN_TURN_MS is absorbed by a
    neighbour (one of its own speaker if there is one, else the longer), so a
    lone mislabelled window or a listener's "hmm" never becomes a flicker.
    """
    frames = duration_ms // FRAME_MS + 1
    speech = [False] * frames
    for start, end in regions:
        for f in range(start // FRAME_MS, min(frames, (end + FRAME_MS - 1) // FRAME_MS)):
            speech[f] = True

    clusters = max(labels, default=-1) + 1
    votes = [[0.0] * clusters for _ in range(frames)]
    for (start, end), label in zip(windows, labels):
        centre = (start + end) / 2
        half = max((end - start) / 2, 1)
        for f in range(start // FRAME_MS, min(frames, end // FRAME_MS)):
            at = f * FRAME_MS + FRAME_MS / 2
            votes[f][label] += 1 - min(abs(at - centre) / half, 1) * 0.5

    label_of = [-1] * frames
    for f in range(frames):
        if speech[f] and any(votes[f]):
            label_of[f] = max(range(clusters), key=lambda c: votes[f][c])

    # Inside each speech run, a frame no window voted on takes its nearest
    # neighbour's label, then the run is smoothed.
    f = 0
    while f < frames:
        if not speech[f]:
            f += 1
            continue
        g = f
        while g < frames and speech[g]:
            g += 1
        run = label_of[f:g]
        for i in range(1, len(run)):
            if run[i] < 0:
                run[i] = run[i - 1]
        for i in range(len(run) - 2, -1, -1):
            if run[i] < 0:
                run[i] = run[i + 1]
        label_of[f:g] = _median_filter(run, SMOOTH_FRAMES) if run[0] >= 0 else run
        f = g

    segments = []
    f = 0
    while f < frames:
        if label_of[f] < 0:
            f += 1
            continue
        g = f
        while g < frames and label_of[g] == label_of[f]:
            g += 1
        segments.append({"cluster": label_of[f], "fromMs": f * FRAME_MS, "toMs": min(g * FRAME_MS, duration_ms)})
        f = g

    return merge_segments(segments)


def merge_segments(segments: list[dict]) -> list[dict]:
    """Fold short pauses into turns and absorb runs too short to be a turn."""
    turns: list[dict] = []
    for seg in segments:
        last = turns[-1] if turns else None
        if last and last["cluster"] == seg["cluster"] and seg["fromMs"] - last["toMs"] < MAX_GAP_MS:
            last["toMs"] = seg["toMs"]
        else:
            turns.append(dict(seg))

    changed = True
    while changed and len(turns) > 1:
        changed = False
        for i, turn in enumerate(turns):
            if turn["toMs"] - turn["fromMs"] >= MIN_TURN_MS:
                continue
            prev = turns[i - 1] if i > 0 else None
            nxt = turns[i + 1] if i + 1 < len(turns) else None
            same_prev = prev and prev["cluster"] == turn["cluster"]
            same_next = nxt and nxt["cluster"] == turn["cluster"]
            if prev and nxt and prev["cluster"] == nxt["cluster"]:
                prev["toMs"] = nxt["toMs"]
                del turns[i:i + 2]
            elif same_prev or (prev and not same_next and (not nxt or prev["toMs"] - prev["fromMs"] >= nxt["toMs"] - nxt["fromMs"])):
                prev["toMs"] = turn["toMs"]
                del turns[i]
            elif nxt:
                nxt["fromMs"] = turn["fromMs"]
                del turns[i]
            else:
                continue
            changed = True
            break
    return turns


def parse_speakers(spec: str) -> list[tuple[str, str | None]]:
    """'hamza=low,zoya=high' -> [('hamza', 'low'), ('zoya', 'high')]; 'zoya' -> [('zoya', None)]."""
    items = [item.strip() for item in spec.split(",") if item.strip()]
    if len(items) == 1 and "=" not in items[0]:
        return [(items[0], None)]
    pairs = []
    for item in items:
        name, _, voice = item.partition("=")
        if voice not in ("low", "high") or not name:
            raise SystemExit(f"--speakers expects one name, or name=low|high pairs, got {item!r}")
        pairs.append((name, voice))
    if len(pairs) != 2 or {v for _, v in pairs} != {"low", "high"}:
        raise SystemExit("--speakers must name one mascot, or exactly one low and one high voice")
    return pairs


def centroid_distance(unit, labels: list[int]) -> float:
    """Cosine distance between the mean vectors of the two clusters."""
    groups = {}
    for vector, label in zip(unit, labels):
        groups.setdefault(label, []).append(vector)
    if len(groups) < 2:
        return 0.0
    centroids = []
    for vectors in groups.values():
        dims = len(vectors[0])
        centroids.append([sum(v[i] for v in vectors) / len(vectors) for i in range(dims)])
    a, b = centroids[:2]
    dot = sum(x * y for x, y in zip(a, b))
    norm = (sum(x * x for x in a) ** 0.5) * (sum(y * y for y in b) ** 0.5)
    return 1 - dot / max(norm, 1e-9)


def looks_like_one_voice(unit, labels: list[int]) -> bool:
    """Two clusters whose centroids sit close together are one voice split in two."""
    return centroid_distance(unit, labels) < ONE_VOICE_MAX_CENTROID_DISTANCE


def split_long_turns(turns: list[dict], regions: list[tuple[int, int]]) -> list[dict]:
    """Split any turn longer than MAX_TURN_MS at the widest pause inside it.

    Only a pause that leaves at least MIN_PIECE_MS on both sides counts, so a
    breath near the edge of a turn never makes a sliver.
    """
    out = []
    for turn in turns:
        pieces = [turn]
        changed = True
        while changed:
            changed = False
            for i, piece in enumerate(pieces):
                if piece["toMs"] - piece["fromMs"] <= MAX_TURN_MS:
                    continue
                gaps = [
                    (regions[k + 1][0] - regions[k][1], regions[k][1], regions[k + 1][0])
                    for k in range(len(regions) - 1)
                    if piece["fromMs"] + MIN_PIECE_MS <= regions[k][1]
                    and regions[k + 1][0] + MIN_PIECE_MS <= piece["toMs"]
                ]
                if not gaps:
                    continue
                _, pause_start, pause_end = max(gaps)
                pieces[i:i + 1] = [dict(piece, toMs=pause_start), dict(piece, fromMs=pause_end)]
                changed = True
                break
        out.extend(pieces)
    return out


def parse_map(spec: str | None) -> dict[str, int] | None:
    """'hamza=1,zoya=0' -> {'hamza': 1, 'zoya': 0}."""
    if not spec:
        return None
    mapping = {}
    for item in spec.split(","):
        name, _, cluster = item.strip().partition("=")
        if not name or not cluster.isdigit():
            raise SystemExit(f"--map expects name=clusterIndex pairs, got {item!r}")
        mapping[name] = int(cluster)
    return mapping


def name_speakers(pitches: dict[int, float], speakers: list[tuple[str, str | None]], override: dict[str, int] | None):
    """Map cluster index -> mascot name, by pitch unless an override says otherwise.

    Returns (mapping, confidence), where confidence is 'high', 'low' or
    'override'. With two voices, low confidence means their median pitches are
    within PITCH_CONFIDENT_RATIO of each other; with one voice, that its pitch
    sits in the LONE_VOICE_UNSURE_HZ band between a typical low and high voice.
    """
    if override:
        return {cluster: name for name, cluster in override.items()}, "override"
    if len(pitches) == 1:
        (cluster, pitch), = pitches.items()
        if len(speakers) == 1:
            return {cluster: speakers[0][0]}, "high"
        by_voice = {voice: name for name, voice in speakers}
        name = by_voice["low"] if pitch < LOW_VOICE_MAX_HZ else by_voice["high"]
        unsure = LONE_VOICE_UNSURE_HZ[0] <= pitch <= LONE_VOICE_UNSURE_HZ[1]
        return {cluster: name}, ("low" if unsure else "high")
    if len(speakers) == 1:
        raise SystemExit("two voices were found but --speakers names one mascot; name both, or pass --voices 1")
    ordered = sorted(pitches, key=lambda c: pitches[c])
    low, high = ordered[0], ordered[-1]
    by_voice = {voice: name for name, voice in speakers}
    mapping = {low: by_voice["low"], high: by_voice["high"]}
    ratio = pitches[high] / max(pitches[low], 1e-6)
    return mapping, ("high" if ratio >= PITCH_CONFIDENT_RATIO else "low")


def topic_fields(title: str | None, caption: str | None) -> dict[str, str]:
    """The timeline's title and caption, only those given and not blank."""
    fields = {}
    if title and title.strip():
        fields["title"] = title.strip()
    if caption and caption.strip():
        fields["caption"] = caption.strip()
    return fields


def attach_words(turns: list[dict], words: list[tuple[float, float, str]]) -> None:
    """Give every turn the words whose midpoint falls in it (else the nearest turn)."""
    texts: dict[int, list[str]] = {i: [] for i in range(len(turns))}
    for start, end, text in words:
        mid = (start + end) / 2
        home = None
        for i, turn in enumerate(turns):
            if turn["fromMs"] <= mid < turn["toMs"]:
                home = i
                break
        if home is None and turns:
            home = min(range(len(turns)), key=lambda i: min(abs(mid - turns[i]["fromMs"]), abs(mid - turns[i]["toMs"])))
        if home is not None:
            texts[home].append(text.strip())
    for i, turn in enumerate(turns):
        turn["text"] = " ".join(t for t in texts[i] if t)


def check_timeline(timeline: dict) -> list[str]:
    """Problems with a timeline file, empty when it is sound."""
    problems = []
    speakers = timeline.get("speakers", {})
    turns = timeline.get("turns", [])
    duration = timeline.get("durationMs", 0)
    if timeline.get("version") != TIMELINE_VERSION:
        problems.append(f"version should be {TIMELINE_VERSION}")
    if not turns:
        problems.append("no turns")
    last_end = 0
    for i, turn in enumerate(turns):
        where = f"turn {i} at {turn.get('fromMs')}ms"
        if turn.get("speaker") not in speakers:
            problems.append(f"{where}: unknown speaker {turn.get('speaker')!r}")
        if turn.get("expression") not in EXPRESSIONS:
            problems.append(f"{where}: expression must be one of {', '.join(EXPRESSIONS)}")
        if not (isinstance(turn.get("fromMs"), int) and isinstance(turn.get("toMs"), int)):
            problems.append(f"{where}: fromMs and toMs must be integers")
            continue
        if turn["fromMs"] < last_end:
            problems.append(f"{where}: overlaps the turn before it")
        if turn["toMs"] <= turn["fromMs"]:
            problems.append(f"{where}: ends before it starts")
        if turn["toMs"] > duration:
            problems.append(f"{where}: ends after the recording ({duration}ms)")
        last_end = turn["toMs"]
    if not timeline.get("expressionsReviewed"):
        problems.append("expressionsReviewed is false: the expressions have not been reviewed against the transcript")
    return problems


# ---------------------------------------------------------- heavy steps ----

def pitch_per_cluster(wav, turns: list[dict]) -> dict[int, float]:
    import librosa
    import numpy as np

    pitches = {}
    for cluster in sorted({t["cluster"] for t in turns}):
        pieces, taken = [], 0
        for turn in turns:
            if turn["cluster"] != cluster or taken >= PITCH_SAMPLE_MS:
                continue
            take = min(turn["toMs"] - turn["fromMs"], PITCH_SAMPLE_MS - taken)
            pieces.append(wav[turn["fromMs"] * SAMPLE_RATE // 1000:(turn["fromMs"] + take) * SAMPLE_RATE // 1000])
            taken += take
        sample = np.concatenate(pieces)
        f0, voiced, _ = librosa.pyin(sample, fmin=65, fmax=400, sr=SAMPLE_RATE, frame_length=1024)
        voiced_f0 = f0[voiced & ~np.isnan(f0)]
        pitches[cluster] = float(np.median(voiced_f0)) if len(voiced_f0) else 0.0
    return pitches


def transcribe(wav, language: str | None, model_name: str):
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8", download_root=str(CACHE_DIR / "whisper"))
    segments, info = model.transcribe(wav, language=language, word_timestamps=True, vad_filter=True, beam_size=5)
    words = []
    for segment in segments:
        for word in segment.words or []:
            words.append((word.start * 1000, word.end * 1000, word.word))
    return words, info.language


# ---------------------------------------------------------------- main ----

def run(args) -> int:
    audio = Path(args.audio)
    out = Path(args.out) if args.out else audio.with_suffix(".timeline.json")
    speakers = parse_speakers(args.speakers)
    override = parse_map(args.map)

    started = time.time()
    log(f"decoding {audio.name}")
    wav = decode_audio(audio)
    duration_ms = len(wav) * 1000 // SAMPLE_RATE
    log(f"{duration_ms / 1000:.1f} s of audio")

    regions = speech_regions(wav)
    log(f"{len(regions)} speech regions, {sum(e - s for s, e in regions) / 1000:.1f} s of speech")
    windows = plan_windows(regions)
    voices = 1 if len(speakers) == 1 else args.voices
    if voices == 1:
        labels = [0] * len(windows)
        detection = "forced"
    else:
        log(f"embedding {len(windows)} windows")
        unit = unit_vectors(embed_windows(wav, windows))
        labels = cluster_windows(unit, 2)
        detection = "forced" if voices == 2 else "auto"
        separation = centroid_distance(unit, labels)
        log(f"the two clusters are {separation:.2f} apart (one voice splits under {ONE_VOICE_MAX_CENTROID_DISTANCE})")
        if voices == "auto" and looks_like_one_voice(unit, labels):
            log("treating the recording as one voice")
            labels = [0] * len(windows)
    turns = split_long_turns(build_turns(regions, windows, labels, duration_ms), regions)
    log(f"{len(turns)} turns")

    pitches = pitch_per_cluster(wav, turns)
    mapping, confidence = name_speakers(pitches, speakers, override)
    for cluster, pitch in sorted(pitches.items()):
        log(f"cluster {cluster}: median pitch {pitch:.0f} Hz -> {mapping.get(cluster, '?')}")
    if confidence == "low":
        log("WARNING: pitch cannot settle who this is; confirm by ear and rerun with --map if it is wrong")

    language = args.language
    if args.no_transcript:
        for turn in turns:
            turn["text"] = ""
    else:
        log(f"transcribing with whisper {args.whisper_model}")
        words, language = transcribe(wav, args.language, args.whisper_model)
        attach_words(turns, words)

    timeline = {
        "version": TIMELINE_VERSION,
        "audio": audio.name,
        **topic_fields(args.title, args.caption),
        "durationMs": duration_ms,
        "language": language,
        "speakers": {
            name: {
                "cluster": cluster,
                "medianPitchHz": round(pitches[cluster]),
                "speechMs": sum(t["toMs"] - t["fromMs"] for t in turns if t["cluster"] == cluster),
            }
            for cluster, name in sorted(mapping.items())
        },
        "pitchConfidence": confidence,
        "voices": len(mapping),
        "voiceDetection": detection,
        "expressionsReviewed": False,
        "turns": [
            {
                "speaker": mapping[t["cluster"]],
                "fromMs": t["fromMs"],
                "toMs": t["toMs"],
                "expression": "speaking",
                "text": t["text"],
            }
            for t in turns
        ],
    }
    out.write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"wrote {out} in {time.time() - started:.0f} s")
    print_summary(timeline)
    return 0


def print_summary(timeline: dict) -> None:
    for name, info in timeline["speakers"].items():
        print(f"{name}: cluster {info['cluster']}, median pitch {info['medianPitchHz']} Hz, speaks for {info['speechMs'] / 1000:.0f} s")
    print(f"voices: {timeline['voices']} ({timeline['voiceDetection']}), pitch confidence: {timeline['pitchConfidence']}")
    for i, turn in enumerate(timeline["turns"]):
        text = turn.get("text", "")
        print(f"{i:3d} {turn['speaker']:<8} {turn['fromMs'] / 1000:7.1f} - {turn['toMs'] / 1000:7.1f}  {turn['expression']:<10} {text}")


def check(path: str) -> int:
    timeline = json.loads(Path(path).read_text(encoding="utf-8"))
    problems = check_timeline(timeline)
    for problem in problems:
        print(problem)
    if not problems:
        print(f"ok: {len(timeline['turns'])} turns over {timeline['durationMs'] / 1000:.1f} s")
    return 1 if problems else 0


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("audio", nargs="?", help="the recording (m4a, mp3, wav...)")
    parser.add_argument("--out", help="timeline file to write (default: beside the audio as <name>.timeline.json)")
    parser.add_argument("--language", help="ISO code of the spoken language, e.g. ur; detected when left out")
    parser.add_argument("--title", help="the topic, as the bubble heads it, in the recording's own script")
    parser.add_argument("--caption", help="one line under the title")
    parser.add_argument("--speakers", default=DEFAULT_SPEAKERS, help=f"the cast: one mascot name, or name=low,name=high (default {DEFAULT_SPEAKERS})")
    parser.add_argument("--voices", default="auto", choices=["auto", "1", "2"], help="how many voices the recording has (default auto)")
    parser.add_argument("--map", help="force cluster indices onto mascots, e.g. hamza=1,zoya=0")
    parser.add_argument("--whisper-model", default="small", help="faster-whisper model size (default small)")
    parser.add_argument("--no-transcript", action="store_true", help="skip transcription")
    parser.add_argument("--check", metavar="FILE", help="validate a timeline file instead of making one")
    args = parser.parse_args(argv)
    if args.voices != "auto":
        args.voices = int(args.voices)
    if args.check:
        return check(args.check)
    if not args.audio:
        parser.error("an audio file is required (or --check FILE)")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
