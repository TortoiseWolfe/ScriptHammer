"""Derive the rebalanced brand sources from the pristine Claude Design exports.

The exports in docs/design/brand-marks/*.svg are byte-identical to the zip and
stay that way — they are the originals of record, and keeping them intact is
what lets anyone diff our composition against the designer's. This script is
the diff, expressed as code.

WHAT CHANGES, AND WHY

"ScriptHammer" is Script (the < > brackets) and Hammer (the mallet). The gear is
in neither, yet the export gives it 95% of the canvas with a 30%-thick band,
leaving the brackets at 41% and the mallet at 27%. The design comps already
disagree with the export: docs/design/2a/ScriptHammer-Directions.dc.html:98-100
sets the hero at brackets 0.505 and mallet 0.368 of the gear. This moves the
composition to that intent and a little past it.

  tooth tip radius   196 -> 188      tooth depth 41u -> 21u  (reads as a
  body/root radius   155 -> 167      knurled seal, not a cog)
  inner hole radius   96 -> 122      band 59u -> 45u
  brackets          .52 -> .68
  mallet            .28 -> .46
  ring wordmark    r108 -> r129.129, font-size 38 UNCHANGED

The band is widened rather than thinned because textLength="300" is fixed: the
squeeze k = textLength / natural_advance, and natural advance scales with
font-size. Drop to font-size 32 and k inverts to 1.077 — a 7.7% STRETCH on a
face that is already condensed. Holding font-size 38 keeps k at 0.90671, so
every scale() in the baked glyph table stays byte-identical and only the on-arc
positions move.

The clear-space halo is DELETED rather than retuned. Its stated job was keeping
the mallet legible against the gear teeth, but the rebalance puts the mallet's
max radius at 81.67 inside a hole of 122 — it never reaches them. All it still
did was carve a white channel through the brackets. A comic keyline separates
them properly instead: an outline, not an eraser.

Every substitution is asserted. A silent no-match here would ship a half-applied
rebalance that still renders.
"""

import math
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent
OUT = SRC / "rebalanced"

RING_R = 129.129
INK = "#2E353B"
KEYLINE = 5.0        # visible keyline weight on the 400u canvas
SILHOUETTE = 7.0     # heavier outer line; the gear is unscaled so this is literal
DIAMOND_R = 144.5  # band midpoint of 122..167


def sub_once(text, pattern, repl, what, flags=re.S):
    new, n = re.subn(pattern, repl, text, flags=flags)
    assert n == 1, f"ANCHOR MISS: {what} matched {n} times, expected 1"
    return new


def ring_guides():
    """Both halves sweep outward, as the export does. Half-span kept at 84deg."""

    a = math.radians(84)
    dx, dy = RING_R * math.sin(a), RING_R * math.cos(a)
    x0, x1 = 200 - dx, 200 + dx
    top, bot = 200 - dy, 200 + dy
    return (
        f'<path id="ring-top" fill="none" d="M{x0:.2f},{top:.2f} '
        f'A{RING_R:g},{RING_R:g} 0 0 1 {x1:.2f},{top:.2f}"></path>',
        f'<path id="ring-bot" fill="none" d="M{x1:.2f},{bot:.2f} '
        f'A{RING_R:g},{RING_R:g} 0 0 1 {x0:.2f},{bot:.2f}"></path>',
    )


def diamonds():
    """The two separators, on the ring at +/-DIAMOND_R from centre.

    DIAMOND_R is a RADIUS, not an x-coordinate. Getting that wrong put both
    diamonds near x=200 — inside the hole — and because they are mask geometry
    they punched holes through the brackets rather than sitting on the rim.
    The assertion below is the check that catches it.
    """
    r, h = DIAMOND_R, 9
    cxr, cxl = 200 + r, 200 - r
    assert abs(math.hypot(cxr - 200, 0) - r) < 1e-9, "right diamond off the ring"
    assert abs(math.hypot(cxl - 200, 0) - r) < 1e-9, "left diamond off the ring"
    right = f'<path fill="#000" d="M{cxr:g},191 L{cxr+h:g},200 L{cxr:g},209 L{cxr-h:g},200 Z"></path>'
    left = f'<path fill="#000" d="M{cxl:g},191 L{cxl+h:g},200 L{cxl:g},209 L{cxl-h:g},200 Z"></path>'
    return right, left


