"""Cut the mascots' expression sheets into the images the site serves.

Each mascot's `<Name>.expressions.png` in design/podcast/characters/<Name>/ is a 2x2 sheet of
the same portrait in four states on a transparent background, in reading order: listening,
speaking, laughing, thoughtful. This cuts the four quadrants, pixel for pixel, and writes
public/images/mascots/<name>/<expression>.webp with the transparency kept (the site fills the
disc with its own gold-wash token, which changes in dark mode). A 1024 px sheet gives
512 px images.

    npm run mascots:build

Needs Pillow. Tests: python -m unittest scripts/test_build_mascots.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

EXPRESSIONS = ("listening", "speaking", "laughing", "thoughtful")

HERE = Path(__file__).resolve().parent
DEFAULT_SOURCE = HERE.parent / "design" / "podcast" / "characters"
DEFAULT_OUT = HERE.parent / "public" / "images" / "mascots"


def quadrants(sheet: Image.Image) -> dict[str, Image.Image]:
    """The four expressions, cut from the sheet in reading order, pixels untouched."""
    rgba = sheet.convert("RGBA")
    width, height = rgba.size
    half_w, half_h = width // 2, height // 2
    boxes = [(0, 0), (half_w, 0), (0, half_h), (half_w, half_h)]
    return {
        name: rgba.crop((x, y, x + half_w, y + half_h))
        for name, (x, y) in zip(EXPRESSIONS, boxes)
    }


def build(source: Path, out: Path) -> list[Path]:
    """Write every mascot's four expressions; returns the files written."""
    written = []
    for folder in sorted(p for p in source.iterdir() if p.is_dir()):
        sheet_path = folder / f"{folder.name}.expressions.png"
        if not sheet_path.exists():
            continue
        with Image.open(sheet_path) as sheet:
            target = out / folder.name.lower()
            target.mkdir(parents=True, exist_ok=True)
            for expression, image in quadrants(sheet).items():
                path = target / f"{expression}.webp"
                image.save(path, "WEBP", quality=90, method=6)
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
