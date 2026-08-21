import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ADMIN_SECTIONS, ADMIN_SECTION_FLOOR } from './admin-sections';

/**
 * `ADMIN_SECTIONS` must match the admin pages that actually exist (#912).
 *
 * WHY THIS IS A UNIT TEST AND NOT LEFT TO THE E2E SPEC. The obvious home for this is
 * `tests/e2e/admin/admin-dashboard.spec.ts`, whose navigation test now enumerates
 * `ADMIN_SECTIONS` instead of restating it. But that spec carries
 * `test.skip(!!process.env.CI, …)` at line 45 — **it does not run in CI at all**. So an
 * E2E-only fix would have changed nothing about what CI can see, which is the defect this
 * repo catalogues under #396: a guard pointed somewhere it cannot observe.
 *
 * This file runs under `pnpm test:coverage`, which the REQUIRED `Test (20.x)` check
 * executes. It is the part of #912 that actually gates.
 *
 * WHAT IT CAUGHT. The E2E array listed six tabs while the nav rendered seven —
 * `/admin/email` ("Email Provider Health") was never visited by a test named "should
 * navigate between all admin tabs". `Orders` had been added to both lists; `Email` to only
 * one, because nothing compared them.
 */

const ADMIN_DIR = path.resolve(__dirname, '..', 'app', 'admin');

/** Every routable admin page on disk, as an href. */
function pagesOnDisk(): string[] {
  const out: string[] = [];
  if (existsSync(path.join(ADMIN_DIR, 'page.tsx'))) out.push('/admin');
  for (const entry of readdirSync(ADMIN_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Route groups and private folders are not routable.
    if (entry.name.startsWith('_') || entry.name.startsWith('(')) continue;
    if (existsSync(path.join(ADMIN_DIR, entry.name, 'page.tsx'))) {
      out.push(`/admin/${entry.name}`);
    }
  }
  return out.sort();
}

describe('ADMIN_SECTIONS matches the admin console on disk (#912)', () => {
  it('the scan found admin pages at all', () => {
    // Anti-vacuity. A moved directory would make `pagesOnDisk()` empty, and the two
    // set comparisons below would then both pass while comparing nothing.
    const pages = pagesOnDisk();
    expect(
      pages.length,
      `no admin pages found under ${ADMIN_DIR} — the scan is looking in the wrong place, ` +
        'so the comparisons below are inspecting an empty set'
    ).toBeGreaterThanOrEqual(ADMIN_SECTION_FLOOR);
  });

  it('every admin page on disk has a nav section', () => {
    // The direction that already failed: /admin/email shipped as a page and a nav entry
    // while the E2E test's hardcoded list never learned about it.
    const missing = pagesOnDisk().filter(
      (href) => !ADMIN_SECTIONS.some((s) => s.href === href)
    );
    expect(
      missing,
      'these admin pages exist but are not in ADMIN_SECTIONS, so the nav does not link ' +
        'them and the E2E navigation test does not visit them'
    ).toEqual([]);
  });

  it('every nav section points at a page that exists', () => {
    // The opposite direction: a section left behind after a page is deleted renders a
    // link to a 404, and the E2E test would click it.
    const orphans = ADMIN_SECTIONS.filter(
      (s) => !pagesOnDisk().includes(s.href)
    ).map((s) => s.href);
    expect(
      orphans,
      'these nav sections have no page.tsx on disk — the nav links to a 404'
    ).toEqual([]);
  });

  it('holds at least the floor, and every entry is complete', () => {
    expect(ADMIN_SECTIONS.length).toBeGreaterThanOrEqual(ADMIN_SECTION_FLOOR);
    for (const s of ADMIN_SECTIONS) {
      expect(s.href, 'a section has no href').toMatch(/^\/admin/);
      expect(s.label?.length, `${s.href} has no label`).toBeGreaterThan(0);
      expect(s.title?.length, `${s.href} has no title`).toBeGreaterThan(0);
    }
  });

  it('labels are unique — duplicates make getByText ambiguous', () => {
    // The E2E test locates each tab by its label. Two sections sharing one would make
    // `getByText` resolve to whichever comes first in document order, silently testing
    // one twice and the other never — the #378/#408 shape.
    const labels = ADMIN_SECTIONS.map((s) => s.label);
    expect(
      new Set(labels).size,
      `duplicate label in ${labels.join(', ')}`
    ).toBe(labels.length);
  });
});
