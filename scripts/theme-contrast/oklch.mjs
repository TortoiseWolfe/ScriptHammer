/**
 * `oklch()` → sRGB hex, in Node, for the per-theme contrast verdicts (#422).
 *
 * WHY THIS EXISTS RATHER THAN A DEPENDENCY. Every colour value DaisyUI ships is
 * `oklch()`, and nothing in this repo can read one outside a browser. The two existing
 * contrast specs solve that by compositing through a `<canvas>` — correct, but it needs
 * a running browser, and #422 wants a verdict a page can render at build time.
 *
 * WHY IT IS DANGEROUS, said plainly. A badge reading "AAA ✓" beside a theme nobody
 * measured is the #287 failure — a label asserting a guarantee the repo cannot back.
 * Colour maths that is subtly wrong produces exactly that: confident, wrong badges. So
 * this conversion is not trusted because it looks right. `oklch.browser-parity.spec.ts`
 * drives a real browser and asserts these numbers match what Chromium itself computes
 * for the same `oklch()` strings, via the same canvas readback the other specs use.
 *
 * The transform is the standard one (Björn Ottosson's OKLab), in four steps:
 *   oklch → OKLab (polar to cartesian)
 *   OKLab → LMS' (matrix), cubed → LMS
 *   LMS → linear sRGB (matrix)
 *   linear → gamma-encoded sRGB
 */

/**
 * Parse `oklch(21% .006 285.885)` into its three components.
 *
 * DaisyUI writes lightness as a percentage, chroma and hue as bare numbers, and uses
 * leading-dot floats (`.006`). Alpha is not used in any theme token and is rejected
 * rather than silently dropped — a token that grows an alpha channel changes what
 * "contrast against this surface" even means, and should fail loudly here.
 */
export function parseOklch(value) {
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(
    value.trim()
  );
  if (!m) return null;
  return { l: Number(m[1]) / 100, c: Number(m[2]), h: Number(m[3]) };
}

/** Gamma-encode one linear-sRGB channel (IEC 61966-2-1). */
function encode(channel) {
  const v =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

/**
 * `oklch()` → `#rrggbb`.
 *
 * Out-of-gamut colours are clamped per channel, which is what a browser does when it
 * paints one. That matters here: a clamped colour is what a visitor actually sees, so
 * the contrast verdict should be computed against the clamped value, not the ideal one.
 */
export function oklchToHex(value) {
  const parsed = typeof value === 'string' ? parseOklch(value) : value;
  if (!parsed) return null;
  const { l, c, h } = parsed;

  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab → LMS', then cube to LMS.
  const lp = l + 0.3963377774 * a + 0.2158037573 * b;
  const mp = l - 0.1055613458 * a - 0.0638541728 * b;
  const sp = l - 0.0894841775 * a - 1.291485548 * b;
  const L = lp * lp * lp;
  const M = mp * mp * mp;
  const S = sp * sp * sp;

  // LMS → linear sRGB.
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  const hex = (n) => n.toString(16).padStart(2, '0');
  return `#${hex(encode(r))}${hex(encode(g))}${hex(encode(bl))}`;
}
