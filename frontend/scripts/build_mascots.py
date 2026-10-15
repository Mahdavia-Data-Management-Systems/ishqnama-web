"""Cut the mascots' expression sheets into the images the site serves.

Each mascot's `<Name>.expressions.jpg` in design/podcast/characters/<Name>/ is a 2x2 sheet of
the same portrait in four states, in reading order: listening, speaking, laughing,
thoughtful. This cuts the four quadrants, keys the flat gold wash Gemini painted behind them
to transparent (the site fills the disc with its own gold-wash token, which changes in dark
mode) and writes public/images/mascots/<name>/<expression>.webp at 512 px.

    npm run mascots:build

Needs Pillow. Tests: python -m unittest scripts/test_build_mascots.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

EXPRESSIONS = ("listening", "speaking", "laughing", "thoughtful")
# Colour distance from the wash below which a pixel is fully transparent, and above which it
# is fully opaque; between them the alpha ramps, which softens the figure's outline.
KEY_INNER = 14
KEY_OUTER = 40
SIZE = 512

HERE = Path(__file__).resolve().parent
DEFAULT_SOURCE = HERE.parent / "design" / "podcast" / "characters"
DEFAULT_OUT = HERE.parent / "public" / "images" / "mascots"


def quadrants(sheet: Image.Image) -> dict[str, Image.Image]:
    """The four expressions, cut from the sheet in reading order."""
    width, height = sheet.size
    half_w, half_h = width // 2, height // 2
    boxes = [(0, 0), (half_w, 0), (0, half_h), (half_w, half_h)]
    return {
        name: sheet.crop((x, y, x + half_w, y + half_h))
        for name, (x, y) in zip(EXPRESSIONS, boxes)
    }


def corner_colour(image: Image.Image) -> tuple[int, int, int]:
    """The wash, sampled where nothing is ever drawn: the top-left pixel."""
    r, g, b = image.convert("RGB").getpixel((0, 0))[:3]
    return (r, g, b)


def key_out(image: Image.Image, wash: tuple[int, int, int]) -> Image.Image:
    """The image with the wash made transparent and a soft edge where the figure meets it."""
    rgb = image.convert("RGB")
    alpha = Image.new("L", rgb.size)
    source = rgb.load()
    target = alpha.load()
    wr, wg, wb = wash
    span = KEY_OUTER - KEY_INNER
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = source[x, y]
            distance = ((r - wr) ** 2 + (g - wg) ** 2 + (b - wb) ** 2) ** 0.5
            if distance <= KEY_INNER:
                target[x, y] = 0
            elif distance >= KEY_OUTER:
                target[x, y] = 255
            else:
                target[x, y] = int(255 * (distance - KEY_INNER) / span)
    keyed = rgb.convert("RGBA")
    keyed.putalpha(alpha)
    return keyed


def build(source: Path, out: Path, size: int = SIZE) -> list[Path]:
    """Write every mascot's four expressions; returns the files written."""
    written = []
    for folder in sorted(p for p in source.iterdir() if p.is_dir()):
        sheet_path = folder / f"{folder.name}.expressions.jpg"
        if not sheet_path.exists():
            continue
        with Image.open(sheet_path) as sheet:
            wash = corner_colour(sheet)
            target = out / folder.name.lower()
            target.mkdir(parents=True, exist_ok=True)
            for expression, image in quadrants(sheet).items():
                keyed = key_out(image, wash)
                if keyed.size != (size, size):
                    keyed = keyed.resize((size, size), Image.Resampling.LANCZOS)
                path = target / f"{expression}.webp"
                keyed.save(path, "WEBP", quality=90, method=6)
                written.append(path)
    return written


def main() -> int:
    written = build(DEFAULT_SOURCE, DEFAULT_OUT)
    for path in written:
        print(f"{path.relative_to(HERE.parent)}  {path.stat().st_size // 1024} KB")
    if not written:
        print(f"no expression sheets under {DEFAULT_SOURCE}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
