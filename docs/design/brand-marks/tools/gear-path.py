"""Emit the ScriptHammer gear outline as a single evenodd <path> d attribute.

The gear in the Claude Design export is hand-authored, which is fine until you
need to change tooth depth — there is no knob, only 196 numbers. This rebuilds
the same topology parametrically.

REGRESSION TEST FIRST: run with the ORIGINAL parameters and the output must be
byte-identical to the committed path. That equality is the only real proof the
generator understands the shape, and it is asserted in main() before any new
geometry is emitted. If it ever stops matching, the generator is wrong, not the
art.

Geometry conventions, recovered from the committed path rather than assumed:
  * centre (200,200), 0 degrees at 12 o'clock, positive clockwise (SVG y-down)
  * tipR is the radius of the tooth CORNERS. The flat tip face sits closer in,
    at tipR*cos(tipHalf) - which is why the original reads 194.09 at 12 o'clock
    while the corner radius is 196.
  * rootR IS bodyR. The tooth roots sit on the body circle, which is why the
    inter-tooth arc is A<bodyR>,<bodyR> and there is no separate root radius.

Teeth are reparameterised by TANGENTIAL HALF-WIDTH, not half-angle. Holding the
angles while shrinking the radius splays the flanks (12.9 degrees off radial at
tipR=176) and the teeth stop reading as a seal and start reading as a ratchet.
Holding the widths keeps the flank at ~6 degrees and the taper at 0.922.

Usage:
    python3 gear-path.py            # regression test, then print the new path
"""

import math

CENTRE = (200.0, 200.0)

# The committed geometry, as recovered. Do not edit: this is the fixture.
ORIGINAL = dict(teeth=12, tipR=196.0, bodyR=155.0, holeR=96.0, tipHalf=8.0, rootHalf=11.0)

# Approved rebalance. Tooth depth 41u -> 21u, band 59u -> 45u, hole 96 -> 122.
# tipHalf/rootHalf are derived below so the tangential widths stay put.
REBALANCED = dict(teeth=12, tipR=188.0, bodyR=167.0, holeR=122.0)


def half_angle_for_width(radius, half_width):
    """The half-angle that puts a tooth corner `half_width` off the radial."""
    return math.degrees(math.asin(half_width / radius))


def fmt(v):
    """Match the source's authoring style: 1dp, with a bare integer when exact."""
    s = f"{round(v, 1):.1f}"
    return s[:-2] if s.endswith(".0") else s


def point(r, deg):
    a = math.radians(deg)
    return CENTRE[0] + r * math.sin(a), CENTRE[1] - r * math.cos(a)


def gear_path(teeth, tipR, bodyR, holeR, tipHalf, rootHalf, legacy_artifact=False):
    """One evenodd path: the toothed outer contour, then the hole punched out.

    `legacy_artifact` reproduces a quirk of the hand-authored source — every arc
    endpoint is repeated as a redundant `L`, on all teeth but the last. It is
    invisible when rendered. Keep it on for the regression comparison; leave it
    off for output.
    """
    pitch = 360.0 / teeth
    x, y = point(bodyR, -rootHalf)
    out = [f"M{fmt(x)},{fmt(y)}"]

    for i in range(teeth):
        t = i * pitch
        for r, a in ((tipR, t - tipHalf), (tipR, t + tipHalf), (bodyR, t + rootHalf)):
            px, py = point(r, a)
            out.append(f" L{fmt(px)},{fmt(py)}")
        nx, ny = point(bodyR, t + pitch - rootHalf)
        out.append(f" A{fmt(bodyR)},{fmt(bodyR)} 0 0 1 {fmt(nx)},{fmt(ny)}")
        if legacy_artifact and i < teeth - 1:
            out.append(f"L{fmt(nx)},{fmt(ny)}")

    out.append(" Z")
    cx, cy = CENTRE
    out.append(
        f" M{fmt(cx)},{fmt(cy - holeR)} A{fmt(holeR)},{fmt(holeR)} 0 1 1 {fmt(cx)},{fmt(cy + holeR)}"
        f" A{fmt(holeR)},{fmt(holeR)} 0 1 1 {fmt(cx)},{fmt(cy - holeR)} Z"
    )
    return "".join(out)


def main():
    import re
    import sys
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "scripthammer-gear.svg"
    committed = re.search(r'id="gear-body"[^>]*d="([^"]+)"', src.read_text(encoding="utf-8")).group(1)

    regenerated = gear_path(**ORIGINAL, legacy_artifact=True)
    if regenerated != committed:
        # Report the first divergence rather than dumping two 2KB strings.
        for i, (a, b) in enumerate(zip(regenerated, committed)):
            if a != b:
                print(f"REGRESSION FAILED at char {i}:", file=sys.stderr)
                print(f"  generated: ...{regenerated[max(0,i-40):i+40]}...", file=sys.stderr)
                print(f"  committed: ...{committed[max(0,i-40):i+40]}...", file=sys.stderr)
                break
        else:
            print(f"REGRESSION FAILED: length {len(regenerated)} vs {len(committed)}", file=sys.stderr)
        raise SystemExit(1)
    print(f"regression OK — reproduces the committed path exactly ({len(committed)} chars)")

    tip_w = ORIGINAL["tipR"] * math.sin(math.radians(ORIGINAL["tipHalf"]))
    root_w = ORIGINAL["bodyR"] * math.sin(math.radians(ORIGINAL["rootHalf"]))
    new = dict(
        REBALANCED,
        tipHalf=half_angle_for_width(REBALANCED["tipR"], tip_w),
        rootHalf=half_angle_for_width(REBALANCED["bodyR"], root_w),
    )
    print(f"  holding tangential widths: tip {tip_w:.3f}u, root {root_w:.3f}u")
    print(f"  new half-angles: tip {new['tipHalf']:.3f}deg, root {new['rootHalf']:.3f}deg")
    print(f"  tooth depth {ORIGINAL['tipR'] - ORIGINAL['bodyR']:.0f}u -> {new['tipR'] - new['bodyR']:.0f}u")
    print(f"  ring band   {ORIGINAL['bodyR'] - ORIGINAL['holeR']:.0f}u -> {new['bodyR'] - new['holeR']:.0f}u")
    print()
    print(gear_path(**new))


if __name__ == "__main__":
    main()
