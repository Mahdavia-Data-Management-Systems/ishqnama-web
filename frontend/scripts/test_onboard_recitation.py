"""Tests for onboard_recitation.py. Standard library only:

    python -m unittest scripts/test_onboard_recitation.py
"""

import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import onboard_recitation as o  # noqa: E402


def fixture_segments():
    """A tiny export in the package's shape: chapter 1 as Tarteel ships it, chapter 2 with
    two verses, chapter 9 with one. Verse counts for the fixture are passed in so the tests
    do not need the full Quran."""
    return {
        "1:1": {"timestamp_from": 0, "timestamp_to": 4451, "segments": [[1, 0, 1110], [2, 1160, 1750], [3, 1800, 2750], [4, 2800, 4451]]},
        "1:2": {"timestamp_from": 4651, "timestamp_to": 9628, "segments": [[1, 5680, 9628]]},
        "1:3": {"timestamp_from": 9828, "timestamp_to": 13901, "segments": [[1, 10920, 13901]]},
        "1:4": {"timestamp_from": 14101, "timestamp_to": 18159, "segments": [[1, 15280, 18159]]},
        "1:5": {"timestamp_from": 18359, "timestamp_to": 23822, "segments": [[1, 19320, 23822]]},
        "1:6": {"timestamp_from": 24022, "timestamp_to": 28999, "segments": [[1, 24960, 28999]]},
        "1:7": {
            "timestamp_from": 29199, "timestamp_to": 41784,
            "segments": [[1, 30480, 31430], [2, 31480, 31950], [3, 32000, 32870], [4, 32920, 33710],
                         [5, 33760, 34350], [6, 34400, 35350], [7, 35400, 36310], [8, 36360, 39356], [9, 39356, 41784]],
        },
        "2:1": {"timestamp_from": 0, "timestamp_to": 6631, "segments": [[1, 0, 6631]]},
        "2:2": {"timestamp_from": 6831, "timestamp_to": 14964, "segments": [[1, 6900, 14964]]},
        "9:1": {"timestamp_from": 0, "timestamp_to": 13260, "segments": [[1, 0, 13260]]},
    }


FIXTURE_COUNTS = {1: 7, 2: 2, 9: 1}
CDN = "https://audio-cdn.tarteel.ai/quran/surah/abdulBasit/murattal/mp3"


def fixture_surahs(chapters=(1, 2, 9), cdn=CDN):
    return {str(c): {"surah_number": c, "audio_url": f"{cdn}/{c:03d}.mp3", "duration": 1} for c in chapters}


class BuildTimingsTest(unittest.TestCase):
    def test_remaps_al_fatiha(self):
        out = o.build_timings(fixture_segments(), FIXTURE_COUNTS)
        self.assertEqual(out["basmala"], [0, 4451])
        self.assertEqual(out["chapters"][0], [
            [1, 4651, 9628], [2, 9828, 13901], [3, 14101, 18159], [4, 18359, 23822], [5, 24022, 28999],
            [6, 30480, 33710], [7, 33760, 41784],
        ])

    def test_copies_other_chapters_keyed_by_chapter_index(self):
        out = o.build_timings(fixture_segments(), FIXTURE_COUNTS)
        self.assertEqual(out["chapters"][1], [[1, 0, 6631], [2, 6831, 14964]])
        self.assertEqual(out["chapters"][8], [[1, 0, 13260]])
        self.assertEqual(len(out["chapters"]), 9)

    def test_fails_when_1_7_lacks_nine_word_segments(self):
        segments = fixture_segments()
        segments["1:7"]["segments"] = segments["1:7"]["segments"][:8]
        with self.assertRaisesRegex(o.OnboardingError, r"1:7 .*9 word segments"):
            o.build_timings(segments, FIXTURE_COUNTS)

    def test_fails_when_a_chapter_verse_count_differs(self):
        segments = fixture_segments()
        del segments["2:2"]
        with self.assertRaisesRegex(o.OnboardingError, r"chapter 2: expected 2 verses, found 1"):
            o.build_timings(segments, FIXTURE_COUNTS)

    def test_fails_on_a_verse_whose_from_is_not_before_its_to(self):
        segments = fixture_segments()
        segments["2:2"]["timestamp_to"] = segments["2:2"]["timestamp_from"]
        with self.assertRaisesRegex(o.OnboardingError, r"2:2: from 6831 is not before to 6831"):
            o.build_timings(segments, FIXTURE_COUNTS)

    def test_reports_overlaps_largest_first_without_failing(self):
        segments = fixture_segments()
        segments["2:2"]["timestamp_from"] = 6000  # 631 ms before 2:1 ends
        segments["1:3"]["timestamp_from"] = 9500  # 128 ms before 1:2 ends; Tarteel 1:3 is our 1:2
        out = o.build_timings(segments, FIXTURE_COUNTS)
        self.assertEqual(out["overlaps"], [(631, 2, 2), (128, 1, 2)])

    def test_ships_the_real_verse_counts_for_all_114_chapters(self):
        self.assertEqual(len(o.CHAPTER_VERSE_COUNTS), 114)
        self.assertEqual(o.CHAPTER_VERSE_COUNTS[1], 7)
        self.assertEqual(o.CHAPTER_VERSE_COUNTS[2], 286)
        self.assertEqual(o.CHAPTER_VERSE_COUNTS[114], 6)
        self.assertEqual(sum(o.CHAPTER_VERSE_COUNTS.values()), 6236)


