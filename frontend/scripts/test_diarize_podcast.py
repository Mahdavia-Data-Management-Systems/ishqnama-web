"""Tests for diarize_podcast.py.

The pure-logic tests run anywhere. The end-to-end test needs the podcast venv
(torch and friends, see podcast-requirements.txt) and Windows, whose built-in
voices make the fixture, and skips itself otherwise:

    .venv-podcast/Scripts/python -m unittest scripts/test_diarize_podcast.py
"""

import importlib.util
import json
import platform
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import diarize_podcast as d  # noqa: E402

HERE = Path(__file__).parent


def seg(cluster, from_ms, to_ms):
    return {"cluster": cluster, "fromMs": from_ms, "toMs": to_ms}


class MergeSegmentsTest(unittest.TestCase):
    def test_short_pause_inside_one_speaker_is_folded_into_the_turn(self):
        turns = d.merge_segments([seg(0, 0, 3000), seg(0, 3500, 6000)])
        self.assertEqual(turns, [seg(0, 0, 6000)])

    def test_long_pause_keeps_two_turns(self):
        turns = d.merge_segments([seg(0, 0, 3000), seg(0, 3000 + d.MAX_GAP_MS, 8000)])
        self.assertEqual(len(turns), 2)

    def test_short_run_between_one_speaker_is_absorbed(self):
        turns = d.merge_segments([seg(0, 0, 3000), seg(1, 3000, 3300), seg(0, 3300, 6000)])
        self.assertEqual(turns, [seg(0, 0, 6000)])

    def test_short_run_joins_its_own_speaker_across_a_long_pause(self):
        turns = d.merge_segments([seg(0, 0, 5000), seg(1, 5000, 5300), seg(1, 5300 + d.MAX_GAP_MS, 9000)])
        self.assertEqual(turns, [seg(0, 0, 5000), seg(1, 5000, 9000)])

    def test_short_run_between_different_speakers_joins_the_longer_neighbour(self):
        turns = d.merge_segments([seg(0, 0, 5000), seg(1, 5000, 5300), seg(2, 5300, 7000)])
        self.assertEqual(turns, [seg(0, 0, 5300), seg(2, 5300, 7000)])

    def test_short_opening_run_joins_the_turn_after_it(self):
        turns = d.merge_segments([seg(1, 0, 200), seg(0, 200, 4000)])
        self.assertEqual(turns, [seg(0, 0, 4000)])


class BuildTurnsTest(unittest.TestCase):
    def test_windows_vote_into_turns_bounded_by_speech(self):
        regions = [(0, 5000), (6000, 11000)]
        windows = [(0, 1500), (250, 1750), (500, 2000), (3500, 5000), (6000, 7500), (9500, 11000)]
        labels = [0, 0, 0, 0, 1, 1]
        turns = d.build_turns(regions, windows, labels, 11000)
        self.assertEqual([t["cluster"] for t in turns], [0, 1])
        self.assertEqual(turns[0]["fromMs"], 0)
        self.assertEqual(turns[0]["toMs"], 5000)
        self.assertEqual(turns[1]["fromMs"], 6000)
        self.assertEqual(turns[1]["toMs"], 11000)

    def test_boundary_inside_a_region_lands_between_the_windows(self):
        regions = [(0, 6000)]
        windows = [(0, 1500), (500, 2000), (1000, 2500), (3000, 4500), (3500, 5000), (4000, 5500)]
        labels = [0, 0, 0, 1, 1, 1]
        turns = d.build_turns(regions, windows, labels, 6000)
        self.assertEqual([t["cluster"] for t in turns], [0, 1])
        self.assertGreaterEqual(turns[0]["toMs"], 2500)
        self.assertLessEqual(turns[1]["fromMs"], 3100)


