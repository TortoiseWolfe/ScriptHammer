import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveClosure,
  relativeSpecifiers,
} from '../../scripts/lib/edge-function-closure';

const FUNCTIONS = join(process.cwd(), 'supabase', 'functions');
const read = (p: string) => {
  const full = join(FUNCTIONS, p);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
};

/**
 * These pin the two closures a human has already got wrong (#1188).
 *
 * On 2026-09-23, deploying `stripe-webhook` for #1229, the file set was counted BY HAND as
 * four. It is five. The missed one was `_shared/webhook-types.ts`, imported across a line
 * break — invisible to a regex anchored to the `import` keyword, and there are three such
 * imports in the repo today.
 *
 * The Management API refused that deploy, which is the good news: it validates closure
 * COMPLETENESS. It does not validate PROVENANCE, which is why #1188 also matters for a tree
 * that is complete but stale.
 */
describe('edge function deploy closure (#1188)', () => {
  it('finds the specifier that hides behind a line break', () => {
    // The exact shape that defeated the hand count. A keyword-anchored regex
    // (/^import\s.*from\s+'([^']+)'/m) returns [] here.
    const src = [
      'import { serve } from "https://deno.land/std/http/server.ts";',
      'import type {',
      '  StripeEvent,',
      '} from "../_shared/webhook-types.ts";',
      "import { resolveSigningSecret } from './resolve.ts';",
    ].join('\n');
    expect(relativeSpecifiers(src).sort()).toEqual([
      '../_shared/webhook-types.ts',
      './resolve.ts',
    ]);
  });

  it('ignores remote specifiers, which Deno fetches and the upload must not carry', () => {
    const src = [
      'import { serve } from "https://deno.land/std/http/server.ts";',
      'import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";',
      'import x from "npm:left-pad";',
    ].join('\n');
    expect(relativeSpecifiers(src)).toEqual([]);
  });

  it('stripe-webhook is FIVE files, not the four counted by hand', () => {
    const { files, missing } = resolveClosure(read, 'stripe-webhook');
    expect(missing).toEqual([]);
    expect(files).toEqual([
      '_shared/ad-conversions.ts',
      '_shared/advance-order.ts',
      '_shared/webhook-types.ts',
      'stripe-webhook/index.ts',
      'stripe-webhook/resolve.ts',
    ]);
  });

  it('create-order reaches its own resolve.ts and two more shared modules', () => {
    const { files, missing } = resolveClosure(read, 'create-order');
    expect(missing).toEqual([]);
    // Two of these hide behind line breaks too (`create-order/index.ts:35` and `:46`).
    expect(files).toContain('create-order/resolve.ts');
    expect(files).toContain('_shared/idempotency.ts');
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('reports a missing module instead of silently shrinking the set', () => {
    // A resolver that swallowed an unreadable import would produce a closure that LOOKS
    // complete and deploys broken — the failure this exists to prevent.
    const fake = (p: string) =>
      p === 'ghost/index.ts' ? "import './nope.ts';\nexport {};" : null;
    const { files, missing } = resolveClosure(fake, 'ghost');
    expect(files).toEqual(['ghost/index.ts']);
    expect(missing).toEqual(['ghost/nope.ts']);
  });

  it('every function in the repo resolves to files that actually exist', () => {
    // NON-VACUITY FLOOR. A resolver that returned just the entrypoint would pass every
    // assertion above except the counts; this sweeps all of them and would catch it.
    const slugs = readdirSync(FUNCTIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '_shared')
      .map((d) => d.name)
      .filter((s) => existsSync(join(FUNCTIONS, s, 'index.ts')));

    expect(slugs.length).toBeGreaterThan(5);
    let multiFile = 0;
    for (const slug of slugs) {
      const { files, missing } = resolveClosure(read, slug);
      expect(missing, `${slug} has unresolvable imports`).toEqual([]);
      for (const f of files) {
        expect(existsSync(join(FUNCTIONS, f)), `${slug} -> ${f}`).toBe(true);
      }
      if (files.length > 1) multiFile += 1;
    }
    // If this were 0, the resolver would be returning bare entrypoints everywhere.
    expect(multiFile).toBeGreaterThan(3);
  });
});
