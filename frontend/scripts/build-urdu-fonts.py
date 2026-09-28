# Shrinks the Nastaleeq fonts into the files the site serves.
# Sources: design/Jameel Noori Nastaleeq.ttf and its Kasheeda variant (about 13 MB each).
# Output: public/fonts/*.v1.woff2 (5.8 MB and 3.9 MB).
#
# Nastaleeq is drawn as ~25,000 whole-ligature glyphs, all reachable from Urdu text, so
# dropping characters saves almost nothing. The savings come from WOFF2 compression and
# from rescaling the em from 2048 to 1000 units, which rounds each outline point and
# advance by at most half a unit: under 0.02px at the reader's 19px minimum, and HarfBuzz
# picks the same glyphs for every verse. The fonts carry no hinting, so none is lost.
#
# Needs Python 3 with `pip install fonttools brotli`. Run from frontend/: npm run fonts:build
import os
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.scaleUpem import scale_upem

FONTS = {
    "design/Jameel Noori Nastaleeq.ttf": "public/fonts/JameelNooriNastaleeq.v1.woff2",
    "design/Jameel Noori Nastaleeq Kasheeda.ttf": "public/fonts/JameelNooriNastaleeqKasheeda.v1.woff2",
}
UNITS_PER_EM = 1000
BUDGET_BYTES = 6 * 1024 * 1024

options = subset.Options()
options.unicodes = "*"  # keep every character; Urdu lines also carry Latin digits and punctuation
options.layout_features = ["*"]  # the ligatures, joining forms and mark placement are the font
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.notdef_outline = True
options.hinting = False
options.glyph_names = False
options.flavor = "woff2"

for source, output in FONTS.items():
    font = TTFont(source)
    scale_upem(font, UNITS_PER_EM)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=font.getBestCmap().keys())
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(output)

    size = os.path.getsize(output)
    print(f"{output}: {os.path.getsize(source) / 1e6:.1f} MB -> {size / 1e6:.1f} MB")
    if size > BUDGET_BYTES:
        raise SystemExit(f"{output} is over the {BUDGET_BYTES / 1e6:.1f} MB budget")