class NameSpeakersTest(unittest.TestCase):
    speakers = d.parse_speakers("hamza=low,zoya=high")

    def test_lower_pitch_is_the_low_voice(self):
        mapping, confidence = d.name_speakers({0: 190.0, 1: 105.0}, self.speakers, None)
        self.assertEqual(mapping, {1: "hamza", 0: "zoya"})
        self.assertEqual(confidence, "high")

    def test_close_pitches_are_low_confidence(self):
        _, confidence = d.name_speakers({0: 150.0, 1: 140.0}, self.speakers, None)
        self.assertEqual(confidence, "low")

    def test_override_wins(self):
        mapping, confidence = d.name_speakers({0: 190.0, 1: 105.0}, self.speakers, d.parse_map("hamza=0,zoya=1"))
        self.assertEqual(mapping, {0: "hamza", 1: "zoya"})
        self.assertEqual(confidence, "override")

    def test_speakers_spec_needs_one_low_and_one_high(self):
        with self.assertRaises(SystemExit):
            d.parse_speakers("hamza=low,zoya=low")


class OneVoiceTest(unittest.TestCase):
    def test_single_name_cast_and_lone_voice_by_pitch(self):
        self.assertEqual(d.parse_speakers("zoya"), [("zoya", None)])
        cast = d.parse_speakers("hamza=low,zoya=high")
        self.assertEqual(d.name_speakers({0: 211.0}, cast, None), ({0: "zoya"}, "high"))
        self.assertEqual(d.name_speakers({0: 97.0}, cast, None), ({0: "hamza"}, "high"))
        self.assertEqual(d.name_speakers({0: 150.0}, cast, None)[1], "low")
        self.assertEqual(d.name_speakers({0: 150.0}, d.parse_speakers("hamza"), None), ({0: "hamza"}, "high"))

    def test_two_voices_with_a_single_name_cast_is_refused(self):
        with self.assertRaises(SystemExit):
            d.name_speakers({0: 100.0, 1: 200.0}, d.parse_speakers("hamza"), None)

    def test_close_clusters_are_one_voice_and_far_clusters_are_two(self):
        import math
        def ray(angle):
            return [math.cos(angle), math.sin(angle), 0.0]
        close = [ray(0.0)] * 10 + [ray(0.3)] * 10          # 0.3 rad apart: cosine distance 0.045
        far = [ray(0.0)] * 10 + [ray(math.pi / 2)] * 10    # a right angle: cosine distance 1
        labels = [0] * 10 + [1] * 10
        self.assertTrue(d.looks_like_one_voice(close, labels))
        self.assertFalse(d.looks_like_one_voice(far, labels))
        self.assertAlmostEqual(d.centroid_distance(far, labels), 1.0)

    def test_long_turn_splits_at_its_widest_pause(self):
        regions = [(0, 20000), (20400, 45000), (46000, 70000)]
        turns = d.split_long_turns([seg(0, 0, 70000)], regions)
        self.assertEqual([(t["fromMs"], t["toMs"]) for t in turns], [(0, 20000), (20400, 45000), (46000, 70000)])

    def test_a_pause_near_the_edge_never_makes_a_sliver(self):
        regions = [(0, 31000), (31400, 31900), (32700, 50000)]
        turns = d.split_long_turns([seg(0, 0, 50000)], regions)
        self.assertEqual([(t["fromMs"], t["toMs"]) for t in turns], [(0, 31900), (32700, 50000)])

    def test_turn_without_an_inner_pause_is_left_whole(self):
        turns = d.split_long_turns([seg(0, 0, 70000)], [(0, 70000)])
        self.assertEqual(turns, [seg(0, 0, 70000)])


class AttachWordsTest(unittest.TestCase):
    def test_words_go_to_the_turn_holding_their_midpoint_else_the_nearest(self):
        turns = [seg(0, 0, 2000), seg(1, 3000, 5000)]
        d.attach_words(turns, [(100, 500, " hello"), (1800, 2300, "there"), (2400, 2700, "um"), (3100, 3500, "yes")])
        self.assertEqual(turns[0]["text"], "hello there")
        self.assertEqual(turns[1]["text"], "um yes")