def apply(text, gear_d, is_lockup):
    text = sub_once(text, r'(id="gear-body"[^>]*?d=")[^"]+(")', lambda m: m.group(1) + gear_d + m.group(2), "gear-body d")

    top, bot = ring_guides()
    text = sub_once(text, r'<path id="ring-top"[^>]*></path>', lambda m: top, "ring-top")
    text = sub_once(text, r'<path id="ring-bot"[^>]*></path>', lambda m: bot, "ring-bot")

    right, left = diamonds()
    text = sub_once(text, r'<path fill="#000" d="M325,191[^"]*"></path>', lambda m: right, "right diamond")
    text = sub_once(text, r'<path fill="#000" d="M75,191[^"]*"></path>', lambda m: left, "left diamond")

    if is_lockup:
        text = sub_once(text, r'scale\(\.52\)', "scale(.68)", "brackets scale")
        # Two .28 sites: the cut-lockup halo and the mallet itself.
        text, n = re.subn(r'scale\(\.28\)', "scale(.46)", text)
        assert n == 2, f"ANCHOR MISS: expected 2 mallet-scale sites, found {n}"

        # The clear-space halo goes. Its stated job was keeping the mallet
        # readable against the gear TEETH, but after the rebalance the mallet's
        # max radius is 81.67 against a hole of 122 — it never reaches them. All
        # it did was carve a white channel through the brackets, and the keyline
        # below separates them properly instead. An outline, not an eraser.
        text = sub_once(text, r'\s*<mask id="cut-lockup">.*?</mask>', "", "halo mask", flags=re.S)
        text = sub_once(text, r'\s*mask="url\(#cut-lockup\)"', "", "halo reference")

        # Comic ink. Widths are pre-divided by the scale of the group each
        # symbol is instanced into, because stroke-width scales with the
        # transform — quoting KEYLINE verbatim in all three places would give
        # three different line weights on the canvas.
        text = sub_once(
            text, r'<g id="tags">',
            f'<g id="tags" stroke="{INK}" stroke-width="{KEYLINE/0.68:.4g}" stroke-linejoin="round">',
            "tags keyline")
        text = sub_once(
            text, r'(<g id="mallet">\s*\n\s*<g transform="rotate\(42 200 200\)")',
            # NOTE: append AFTER the transform's closing quote. Slicing it off
            # with [:-1] left transform="rotate(42 200 200) unterminated, which
            # produced invalid XML that only surfaced when sharp tried to
            # rasterise it three steps later.
            lambda m: m.group(1) + f' stroke="{INK}" stroke-width="{KEYLINE/0.46:.4g}" stroke-linejoin="round"',
            "mallet keyline", flags=re.S)
        text = sub_once(
            text, r'<use href="#gear-body" mask="url\(#cut-word\)" fill="#B6BEC6"></use>',
            f'<use href="#gear-body" mask="url(#cut-word)" fill="#B6BEC6" '
            f'stroke="{INK}" stroke-width="{SILHOUETTE}" stroke-linejoin="round"></use>',
            "gear keyline")
    else:
        text = sub_once(
            text, r'<use href="#gear-body" mask="url\(#cut-word\)" fill="#B6BEC6"></use>',
            f'<use href="#gear-body" mask="url(#cut-word)" fill="#B6BEC6" '
            f'stroke="{INK}" stroke-width="{SILHOUETTE}" stroke-linejoin="round"></use>',
            "gear keyline")

    return text


def main():
    import subprocess
    import sys

    # Reuse the generator rather than duplicating the geometry.
    proc = subprocess.run([sys.executable, str(HERE / "gear-path.py")], capture_output=True, text=True)
    assert proc.returncode == 0, f"gear-path.py failed its own regression test:\n{proc.stderr}"
    gear_d = proc.stdout.strip().splitlines()[-1].strip()
    assert gear_d.startswith("M") and "A167,167" in gear_d and "A122,122" in gear_d, "unexpected gear path"

    OUT.mkdir(exist_ok=True)
    for name, is_lockup in (("scripthammer-gear.svg", False), ("scripthammer-lockup.svg", True)):
        original = (SRC / name).read_text(encoding="utf-8")
        result = apply(original, gear_d, is_lockup)
        assert result != original, f"{name}: nothing changed"
        (OUT / name).write_text(result, encoding="utf-8")
        print(f"  wrote rebalanced/{name}  ({len(result)} bytes)")

    print(f"  ring guides at r={RING_R}, diamonds at r={DIAMOND_R}")


if __name__ == "__main__":
    main()
