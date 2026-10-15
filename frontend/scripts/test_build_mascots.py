"""Tests for build_mascots.py: cutting the expression sheets and keying out the wash."""

import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import build_mascots as b  # noqa: E402

WASH = (249, 240, 201)


def sheet(size=64, wash=WASH):
    """A 2x2 sheet on the wash: each quadrant holds a disc of its own colour."""
    img = Image.new("RGB", (size, size), wash)
    px = img.load()
    half = size // 2
    colours = {(0, 0): (10, 20, 30), (1, 0): (40, 50, 60), (0, 1): (70, 80, 90), (1, 1): (100, 110, 120)}
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


class KeyOutTest(unittest.TestCase):
    def test_wash_becomes_transparent_and_the_figure_stays_opaque(self):
        img, _ = sheet()
        keyed = b.key_out(img, b.corner_colour(img))
        self.assertEqual(keyed.mode, "RGBA")
        self.assertEqual(keyed.getpixel((0, 0))[3], 0)
        self.assertEqual(keyed.getpixel((16, 16))[3], 255)

    def test_a_slightly_off_wash_pixel_is_still_keyed(self):
        img, _ = sheet()
        img.putpixel((1, 1), (246, 238, 205))
        keyed = b.key_out(img, b.corner_colour(img))
        self.assertEqual(keyed.getpixel((1, 1))[3], 0)

    def test_corner_colour_is_sampled_from_the_sheet(self):
        img, _ = sheet(wash=(250, 243, 208))
        self.assertEqual(b.corner_colour(img), (250, 243, 208))


class BuildTest(unittest.TestCase):
    def test_writes_four_transparent_webps_per_mascot(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "characters", Path(tmp) / "out"
            for name in ("Hamza", "Zoya"):
                (src / name).mkdir(parents=True)
                sheet()[0].save(src / name / f"{name}.expressions.jpg", quality=95)
            written = b.build(src, out, size=32)
            self.assertEqual(len(written), 8)
            for name in ("hamza", "zoya"):
                for expression in b.EXPRESSIONS:
                    path = out / name / f"{expression}.webp"
                    self.assertTrue(path.exists(), path)
                    with Image.open(path) as img:
                        self.assertEqual(img.size, (32, 32))
                        self.assertEqual(img.mode, "RGBA")


if __name__ == "__main__":
    unittest.main()