class TopicTest(unittest.TestCase):
    def test_title_and_caption_are_written_when_given_and_left_out_otherwise(self):
        self.assertEqual(d.topic_fields("جملہ مستأنفہ", "The resumptive clause"), {"title": "جملہ مستأنفہ", "caption": "The resumptive clause"})
        self.assertEqual(d.topic_fields(None, None), {})
        self.assertEqual(d.topic_fields(" Title ", None), {"title": "Title"})


class EpisodePathsTest(unittest.TestCase):
    def test_episode_is_named_after_the_recording_by_default(self):
        audio = Path("C:/anywhere/Jumla e Mustanifa.m4a")
        self.assertEqual(d.episode_paths(audio, None, None), Path("C:/anywhere/Jumla e Mustanifa.timeline.json"))

    def test_a_name_renames_the_timeline_beside_the_recording(self):
        audio = Path("C:/anywhere/NotebookLM export (3).m4a")
        self.assertEqual(d.episode_paths(audio, "mustanifa_brief", None), Path("C:/anywhere/mustanifa_brief.timeline.json"))

    def test_a_recording_name_with_a_dot_needs_a_name(self):
        with self.assertRaises(SystemExit):
            d.episode_paths(Path("C:/anywhere/export v2.1.m4a"), None, None)
        self.assertEqual(d.episode_paths(Path("C:/anywhere/export v2.1.m4a"), "sabr_brief", None), Path("C:/anywhere/sabr_brief.timeline.json"))

    def test_out_wins_over_the_name(self):
        audio = Path("C:/anywhere/raw.wav")
        self.assertEqual(d.episode_paths(audio, "sabr", "C:/ready/x.timeline.json"), Path("C:/ready/x.timeline.json"))

    def test_a_blank_or_pathlike_name_is_refused(self):
        audio = Path("C:/anywhere/raw.wav")
        for bad in ("", "  ", "a/b", "a" + chr(92) + "b", "..", "a.timeline", "x.v1"):
            with self.assertRaises(SystemExit, msg=bad):
                d.episode_paths(audio, bad, None)


class ReleaseNamesTest(unittest.TestCase):
    def test_first_release_is_v1_for_both_files(self):
        plan = d.release_plan([], "mustanifa_brief", ".m4a", lambda name: False)
        self.assertEqual(plan, {"audio": "mustanifa_brief.v1.m4a", "timeline": "mustanifa_brief.timeline.v1.json", "audioReused": False})

    def test_a_changed_recording_takes_the_next_version_of_each(self):
        existing = ["mustanifa_brief.v1.m4a", "mustanifa_brief.timeline.v1.json", "mustanifa_brief.timeline.v2.json", "other.v3.m4a", "mustanifa_brief_long.v4.m4a"]
        plan = d.release_plan(existing, "mustanifa_brief", ".m4a", lambda name: False)
        self.assertEqual(plan, {"audio": "mustanifa_brief.v2.m4a", "timeline": "mustanifa_brief.timeline.v3.json", "audioReused": False})

    def test_an_unchanged_recording_keeps_its_version_and_only_the_timeline_moves_on(self):
        existing = ["mustanifa_brief.v1.m4a", "mustanifa_brief.v2.m4a", "mustanifa_brief.timeline.v1.json"]
        plan = d.release_plan(existing, "mustanifa_brief", ".m4a", lambda name: name == "mustanifa_brief.v1.m4a")
        self.assertEqual(plan, {"audio": "mustanifa_brief.v1.m4a", "timeline": "mustanifa_brief.timeline.v2.json", "audioReused": True})

    def test_episode_name_comes_from_the_draft_timeline_name(self):
        self.assertEqual(d.episode_of(Path("C:/x/mustanifa_brief.timeline.json")), "mustanifa_brief")
        with self.assertRaises(SystemExit):
            d.episode_of(Path("C:/x/mustanifa_brief.json"))
        with self.assertRaises(SystemExit):
            d.episode_of(Path("C:/x/mustanifa_brief.timeline.v1.json"))


