/**
 * Tailwind class names must be complete literals in source (#455).
 *
 * ## The defect
 * Tailwind scans source files for class LITERALS. A template expression is never
 * one, so a class assembled at runtime is only present in the compiled CSS if
 * some *other* file happens to contain the same literal.
 *
 * Nine sites did this. `PaymentStatusDisplay.tsx` built
 * `text-${config.badge.split('-')[1]}`, and `/blog/seo` plus `BlogPostCard`
 * interpolated `seoAnalyzer.getScoreColor()`'s bare word into `text-${…}` and
 * `badge-${…}`. Measured, the classes survived on coincidence:
 *
 *     text-error    27 other files
 *     text-warning  20
 *     text-success  17
 *     text-info      2   <-- one status colour hanging on two unrelated files
 *
 * Nothing failed. It compiles, it usually looks right, and no test asserts a
 * computed colour on those elements — so the failure is silent and partial:
 * three of four states render, one does not.
 *
 * ## Why a source test rather than a rendered assertion
 * A jsdom test cannot see the compiled CSS, and asserting the element HAS the
 * class proves nothing — the class string is applied either way. That is the
 * exact mistake `AdminStatCard.test.tsx` made with `hover:shadow-md` (#430):
 * green while the style had no rendered effect.
 *
 * The checkable property is in the source: no `className` may interpolate into a
 * Tailwind class prefix.
 *
 * @module tests/unit/tailwind-literal-classes.test
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN = ['src'];

/**
 * Prefixes where a fragment produces a real Tailwind class. Deliberately narrow
 * — `${x} ` interpolating a WHOLE class is fine and is the fix, so only a
 * prefix immediately followed by `${` is a defect.
 */
const PREFIXES = [
  'text-',
  'bg-',
  'border-',
  'badge-',
  'btn-',
  'ring-',
  'from-',
  'to-',
  'via-',
  'fill-',
  'stroke-',
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      out.push(...sourceFiles(full));
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.(test|spec|stories)\./.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Every `prefix-${` occurrence, with its line number. */
function offences(file: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Skip comments. Prose DESCRIBING this defect (including in this repo's own
    // explanatory comments) is not an instance of it — flagging it would train
    // people to stop writing the explanation.
    const code = line.trim();
    if (
      code.startsWith('//') ||
      code.startsWith('*') ||
      code.startsWith('/*')
    ) {
      return;
    }
    for (const p of PREFIXES) {
      if (line.includes(`${p}\${`)) {
        found.push({ line: i + 1, text: line.trim().slice(0, 120) });
        break;
      }
    }
  });
  return found;
}

describe('Tailwind classes are complete literals in source (#455)', () => {
  const files = SCAN.flatMap((d) => sourceFiles(join(ROOT, d)));

  it('finds source files to scan', () => {
    // A sweep that silently scans nothing reads as a pass — the #411/#454 shape.
    expect(files.length).toBeGreaterThan(100);
  });

  it('no className interpolates into a Tailwind class prefix', () => {
    const hits = files.flatMap((f) =>
      offences(f).map((o) => `${relative(ROOT, f)}:${o.line}  ${o.text}`)
    );
    expect(
      hits,
      `A class built from a fragment is invisible to Tailwind and only renders if\n` +
        `another file happens to use the same literal. Return a COMPLETE class\n` +
        `name instead (see seoAnalyzer.getScoreTextClass / getScoreBadgeClass).\n\n` +
        hits.join('\n')
    ).toEqual([]);
  });
});
