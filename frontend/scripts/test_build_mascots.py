"""Tests for build_mascots.py: cutting the transparent expression sheets into quadrants."""

import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import build_mascots as b  # noqa: E402


def sheet(size=64):
    """A transparent 2x2 sheet: each quadrant holds an opaque disc of its own colour."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    half = size // 2
    colours = {(0, 0): (10, 20, 30, 255), (1, 0): (40, 50, 60, 255), (0, 1): (70, 80, 90, 255), (1, 1): (100, 110, 120, 255)}
    for (qx, qy), colour in colours.items():
        cx, cy = qx * half + half // 2, qy * half + half // 2
        for x in range(size):
            for y in range(size):
                if (x - cx) ** 2 + (y - cy) ** 2 <= (half // 4) ** 2:
                    px[x, y] = colour
    return img, colours


class QuadrantsTest(unittest.TestCase):
    def test_sheet_splits_into_the_four_named_expressions_in_reading_order(self):
        img, colours = sheet()
        cut = b.quadrants(img)
        self.assertEqual(list(cut), ["listening", "speaking", "laughing", "thoughtful"])
        self.assertEqual(cut["listening"].getpixel((16, 16)), colours[(0, 0)])
        self.assertEqual(cut["speaking"].getpixel((16, 16)), colours[(1, 0)])
        self.assertEqual(cut["laughing"].getpixel((16, 16)), colours[(0, 1)])
        self.assertEqual(cut["thoughtful"].getpixel((16, 16)), colours[(1, 1)])
        self.assertEqual(cut["listening"].size, (32, 32))

    def test_pixels_are_copied_as_they_are_including_their_transparency(self):
        img, _ = sheet()
        cut = b.quadrants(img)
        self.assertEqual(cut["listening"].mode, "RGBA")
        self.assertEqual(cut["listening"].getpixel((0, 0))[3], 0)
        self.assertEqual(cut["listening"].getpixel((16, 16))[3], 255)


class BuildTest(unittest.TestCase):
    def test_cuts_each_mascots_png_sheet_into_four_transparent_webps(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "characters", Path(tmp) / "out"
            for name in ("Hamza", "Zoya"):
                (src / name).mkdir(parents=True)
                sheet()[0].save(src / name / f"{name}.expressions.png")
            written = b.build(src, out)
            self.assertEqual(len(written), 8)
            for name in ("hamza", "zoya"):
                for expression in b.EXPRESSIONS:
                    path = out / name / f"{expression}.webp"
                    self.assertTrue(path.exists(), path)
                    with Image.open(path) as img:
                        self.assertEqual(img.size, (32, 32))
                        self.assertEqual(img.mode, "RGBA")
                        self.assertEqual(img.getpixel((0, 0))[3], 0)
                        self.assertEqual(img.getpixel((16, 16))[3], 255)

    def test_a_folder_with_only_a_jpg_sheet_is_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "characters", Path(tmp) / "out"
            (src / "Hamza").mkdir(parents=True)
            sheet()[0].convert("RGB").save(src / "Hamza" / "Hamza.expressions.jpg")
            self.assertEqual(b.build(src, out), [])


if __name__ == "__main__":
    unittest.main()
