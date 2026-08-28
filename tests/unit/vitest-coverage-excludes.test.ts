// @vitest-environment node
//
// Node, not jsdom: importing vitest.config.ts pulls in vite/esbuild, and esbuild
// refuses to load under jsdom ("TextEncoder ... incorrectly false"). Reading the real
// config object is worth the pragma — matching the file's text instead would let this
// pass against its own comments.
/**
 * Build output must not be counted as uncovered source (#978).
 *
 * WHY THIS EXISTS. `pnpm test:coverage` reported 59.22% and failed all four 60%
 * thresholds on a tree where all 452 test files passed and CI measured 70.49% for the
 * same commit. The difference was 9,778 statements at 0% from three gitignored export
 * directories a CI checkout never has — `out-basepath` (5,445), `.pay-verify` (3,293),
 * `.chatt-verify` (1,040). The exclude list covered `out/**` and stopped there.
 *
 * That is a gate failing on a clean tree, which is the worst kind: the reflex is to go
 * hunting for missing tests. It cost exactly that — a branch was twice reported as
 * having broken the coverage gate when it never had.
 *
 * This asserts against the REAL config object rather than the file's text, so it
 * cannot pass by matching the prose above.
 */

import { describe, expect, it } from 'vitest';
import config from '../../vitest.config';

/** Directories the repo's own scripts write builds into. */
const BUILD_OUTPUT = [
  'out', // next export
  'out-basepath', // scripts/serve-basepath.sh (#511)
  '.pay-verify', // payment verification build
  '.chatt-verify', // chatt/twin verification build
  'coverage', // this report itself
];

const excludes = (config as { test?: { coverage?: { exclude?: string[] } } })
  .test?.coverage?.exclude;

describe('coverage excludes build output (#978)', () => {
  it('the config exposes a coverage exclude list at all', () => {
    // Without this the loop below would pass vacuously if the config shape changed.
    expect(Array.isArray(excludes)).toBe(true);
    expect(excludes!.length).toBeGreaterThan(5);
  });

  for (const dir of BUILD_OUTPUT) {
    it(`${dir}/ is excluded from coverage`, () => {
      expect(
        excludes,
        `${dir}/ is build output, not source. Leaving it in makes every file it ` +
          `contains count as 0%-covered and can fail the thresholds on a clean tree.`
      ).toContain(`${dir}/**`);
    });
  }

  it('build output is also excluded from test discovery', () => {
    // Same omission, one list up: vitest would otherwise try to collect test files
    // out of a built site.
    const testExcludes = (config as { test?: { exclude?: string[] } }).test
      ?.exclude;
    expect(Array.isArray(testExcludes)).toBe(true);
    for (const dir of ['out', 'out-basepath', '.pay-verify', '.chatt-verify']) {
      expect(testExcludes).toContain(`${dir}/**`);
    }
  });
});
