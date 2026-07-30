/**
 * `btn-outline` must not be paired with a fill-only colour modifier (#460).
 *
 * ## The defect
 * `btn-outline` inverts the colour role: the modifier's colour becomes the
 * FOREGROUND on the page background instead of a fill behind content. That is
 * fine for a colour picked as a foreground, and broken for one picked as a fill.
 *
 * `--color-neutral` on `scripthammer-dark` is `oklch(31.14% …)` against a
 * `--color-base-100` of `oklch(22.84% …)` — eight points of lightness apart.
 * Filled, it is fine: `btn-neutral` carries `--color-neutral-content` at 87%
 * lightness. Outlined, measured by canvas readback:
 *
 *     btn btn-neutral btn-outline    light  9.10:1    dark  1.34:1
 *     btn btn-outline                light 12.96:1    dark 13.84:1
 *
 * Eleven sites had the broken pairing, two of them the "Continue with Google"
 * and "Continue with GitHub" buttons on /sign-in and /sign-up. On the site's
 * default theme they were very nearly invisible.
 *
 * ## Why a source test
 * The AAA sweep cannot catch this. axe-core could not compute a ratio for these
 * nodes and returned a PASS with `contrastRatio: null` — "Element has
 * sufficient color contrast of null" — and `color-contrast.spec.ts` asserts on
 * `violations`. 20% of its passes across 8 routes were never measured. That
 * gate repair is #459; this guard is the narrow, cheap backstop that keeps the
 * specific pairing from returning in the meantime.
 *
 * Retuning the token is NOT the fix and must not be used to satisfy this test:
 * lightening `neutral` enough to be a legible foreground would break
 * `neutral-content` sitting on it.
 *
 * @module tests/unit/btn-outline-colour-role.test
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

/**
 * DaisyUI colour modifiers whose palette entry is a FILL — chosen to sit behind
 * `*-content` text. Using one as `btn-outline`'s foreground is the defect.
 *
 * `primary`, `secondary`, `accent`, `info`, `success`, `warning` and `error` are
 * deliberately absent: those are tuned in globals.css to clear AAA as
 * foregrounds on base-100 AND base-200, so the outline variant is legitimate.
 * `neutral` is not, and never was.
 */
const FILL_ONLY = ['neutral'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|spec)\./.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('btn-outline is not paired with a fill-only colour (#460)', () => {
  const files = sourceFiles(join(ROOT, 'src'));

  it('finds source files to scan', () => {
    // A sweep that silently scans nothing reads as a pass — the #411 shape.
    expect(files.length).toBeGreaterThan(100);
  });

  it('no className pairs btn-outline with a fill-only colour', () => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const code = line.trim();
        // Prose describing the defect is not an instance of it.
        if (
          code.startsWith('//') ||
          code.startsWith('*') ||
          code.startsWith('/*')
        ) {
          return;
        }
        if (!line.includes('btn-outline')) return;
        for (const c of FILL_ONLY) {
          if (line.includes(`btn-${c}`)) {
            hits.push(
              `${relative(ROOT, file)}:${i + 1}  ${code.slice(0, 110)}`
            );
            break;
          }
        }
      });
    }
    expect(
      hits,
      `btn-outline makes the colour modifier the FOREGROUND. A fill-only colour\n` +
        `there is illegible on dark themes (btn-neutral btn-outline measured\n` +
        `1.34:1 on scripthammer-dark). Drop the colour modifier — plain\n` +
        `btn-outline uses base-content and measures 13.84:1. See #460.\n\n` +
        hits.join('\n')
    ).toEqual([]);
  });
});
