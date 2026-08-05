import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  THEMES,
  THEME_COUNT,
  HOUSE_THEME_COUNT,
  DAISYUI_THEME_COUNT,
} from '../themes';
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

  it('prose surfaces do not state a theme count that disagrees with the list (#514)', () => {
    // #408 derived the LANDING PAGE's count and stopped there. The same claim
    // is repeated in prose the landing page does not own, and all three had
    // drifted to 32 while 34 were registered: README.md, CLAUDE.md, and a
    // published blog post.
    //
    // TWO NUMBERS ARE LEGITIMATE, which is the whole reason this drifts.
    // "34 themes" (the total) and "32 DaisyUI themes" (theirs, excluding our
    // two) are both true, so a reader who checks one against the other finds
    // a mismatch that is not one — and "fixing" it makes a true sentence
    // false. That is exactly what a blind 32->34 sweep did to three correct
    // lines in the blog post while this was being written.
    //
    // So the rule is: any "<N> theme(s)" claim in these files must cite one of
    // the two derived numbers. Add a theme and 34 becomes 35 while 32 stays
    // 32; this fails on the stale 34 and leaves the DaisyUI figure alone.
    const SURFACES = [
      'README.md',
      'CLAUDE.md',
      'public/blog/scripthammer-intro.md',
    ];
    // THE RULE: a count must sit ADJACENT to the qualifier it describes.
    //
    // The first version of this just allowed {34, 32, 2} anywhere, and it
    // could not fail. Mutation-tested by restoring the original stale line —
    // "32 themes - DaisyUI light/dark variants", which claims 32 as the TOTAL
    // — and the guard stayed green, because 32 is legitimate as the DaisyUI
    // subset. A set of allowed numbers cannot distinguish "32 of them" from
    // "32 of DaisyUI's", so it permitted exactly the sentence that started
    // this ticket.
    //
    // Requiring adjacency removes the ambiguity instead of trying to parse it:
    // an unqualified "N themes" means the total, "N DaisyUI themes" means
    // theirs, "N house themes" means ours. Prose that wants the subset has to
    // say so next to the number.
    const expected = (qualifier: string): number => {
      const q = qualifier.trim().toLowerCase();
      if (q === 'house' || q === 'custom') return HOUSE_THEME_COUNT;
      if (q === 'daisyui') return DAISYUI_THEME_COUNT;
      return THEME_COUNT;
    };

    const wrong: string[] = [];
    for (const rel of SURFACES) {
      const full = join(process.cwd(), rel);
      if (!existsSync(full)) continue;
      readFileSync(full, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          // A line describing a RENAME is quoting strings, not making a claim.
          // CLAUDE.md records "`32 Themes` → `34 Themes` broke seven locators
          // (#408)" — that sentence has to keep both numbers to stay true, and
          // rewriting it would destroy the warning it exists to give.
          if (line.includes('→') || line.includes('->')) return;

          for (const m of line.matchAll(
            /\b(\d{1,3})\s+([\w-]+\s+)?themes?\b/gi
          )) {
            const n = Number(m[1]);
            const want = expected(m[2] ?? '');
            if (n !== want) {
              wrong.push(
                `${rel}:${i + 1}  "${m[0]}" — reads as ${want}, says ${n}` +
                  `\n      ${line.trim().slice(0, 100)}`
              );
            }
          }
        });
    }

    expect(
      wrong,
      `A theme count in prose disagrees with src/config/themes.ts.\n` +
        `Legitimate values are ${THEME_COUNT} (total) and ${DAISYUI_THEME_COUNT} ` +
        `(DaisyUI's own, excluding our ${HOUSE_THEME_COUNT}).\n` +
        `Do NOT "fix" this by editing the number in a sentence that says ` +
        `"DaisyUI" — those are correct.\n\n` +
        wrong.join('\n')
    ).toEqual([]);
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