class AudioUrlsTest(unittest.TestCase):
    def test_lists_the_urls_in_chapter_order(self):
        surahs = fixture_surahs()
        surahs = {k: surahs[k] for k in ["9", "1", "2"]}  # dict order must not matter
        self.assertEqual(o.audio_urls(surahs, FIXTURE_COUNTS), [f"{CDN}/001.mp3", f"{CDN}/002.mp3", f"{CDN}/009.mp3"])

    def test_fails_when_a_chapter_is_missing(self):
        surahs = fixture_surahs(chapters=(1, 2))
        with self.assertRaisesRegex(o.OnboardingError, r"surah.json: no audio_url for chapter 9"):
            o.audio_urls(surahs, FIXTURE_COUNTS)

    def test_fails_when_a_url_is_not_named_after_its_chapter(self):
        surahs = fixture_surahs()
        surahs["2"]["audio_url"] = f"{CDN}/al-baqarah.mp3"
        with self.assertRaisesRegex(o.OnboardingError, r"chapter 2: .*al-baqarah.mp3.* must end in /002.mp3"):
            o.audio_urls(surahs, FIXTURE_COUNTS)

    def test_fails_on_a_non_https_url(self):
        surahs = fixture_surahs(cdn="http://audio-cdn.tarteel.ai/x")
        with self.assertRaisesRegex(o.OnboardingError, r"chapter 1: .* is not an https URL"):
            o.audio_urls(surahs, FIXTURE_COUNTS)


class VersionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def release(self, version, urls):
        folder = self.root / "abdul-basit-murattal" / f"v{version}"
        folder.mkdir(parents=True)
        (folder / o.MANIFEST_NAME).write_text(json.dumps(urls))

    def test_first_release_is_version_1(self):
        self.assertEqual(o.choose_version(self.root / "abdul-basit-murattal", ["a"]), (1, None))

    def test_identical_urls_keep_the_latest_version(self):
        self.release(1, ["a"])
        self.release(2, ["b"])
        self.assertEqual(o.choose_version(self.root / "abdul-basit-murattal", ["b"]), (2, 2))

    def test_changed_urls_take_the_next_version(self):
        self.release(1, ["a"])
        self.release(3, ["c"])
        self.assertEqual(o.choose_version(self.root / "abdul-basit-murattal", ["a"]), (4, 3))


class RenderTest(unittest.TestCase):
    def test_export_name_is_the_id_in_screaming_snake_case(self):
        self.assertEqual(o.export_name("abdul-basit-murattal"), "ABDUL_BASIT_MURATTAL")

    def test_rejects_an_id_that_is_not_a_slug(self):
        for bad in ["Abdul Basit", "abdul_basit", "-abdul", "abdul--basit", ""]:
            with self.assertRaises(o.OnboardingError):
                o.check_id(bad)

    def test_renders_the_timings_module(self):
        timings = o.build_timings(fixture_segments(), FIXTURE_COUNTS)
        text = o.render_timings("abdul-basit-murattal", 2, timings)
        self.assertIn('import type { RecitationTimings } from "@/lib/recitation-playlist";', text)
        self.assertIn("export const ABDUL_BASIT_MURATTAL: RecitationTimings = {", text)
        self.assertIn('  id: "abdul-basit-murattal",\n  version: 2,\n  basmala: [0, 4451],\n  chapters: [\n', text)
        self.assertIn("    [[1,0,6631],[2,6831,14964]],\n", text)
        self.assertIn("    [],\n", text)  # chapters 3-8 have no rows in the fixture
        self.assertTrue(text.endswith("  ],\n};\n"))


class OnboardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.audio_root = root / "audio" / "recitations"
        self.data_dir = root / "frontend" / "src" / "data" / "recitations"
        self.work_root = root / ".ishqnama" / "audio" / "tarteel"
        self.zip = root / "surah-recitation-test.zip"
        self.write_zip(self.zip, fixture_surahs(), fixture_segments())

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def write_zip(path, surahs, segments, folder=""):
        with zipfile.ZipFile(path, "w") as z:
            z.writestr(f"{folder}surah.json", json.dumps(surahs))
            z.writestr(f"{folder}segments.json", json.dumps(segments))

    def onboard(self, **kw):
        return o.onboard(self.zip, "abdul-basit-murattal", self.audio_root, self.data_dir, self.work_root, counts=FIXTURE_COUNTS, **kw)

    def test_writes_the_manifest_and_the_timings_module(self):
        report = self.onboard()
        manifest = self.audio_root / "abdul-basit-murattal" / "v1" / ".tarteel.json"
        module = self.data_dir / "abdul-basit-murattal.ts"
        self.assertEqual(report["version"], 1)
        self.assertEqual(report["manifest"], manifest)
        self.assertEqual(report["module"], module)
        self.assertEqual(json.loads(manifest.read_text()), [f"{CDN}/001.mp3", f"{CDN}/002.mp3", f"{CDN}/009.mp3"])
        self.assertEqual(manifest.read_text(encoding="utf-8"), json.dumps(json.loads(manifest.read_text()), indent=2) + "\n")
        self.assertIn("  version: 1,", module.read_text(encoding="utf-8"))

    def test_unpacks_the_package_into_the_work_folder_named_after_it(self):
        self.onboard()
        unpacked = self.work_root / "surah-recitation-test"
        self.assertEqual(sorted(p.name for p in unpacked.iterdir()), ["segments.json", "surah.json"])

    def test_a_second_run_with_the_same_urls_keeps_version_1(self):
        self.onboard()
        report = self.onboard()
        self.assertEqual((report["version"], report["previous_version"]), (1, 1))
        self.assertFalse((self.audio_root / "abdul-basit-murattal" / "v2").exists())

    def test_new_urls_release_version_2_and_bump_the_module(self):
        self.onboard()
        self.write_zip(self.zip, fixture_surahs(cdn="https://cdn.example/new"), fixture_segments())
        report = self.onboard()
        self.assertEqual((report["version"], report["previous_version"]), (2, 1))
        self.assertTrue((self.audio_root / "abdul-basit-murattal" / "v1" / ".tarteel.json").exists())
        self.assertTrue((self.audio_root / "abdul-basit-murattal" / "v2" / ".tarteel.json").exists())
        self.assertIn("  version: 2,", (self.data_dir / "abdul-basit-murattal.ts").read_text(encoding="utf-8"))

    def test_finds_the_json_files_inside_a_folder_in_the_zip(self):
        self.write_zip(self.zip, fixture_surahs(), fixture_segments(), folder="export/")
        self.assertEqual(self.onboard()["version"], 1)

    def test_fails_before_writing_anything_when_the_export_is_bad(self):
        segments = fixture_segments()
        del segments["2:2"]
        self.write_zip(self.zip, fixture_surahs(), segments)
        with self.assertRaisesRegex(o.OnboardingError, r"chapter 2"):
            self.onboard()
        self.assertFalse(self.audio_root.exists())
        self.assertFalse(self.data_dir.exists())

    def test_fails_when_the_zip_lacks_a_file(self):
        with zipfile.ZipFile(self.zip, "w") as z:
            z.writestr("surah.json", json.dumps(fixture_surahs()))
        with self.assertRaisesRegex(o.OnboardingError, r"no segments.json"):
            self.onboard()


if __name__ == "__main__":
    unittest.main()
