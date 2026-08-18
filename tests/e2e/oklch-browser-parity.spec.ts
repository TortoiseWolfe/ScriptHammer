/**
 * The Node-side `oklch()` conversion must agree with a real browser (#422).
 *
 * WHY THIS SPEC IS THE POINT. #422 wants per-theme AA/AAA badges on `/themes`, and it
 * refused to ship them from anything unmeasured: *"A badge reading 'AAA ✓' beside a theme
 * nobody measured at AAA is the #287 failure mode — the label asserts a guarantee the
 * repo cannot back."*
 *
 * Computing the verdicts in Node moves that risk rather than removing it. If
 * `scripts/theme-contrast/oklch.mjs` is subtly wrong, every badge is confidently wrong,
 * and nothing about a rendered badge would say so. This is the assertion that closes
 * that hole: the same `oklch()` strings, converted by us and painted by Chromium, must
 * land on the same sRGB bytes.
 *
 * WHY CANVAS AND NOT `getComputedStyle`. `getComputedStyle().color` returns `oklch()`
 * **unparsed** for these values, and reading that as RGB silently yields ratios of 1.00.
 * That mistake is recorded in CLAUDE.md and in `color-contrast.spec.ts`; the canvas is
 * what forces the browser to actually resolve the colour to bytes.
 *
 * This needs no app: `setContent` on a blank page is enough, so it costs no build and
 * cannot fail for a reason unrelated to colour.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { oklchToHex } from '../../scripts/theme-contrast/oklch.mjs';

/**
 * Every distinct `oklch()` value DaisyUI ships, plus the two house themes.
 *
 * Sampling a handful would let a systematic error hide in the region nobody sampled —
 * hue-dependent error in particular. So the parity check covers the real population.
 */
function everyThemeColor(): string[] {
  const sources = [
    join(process.cwd(), 'node_modules/daisyui/themes.css'),
    join(process.cwd(), 'src/app/globals.css'),
  ];
  const found = new Set<string>();
  for (const file of sources) {
    let css = '';
    try {
      css = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of css.matchAll(/oklch\(\s*[\d.]+%\s+[\d.]+\s+[\d.]+\s*\)/g)) {
      found.add(m[0].replace(/\s+/g, ' '));
    }
  }
  return [...found].sort();
}

test.describe('oklch conversion matches the browser (#422)', () => {
  test('every theme colour converts to the same bytes Chromium paints', async ({
    page,
  }) => {
    const colors = everyThemeColor();

    // COVERAGE FLOOR. If the CSS moves or the regex stops matching, this spec would
    // pass having compared nothing — the #396 shape, and the failure this whole issue
    // is about. 34 themes x ~14 tokens means hundreds; 100 is a floor, not a target.
    expect(
      colors.length,
      `only ${colors.length} oklch values found in daisyui/themes.css + globals.css — ` +
        `the parse is probably broken, not the themes`
    ).toBeGreaterThan(100);

    await page.setContent('<div id="probe">x</div>');

    // Paint each colour and read the bytes back, in one round trip.
    const painted: string[] = await page.evaluate((values) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const probe = document.getElementById('probe')!;
      const hex = (n: number) => n.toString(16).padStart(2, '0');

      return values.map((value) => {
        // Let the browser resolve oklch() -> its own colour space, then force it
        // through a paint so we read real bytes rather than the unparsed string.
        probe.setAttribute('style', `color: ${value}`);
        const resolved = getComputedStyle(probe).color;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = resolved;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `#${hex(r)}${hex(g)}${hex(b)}`;
      });
    }, colors);

    // TOLERANCE OF 1 PER CHANNEL. Chromium and this implementation round the final
    // gamma-encoded channel independently; a 1/255 disagreement is rounding, not a
    // different colour. Anything larger is a real divergence in the transform and must
    // fail, because it would move a contrast ratio.
    const mismatches: string[] = [];
    colors.forEach((value, i) => {
      const ours = oklchToHex(value);
      const theirs = painted[i];
      if (!ours) {
        mismatches.push(`${value}: our converter returned null`);
        return;
      }
      const chan = (h: string) =>
        [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16));
      const a = chan(ours);
      const b = chan(theirs);
      const worst = Math.max(...a.map((v, k) => Math.abs(v - b[k])));
      if (worst > 1) {
        mismatches.push(
          `${value}: ours ${ours} vs browser ${theirs} (Δ${worst})`
        );
      }
    });

    expect(
      mismatches.slice(0, 12),
      `${mismatches.length} of ${colors.length} colours disagree with the browser by ` +
        `more than 1/255. The Node conversion is wrong, and every per-theme badge ` +
        `rendered from it would be confidently wrong (#422, #287).`
    ).toEqual([]);
  });
});