class ReleaseTest(unittest.TestCase):
    def draft(self, folder: Path, episode: str, reviewed=True, audio_bytes=b"recording-one"):
        (folder / "raw.m4a").write_bytes(audio_bytes)
        timeline = {
            "version": d.TIMELINE_VERSION, "audio": "raw.m4a", "durationMs": 10000, "language": "ur",
            "speakers": {"zoya": {"cluster": 0, "medianPitchHz": 220, "speechMs": 4000}},
            "pitchConfidence": "high", "voices": 1, "voiceDetection": "auto", "expressionsReviewed": reviewed,
            "turns": [{"speaker": "zoya", "fromMs": 0, "toMs": 4000, "expression": "speaking", "text": "salam"}],
        }
        path = folder / f"{episode}.timeline.json"
        path.write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")
        return path

    def test_release_moves_both_files_into_the_folder_under_v1_and_names_the_versioned_recording(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, dest = Path(tmp) / "src", Path(tmp) / "dest"
            src.mkdir()
            draft = self.draft(src, "sabr_brief")
            self.assertEqual(d.main(["--release", str(draft), "--into", str(dest)]), 0)
            self.assertEqual(sorted(p.name for p in dest.iterdir()), ["sabr_brief.timeline.v1.json", "sabr_brief.v1.m4a"])
            self.assertEqual(sorted(p.name for p in src.iterdir()), [])
            released = json.loads((dest / "sabr_brief.timeline.v1.json").read_text(encoding="utf-8"))
            self.assertEqual(released["audio"], "sabr_brief.v1.m4a")
            self.assertEqual(released["turns"][0]["text"], "salam")
            self.assertEqual((dest / "sabr_brief.v1.m4a").read_bytes(), b"recording-one")

    def test_a_second_release_with_the_same_recording_adds_only_a_timeline_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, dest = Path(tmp) / "src", Path(tmp) / "dest"
            src.mkdir()
            d.main(["--release", str(self.draft(src, "sabr_brief")), "--into", str(dest)])
            d.main(["--release", str(self.draft(src, "sabr_brief")), "--into", str(dest)])
            self.assertEqual(sorted(p.name for p in dest.iterdir()), ["sabr_brief.timeline.v1.json", "sabr_brief.timeline.v2.json", "sabr_brief.v1.m4a"])
            self.assertEqual(sorted(p.name for p in src.iterdir()), [])
            d.main(["--release", str(self.draft(src, "sabr_brief", audio_bytes=b"recording-two")), "--into", str(dest)])
            self.assertIn("sabr_brief.v2.m4a", [p.name for p in dest.iterdir()])
            self.assertEqual(json.loads((dest / "sabr_brief.timeline.v3.json").read_text(encoding="utf-8"))["audio"], "sabr_brief.v2.m4a")

    def test_an_unreviewed_timeline_is_not_released(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, dest = Path(tmp) / "src", Path(tmp) / "dest"
            src.mkdir()
            draft = self.draft(src, "sabr_brief", reviewed=False)
            self.assertNotEqual(d.main(["--release", str(draft), "--into", str(dest)]), 0)
            self.assertFalse(dest.exists())
            self.assertTrue(draft.exists() and (src / "raw.m4a").exists())


class ReflectionTest(unittest.TestCase):
    """--article and --attach: a released recording becomes a reflection on an essay."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.src, self.dest, self.essays = root / "src", root / "podcasts" / "articles" / "nooreimaan", root / "essays"
        self.src.mkdir()
        self.essays.mkdir()
        self.essay = self.essays / "naskh.json"
        self.essay.write_text(json.dumps({"slug": "naskh", "urduTitle": "نسخ", "blocks": [], "reflections": []}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def draft(self, episode="naskh", audio_bytes=b"recording-one", **topic):
        path = ReleaseTest.draft(self, self.src, episode, audio_bytes=audio_bytes)
        timeline = json.loads(path.read_text(encoding="utf-8"))
        timeline.update(topic)
        path.write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return path

    def run_main(self, *args):
        return d.main([*args, "--into", str(self.dest), "--essays", str(self.essays)])

    def reflections(self):
        return json.loads(self.essay.read_text(encoding="utf-8"))["reflections"]

    def test_release_with_an_article_adds_the_reflection_with_the_timelines_title_and_caption(self):
        draft = self.draft(title="نسخ", caption="Naskh (abrogation)")
        self.assertEqual(self.run_main("--release", str(draft), "--article", "naskh", "--description", "A brief."), 0)
        self.assertEqual(self.reflections(), [{
            "title": "نسخ", "caption": "Naskh (abrogation)", "description": "A brief.",
            "url": "articles/nooreimaan/naskh.timeline.v1.json",
        }])
        text = self.essay.read_text(encoding="utf-8")
        self.assertTrue(text.startswith('{\n "slug": "naskh",\n "urduTitle": "نسخ"'))
        self.assertTrue(text.endswith("}\n"))

    def test_attaching_rewrites_the_static_pages_reflections_index_beside_the_essays_folder(self):
        index_path = self.essays.parent / "nooreimaan-reflections.json"
        self.assertFalse(index_path.exists())
        self.run_main("--release", str(self.draft(title="نسخ", caption="Naskh (abrogation)")), "--article", "naskh")
        self.assertEqual(json.loads(index_path.read_text(encoding="utf-8")), {"naskh": self.reflections()})
        self.assertEqual(list(json.loads(index_path.read_text(encoding="utf-8"))["naskh"][0]), ["title", "caption", "url"])

    def test_a_new_version_replaces_the_url_keeps_a_hand_edited_title_and_the_description(self):
        self.run_main("--release", str(self.draft(title="old title", caption="old caption")), "--article", "naskh", "--description", "Kept.")
        essay = json.loads(self.essay.read_text(encoding="utf-8"))
        essay["reflections"][0]["title"] = "edited by hand"
        self.essay.write_text(json.dumps(essay, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        self.run_main("--release", str(self.draft(audio_bytes=b"recording-two", title="new title", caption="new caption")), "--article", "naskh")
        self.assertEqual(self.reflections(), [{
            "title": "edited by hand", "caption": "new caption", "description": "Kept.",
            "url": "articles/nooreimaan/naskh.timeline.v2.json",
        }])

    def test_attach_adds_an_already_released_timeline_and_another_episode_is_appended(self):
        d.main(["--release", str(self.draft(title="one")), "--into", str(self.dest)])
        d.main(["--release", str(self.draft("naskh_talk", audio_bytes=b"talk", title="two")), "--into", str(self.dest)])
        self.assertEqual(self.reflections(), [])
        self.assertEqual(self.run_main("--attach", str(self.dest / "naskh.timeline.v1.json"), "--article", "naskh"), 0)
        self.assertEqual(self.run_main("--attach", str(self.dest / "naskh_talk.timeline.v1.json"), "--article", "naskh", "--title", "given"), 0)
        self.assertEqual([(r["title"], r["url"]) for r in self.reflections()], [
            ("one", "articles/nooreimaan/naskh.timeline.v1.json"),
            ("given", "articles/nooreimaan/naskh_talk.timeline.v1.json"),
        ])

    def test_attaching_an_older_version_than_the_one_attached_is_refused(self):
        self.run_main("--release", str(self.draft(title="t")), "--article", "naskh")
        self.run_main("--release", str(self.draft(audio_bytes=b"two", title="t")), "--article", "naskh")
        with self.assertRaises(SystemExit):
            self.run_main("--attach", str(self.dest / "naskh.timeline.v1.json"), "--article", "naskh")
        self.assertEqual([r["url"] for r in self.reflections()], ["articles/nooreimaan/naskh.timeline.v2.json"])

    def test_an_unknown_essay_a_timeline_outside_the_folder_and_a_missing_article_are_refused(self):
        d.main(["--release", str(self.draft(title="t")), "--into", str(self.dest)])
        with self.assertRaises(SystemExit):
            self.run_main("--attach", str(self.dest / "naskh.timeline.v1.json"), "--article", "nope")
        stray = self.src / "naskh.timeline.v1.json"
        stray.write_text((self.dest / "naskh.timeline.v1.json").read_text(encoding="utf-8"), encoding="utf-8")
        with self.assertRaises(SystemExit):
            self.run_main("--attach", str(stray), "--article", "naskh")
        with self.assertRaises(SystemExit):
            self.run_main("--attach", str(self.dest / "naskh.timeline.v1.json"))
        self.assertEqual(self.reflections(), [])

    def test_a_timeline_naming_a_recording_not_beside_it_is_not_attached(self):
        d.main(["--release", str(self.draft(title="t")), "--into", str(self.dest)])
        released = self.dest / "naskh.timeline.v1.json"
        timeline = json.loads(released.read_text(encoding="utf-8"))
        timeline["audio"] = "naskh.m4a"  # as mustanifa_brief.timeline.v1.json does
        released.write_text(json.dumps(timeline, ensure_ascii=False), encoding="utf-8")
        self.assertEqual(self.run_main("--attach", str(released), "--article", "naskh"), 1)
        self.assertEqual(self.reflections(), [])

    def test_a_reflection_needs_a_title(self):
        self.run_main("--release", str(self.draft()), "--into", str(self.dest))
        with self.assertRaises(SystemExit):
            self.run_main("--attach", str(self.dest / "naskh.timeline.v1.json"), "--article", "naskh")
        self.assertEqual(self.run_main("--attach", str(self.dest / "naskh.timeline.v1.json"), "--article", "naskh", "--title", "نسخ"), 0)

    def test_a_recording_released_outside_the_essays_folder_can_be_attached(self):
        elsewhere = self.dest.parents[1] / "talks"
        d.main(["--release", str(self.draft("sabr", title="صبر")), "--into", str(elsewhere)])
        self.assertEqual(self.reflections(), [])
        self.assertEqual(self.run_main("--attach", str(elsewhere / "sabr.timeline.v1.json"), "--article", "naskh"), 0)
        self.assertEqual([r["url"] for r in self.reflections()], ["talks/sabr.timeline.v1.json"])

    def test_a_folder_outside_podcasts_has_no_url(self):
        outside = Path(self.tmp.name) / "loose"
        d.main(["--release", str(self.draft(title="t")), "--into", str(outside)])
        with self.assertRaises(SystemExit):
            self.run_main("--attach", str(outside / "naskh.timeline.v1.json"), "--article", "naskh")

    def test_reflection_episode_reads_only_released_timeline_paths(self):
        self.assertEqual(d.reflection_episode("articles/nooreimaan/mustanifa_brief.timeline.v12.json"), ("articles/nooreimaan/mustanifa_brief", 12))
        self.assertEqual(d.reflection_episode("sabr.timeline.v1.json"), ("sabr", 1))
        for url in ("articles/nooreimaan/naskh.timeline.v0.json", "articles/nooreimaan/Naskh.timeline.v1.json",
                    "/articles/naskh.timeline.v1.json", "articles/nooreimaan/naskh.v1.m4a", "../naskh.timeline.v1.json",
                    "https://audio.ishqnama.com/podcasts/articles/nooreimaan/naskh.timeline.v1.json"):
            self.assertIsNone(d.reflection_episode(url), url)


class CheckTimelineTest(unittest.TestCase):
    def timeline(self, **overrides):
        base = {
            "version": d.TIMELINE_VERSION,
            "durationMs": 10000,
            "speakers": {"hamza": {}, "zoya": {}},
            "expressionsReviewed": True,
            "turns": [
                {"speaker": "zoya", "fromMs": 0, "toMs": 4000, "expression": "speaking", "text": ""},
                {"speaker": "hamza", "fromMs": 4500, "toMs": 9000, "expression": "thoughtful", "text": ""},
            ],
        }
        base.update(overrides)
        return base

    def test_sound_timeline_has_no_problems(self):
        self.assertEqual(d.check_timeline(self.timeline()), [])

    def test_unreviewed_expressions_are_a_problem(self):
        problems = d.check_timeline(self.timeline(expressionsReviewed=False))
        self.assertTrue(any("expressionsReviewed" in p for p in problems))

    def test_overlap_unknown_speaker_and_bad_expression_are_reported(self):
        turns = [
            {"speaker": "zoya", "fromMs": 0, "toMs": 5000, "expression": "speaking"},
            {"speaker": "ali", "fromMs": 4000, "toMs": 9000, "expression": "listening"},
        ]
        problems = d.check_timeline(self.timeline(turns=turns))
        self.assertEqual(len(problems), 3, problems)


HAS_MODELS = all(importlib.util.find_spec(m) for m in ("torch", "silero_vad", "speechbrain", "librosa", "av"))


@unittest.skipUnless(platform.system() == "Windows" and HAS_MODELS, "needs Windows voices and the podcast venv")
class EndToEndTest(unittest.TestCase):
    def test_one_voice_fixture_is_detected_and_named_by_pitch(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(
                ["powershell", "-NoProfile", "-File", str(HERE / "make_podcast_fixture.ps1"), "-OutDir", tmp,
                 "-MaleVoice", "Microsoft Zira Desktop"],
                check=True, capture_output=True,
            )
            # --name names the timeline; the recording beside it keeps its own name.
            out = Path(tmp) / "brief.timeline.json"
            self.assertEqual(d.main([str(Path(tmp) / "conversation.wav"), "--no-transcript", "--name", "brief"]), 0)
            timeline = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(timeline["audio"], "conversation.wav")
        self.assertEqual(timeline["voices"], 1)
        self.assertEqual(timeline["voiceDetection"], "auto")
        self.assertEqual(list(timeline["speakers"]), ["zoya"])
        self.assertTrue(all(t["speaker"] == "zoya" for t in timeline["turns"]))

    def test_fixture_turns_and_voices_are_recovered(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(
                ["powershell", "-NoProfile", "-File", str(HERE / "make_podcast_fixture.ps1"), "-OutDir", tmp],
                check=True, capture_output=True,
            )
            expected = json.loads((Path(tmp) / "conversation.expected.json").read_text(encoding="utf-8"))
            out = Path(tmp) / "conversation.timeline.json"
            code = d.main([str(Path(tmp) / "conversation.wav"), "--no-transcript", "--out", str(out)])
            self.assertEqual(code, 0)
            timeline = json.loads(out.read_text(encoding="utf-8"))

        self.assertEqual(timeline["pitchConfidence"], "high")
        self.assertEqual(timeline["voices"], 2)
        self.assertEqual(len(timeline["turns"]), len(expected["turns"]))
        voice_of = {"male": "hamza", "female": "zoya"}
        for got, want in zip(timeline["turns"], expected["turns"]):
            self.assertEqual(got["speaker"], voice_of[want["speaker"]])
            self.assertLess(abs(got["fromMs"] - want["fromMs"]), 400, (got, want))
            # Synthetic turns end with the voice's own trailing silence, so the
            # detected end may come earlier; it must never run late into the pause.
            self.assertLess(got["toMs"] - want["toMs"], 300, (got, want))
            self.assertGreater(got["toMs"], want["toMs"] - 1200, (got, want))


if __name__ == "__main__":
    unittest.main()
