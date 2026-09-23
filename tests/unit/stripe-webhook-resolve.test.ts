import { describe, it, expect } from 'vitest';
import {
  resolveSigningSecret,
  livemodeMismatch,
} from '../../supabase/functions/stripe-webhook/resolve';

/**
 * The ONLY automated coverage this rule has, and that is structural rather than an
 * oversight. Nothing in CI executes an Edge Function: `tsconfig.json` excludes `supabase/`,
 * Vitest excludes `supabase/functions/**` from discovery, and `edge-functions.yml` runs
 * `deno check` but is deliberately not required because it resolves over the network
 * (#1153 — and it currently cannot run here at all, failing on `@types/node`). So the rule
 * lives in a `resolve.ts` importing nothing and this file loads it directly.
 *
 * WHAT IS BEING PREVENTED (#1229). Both signing secrets are configured in production and
 * both Stripe endpoints point at the same function URL, so the previous try-each-in-turn
 * shape let a TEST-mode signature verify against the LIVE deployment. The handler never
 * learned which secret matched, so a fabricated `payment_intent.succeeded` would be
 * processed against real rows — an order marked paid with no card and no money.
 */
describe('stripe-webhook picks one signing secret by deployment (#1229)', () => {
  const LIVE = 'whsec_live_example';
  const TEST = 'whsec_test_example';

  it('a deployment holding a live secret verifies ONLY live signatures', () => {
    const r = resolveSigningSecret({
      STRIPE_WEBHOOK_SECRET_LIVE: LIVE,
      STRIPE_WEBHOOK_SECRET: TEST,
    });
    expect(r).toEqual({
      ok: true,
      choice: {
        name: 'STRIPE_WEBHOOK_SECRET_LIVE',
        secret: LIVE,
        expectLivemode: true,
      },
    });
  });

  it('THE DEFECT: with both configured, the test secret is never eligible', () => {
    // The whole ticket in one assertion. Previously both were tried, so this secret could
    // verify a delivery to production.
    const r = resolveSigningSecret({
      STRIPE_WEBHOOK_SECRET_LIVE: LIVE,
      STRIPE_WEBHOOK_SECRET: TEST,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.choice.secret).not.toBe(TEST);
  });

  it('a deployment with no live secret verifies only test signatures', () => {
    const r = resolveSigningSecret({ STRIPE_WEBHOOK_SECRET: TEST });
    expect(r).toEqual({
      ok: true,
      choice: {
        name: 'STRIPE_WEBHOOK_SECRET',
        secret: TEST,
        expectLivemode: false,
      },
    });
  });

  it('refuses when neither is configured, naming both variables', () => {
    const r = resolveSigningSecret({});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/STRIPE_WEBHOOK_SECRET_LIVE/);
    expect(r.reason).toMatch(/STRIPE_WEBHOOK_SECRET\b/);
  });

  it('treats the `no-secret-provided` literal as absent (#562)', () => {
    // An endpoint configured WITHOUT a secret still sends the header, valued exactly this.
    // Accepting it here would be a second route to verifying unsigned traffic.
    expect(
      resolveSigningSecret({ STRIPE_WEBHOOK_SECRET_LIVE: 'no-secret-provided' })
    ).toEqual({
      ok: false,
      reason: expect.stringContaining('No Stripe signing secret configured'),
    });
    const fellBack = resolveSigningSecret({
      STRIPE_WEBHOOK_SECRET_LIVE: 'no-secret-provided',
      STRIPE_WEBHOOK_SECRET: TEST,
    });
    expect(fellBack.ok).toBe(true);
    if (!fellBack.ok) return;
    expect(fellBack.choice.name).toBe('STRIPE_WEBHOOK_SECRET');
  });

  it('treats whitespace-only as absent', () => {
    const r = resolveSigningSecret({
      STRIPE_WEBHOOK_SECRET_LIVE: '   ',
      STRIPE_WEBHOOK_SECRET: TEST,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.choice.name).toBe('STRIPE_WEBHOOK_SECRET');
  });
});

describe('the verified event must come from the mode its secret belongs to', () => {
  const liveChoice = {
    name: 'STRIPE_WEBHOOK_SECRET_LIVE' as const,
    expectLivemode: true,
  };
  const testChoice = {
    name: 'STRIPE_WEBHOOK_SECRET' as const,
    expectLivemode: false,
  };

  it('accepts a live event verified by the live secret', () => {
    expect(livemodeMismatch({ livemode: true }, liveChoice)).toBeNull();
  });

  it('accepts a test event verified by the test secret', () => {
    expect(livemodeMismatch({ livemode: false }, testChoice)).toBeNull();
  });

  it('REJECTS a test-mode event that somehow verified against the live secret', () => {
    const m = livemodeMismatch({ livemode: false }, liveChoice);
    expect(m).toMatch(/livemode=false/);
    expect(m).toMatch(/STRIPE_WEBHOOK_SECRET_LIVE/);
  });

  it('REJECTS a live event arriving at a deployment holding only the test secret', () => {
    // The #1180 direction: a live endpoint pointed at a deployment without the live
    // secret used to be a silent 400 that read as "Stripe sent something bad".
    expect(livemodeMismatch({ livemode: true }, testChoice)).toMatch(
      /livemode=true/
    );
  });

  it('rejects an event with no boolean livemode rather than assuming one', () => {
    expect(livemodeMismatch({}, liveChoice)).toMatch(/no boolean livemode/);
    expect(livemodeMismatch(null, liveChoice)).toMatch(/no boolean livemode/);
    // Truthiness is not the test: a string would pass a `!!` check and must not pass here.
    expect(
      livemodeMismatch(
        { livemode: 'true' } as unknown as { livemode?: boolean },
        liveChoice
      )
    ).toMatch(/no boolean livemode/);
  });
});
