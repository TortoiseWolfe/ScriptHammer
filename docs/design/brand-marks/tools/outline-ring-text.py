"""Bake SVG text-on-a-path into plain <path> geometry.

Inkscape 1.2.2 converts the letterforms but throws away the textPath placement,
so the glyphs land at their own local origin. This does it properly by using
two sources that each know one half of the problem:

  * Chromium already laid the text out along the arc, honouring textLength and
    lengthAdjust="spacingAndGlyphs". layout.json is its answer: the on-path
    position and tangent angle for every character.
  * fontTools has the actual glyph outlines.

Per glyph: translate to Chromium's position, rotate to Chromium's tangent,
then scale from font units to user units — flipping Y, because font space is
Y-up and SVG is Y-down. The horizontal scale carries the extra `k` factor that
lengthAdjust="spacingAndGlyphs" applies to the glyph shapes themselves.
"""

import json
import re
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT_SIZE = 38.0
TEXT_LENGTH = 300.0
TEXT = "SCRIPTHAMMER.COM"

font = TTFont("/f/Oswald-Bold.ttf")
upem = font["head"].unitsPerEm
glyphset = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]

# lengthAdjust="spacingAndGlyphs" scales spacing AND glyph shapes by the same
# factor. Chromium's positions already include it; the shapes still need it.
natural = sum(hmtx[cmap[ord(c)]][0] for c in TEXT) * FONT_SIZE / upem
k = TEXT_LENGTH / natural
print(f"  natural advance = {natural:.2f}u -> k = {k:.5f} (target {TEXT_LENGTH})")

scale = FONT_SIZE / upem
layout = json.load(open("layout.json"))


def glyph_path(ch):
    pen = SVGPathPen(glyphset)
    glyphset[cmap[ord(ch)]].draw(pen)
    return pen.getCommands()


groups = []
total = 0
for run in layout:
    parts = []
    for c in run["chars"]:
        d = glyph_path(c["ch"])
        if not d:
            continue  # space and friends have no contours
        xform = (
            f'translate({c["x"]:.4f} {c["y"]:.4f}) '
            f'rotate({c["rot"]:.4f}) '
            f"scale({k * scale:.6f} {-scale:.6f})"
        )
        parts.append(f'<path transform="{xform}" d="{d}"/>')
        total += 1
    groups.append('      <g fill="#000">\n        ' + "\n        ".join(parts) + "\n      </g>")

src = open("source.svg", encoding="utf-8").read()

# The diamond separators are READ FROM THE SOURCE, never hardcoded here. They
# used to be literals, which meant that moving the ring (as the 2026-08 rebalance
# did, r125 -> r144.5) silently re-emitted the OLD diamonds into the new mark —
# a wrong output with no error. Anything positional in this file must come from
# the source it is deriving.
src_mask = re.search(r'<mask id="cut-word">(.*?)</mask>', src, re.S).group(1)
diamonds = re.findall(r'<path fill="#000" d="[^"]+"\s*/?>(?:</path>)?', src_mask)
assert len(diamonds) == 2, f"expected 2 diamond separators in the source mask, found {len(diamonds)}"

mask_body = (
    '      <rect width="400" height="400" fill="#fff"/>\n'
    + "\n".join(groups)
    + "\n"
    + "\n".join("      " + d for d in diamonds)
)
out = re.sub(
    r'(<mask id="cut-word">).*?(</mask>)',
    lambda m: m.group(1) + "\n" + mask_body + "\n    " + m.group(2),
    src,
    flags=re.S,
)
assert out != src, "ANCHOR MISS: cut-word mask was not replaced"
out = re.sub(r'\s*<path id="ring-(top|bot)"[^>]*></path>', "", out)
assert "<text" not in out, "live text survived"
assert "ring-top" not in out and "ring-bot" not in out, "unused ring guides survived"

open("lockup-glyphs.svg", "w", encoding="utf-8").write(out)
print(f"  wrote lockup-glyphs.svg: {len(out)} bytes, {total} glyph paths")
