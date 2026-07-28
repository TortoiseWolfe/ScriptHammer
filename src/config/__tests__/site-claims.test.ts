import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { THEMES, THEME_COUNT } from '../themes';
import { countWireframes } from '../wireframes';

/**
 * The landing page states numbers about this project. Before #408 all four
 * were hard-coded string literals, and two had drifted: it advertised 46
 * wireframes where the manifest listed 66, and 32 themes where 34 were
 * registered. Nothing failed, because nothing was checking.
 *
 * Three of the four are now derived from the thing they describe, so they
 * cannot drift. This file guards the two joints that a type system cannot:
 * the CSS list TypeScript is unable to import, and the one claim with no
 * cheap source of truth.
 */
describe('landing-page claims', () => {
  it('THEMES matches the daisyUI themes registered in globals.css', () => {
    // globals.css is the only copy of this list TypeScript cannot import, so
    // it is the only way the two can silently disagree.
    const css = readFileSync(
      join(process.cwd(), 'src/app/globals.css'),
      'utf8'
    );
    const block = /themes:\s*([^;]+);/.exec(css);
    expect(block, 'no `themes:` block found in globals.css').not.toBeNull();

    const registered = block![1]
      .split(',')
      .map((t) => t.trim().split('--')[0].trim())
      .filter(Boolean);

    // Compared as sets so a reordering is not treated as a regression, but a
    // theme present in one place and missing from the other always is.
    expect(new Set(registered)).toEqual(new Set(THEMES));
    expect(THEME_COUNT).toBe(registered.length);
  });

  it('the wireframe count is read from the committed tree, excluding includes/', () => {
    const counted = countWireframes();
    expect(counted).toBeGreaterThan(0);

    // `includes/` holds shared chrome the viewer never lists as a wireframe.
    // Counting it would overstate the figure ~4x, and a recursive walk is the
    // easy way to write this wrong — so pin that the counter is not doing one.
    const everySvgUnderFeatures = (dir: string): number => {
      if (!existsSync(dir)) return 0;
      return readdirSync(dir, { withFileTypes: true }).reduce((n, entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) return n + everySvgUnderFeatures(full);
        return n + (entry.name.endsWith('.svg') ? 1 : 0);
      }, 0);
    };
    expect(counted).toBeLessThan(
      everySvgUnderFeatures(join(process.cwd(), 'features'))
    );

    // When the generated manifest is present (locally, after `prebuild`) the
    // committed count must equal what the viewer will actually render. It is
    // gitignored, so this cannot run in CI — which is exactly why the page
    // reads the committed tree rather than the manifest.
    const manifest = join(
      process.cwd(),
      'public/wireframes/wireframes-manifest.json'
    );
    if (existsSync(manifest)) {
      expect(counted).toBe(JSON.parse(readFileSync(manifest, 'utf8')).total);
    }
  });

  it('the "2,400+ tests" claim is still a floor and not a boast', () => {
    // This is the one number with no cheap source of truth: a *passing* count
    // needs a real run. So the page states a deliberately conservative floor
    // and this test keeps it true, rather than restating a figure that goes
    // stale in silence. At the time of writing the real count was ~4,795, so
    // there is a wide margin — if this ever fails, tests were deleted, and
    // the page is making a claim the repo no longer supports.
    const CLAIMED_FLOOR = 2400;
    const pattern = /^\s*(it|test)(\.\w+)?\(/gm;

    let found = 0;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(test|spec)\.tsx?$/.test(entry.name)) {
          found += (readFileSync(full, 'utf8').match(pattern) ?? []).length;
        }
      }
    };
    for (const root of ['src', 'tests']) {
      walk(join(process.cwd(), root));
    }

    expect(
      found,
      `The landing page claims ${CLAIMED_FLOOR}+ tests but only ${found} are declared.`
    ).toBeGreaterThanOrEqual(CLAIMED_FLOOR);
  });
});
