import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  VERIFY_JWT,
  declaredSlugs,
  jwtDrift,
} from '../../scripts/lib/edge-function-jwt';

/**
 * The declared `verify_jwt` table, and the comparison that makes it worth declaring (#1188).
 *
 * The live comparison lives in `scripts/supabase/check-verify-jwt.ts` and needs a credential.
 * This covers the pure half, which is where the interesting mistakes are: a drift function that
 * reports nothing is indistinguishable from a project that matches.
 */
describe('declared verify_jwt table (#1188)', () => {
  it('covers every function directory in the repo', () => {
    const dir = join(process.cwd(), 'supabase', 'functions');
    const slugs = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '_shared')
      .map((d) => d.name)
      .filter((s) => existsSync(join(dir, s, 'index.ts')))
      .sort();

    expect(slugs.length).toBeGreaterThan(5);
    // A function present in the repo but absent here has no value for a deploy to replay,
    // which is the gap that made `--apply` unsafe in the first place.
    expect(declaredSlugs()).toEqual(slugs);
  });

  it('records the one function that requires a JWT, and does not invent others', () => {
    // Captured from production, not chosen. If this changes, something was deployed with a
    // different flag or edited in the dashboard — either way a human should look.
    const requiring = Object.entries(VERIFY_JWT)
      .filter(([, v]) => v)
      .map(([k]) => k);
    expect(requiring).toEqual(['delete-account']);
  });

  it('is frozen, so nothing can quietly mutate the declaration at runtime', () => {
    expect(Object.isFrozen(VERIFY_JWT)).toBe(true);
  });

  describe('jwtDrift', () => {
    const live = () => Object.fromEntries(Object.entries(VERIFY_JWT));

    it('reports nothing when the project matches', () => {
      expect(jwtDrift(live())).toEqual([]);
    });

    it('catches a flag flipped in the dashboard', () => {
      const l = live();
      l['stripe-webhook'] = true;
      expect(jwtDrift(l)).toEqual([
        {
          slug: 'stripe-webhook',
          declared: false,
          live: true,
          kind: 'changed',
        },
      ]);
    });

    it('catches a deployed function nobody declared', () => {
      const l = live();
      l['brand-new-fn'] = false;
      expect(jwtDrift(l)).toContainEqual({
        slug: 'brand-new-fn',
        live: false,
        kind: 'undeclared',
      });
    });

    it('catches a declared function that is not deployed', () => {
      const l = live();
      delete l['create-lead'];
      expect(jwtDrift(l)).toContainEqual({
        slug: 'create-lead',
        declared: false,
        kind: 'missing-in-project',
      });
    });

    it('reports EVERY disagreement, not just the first', () => {
      // One row reads as a dashboard edit; three read as a missing deploy. Stopping at the
      // first would make those look the same.
      const l = live();
      l['stripe-webhook'] = true;
      l['create-order'] = true;
      delete l['create-lead'];
      expect(jwtDrift(l)).toHaveLength(3);
    });

    it('is not satisfied by an empty live reading', () => {
      // A failed fetch that yielded {} must look like total drift, never like agreement.
      expect(jwtDrift({})).toHaveLength(Object.keys(VERIFY_JWT).length);
    });
  });
});
