import { describe, it, expect } from 'vitest';
import {
  resolveLead,
  clientIp,
  LEAD_SOURCES,
  ATTEMPT_TYPE,
} from '../../supabase/functions/create-lead/resolve';

/**
 * These are the ONLY automated coverage `create-lead` has, and that is structural rather
 * than an oversight. Nothing in CI executes an Edge Function: `tsconfig.json` excludes
 * `supabase/`, Vitest excludes `supabase/functions/**`, and `edge-functions.yml` runs
 * `deno check` but is deliberately not a required check because it resolves over the
 * network (#1153). So every rule worth testing lives in a `resolve.ts` that imports
 * nothing, and this file loads it directly — the pattern `create-order` established.
 */
describe('create-lead resolves what it will write', () => {
  it('accepts a pricing click with a SKU', () => {
    const r = resolveLead({ source: 'pricing', product_id: 'svc-landing' });
    expect(r).toEqual({
      ok: true,
      row: { source: 'pricing', product_id: 'svc-landing' },
    });
  });

  it('accepts a general enquiry with no SKU', () => {
    // "Book a call" from the header has no product behind it. Absent and empty both mean
    // none — only a PRESENT malformed value is an error.
    for (const body of [
      { source: 'pricing' },
      { source: 'pricing', product_id: '' },
      { source: 'pricing', product_id: null },
    ]) {
      const r = resolveLead(body);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.row.product_id).toBeNull();
    }
  });

  it('refuses a source the database CHECK would reject', () => {
    // Without this the value reaches Postgres and comes back as a 23514 the browser sees
    // as a 500 — the shape #784 hit on its first live call with `contact_form`.
    const r = resolveLead({ source: 'newsletter' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]).toMatch(/source must be one of/);
  });

  it('keeps its source list identical to the column CHECK', () => {
    // If these drift, the failure is a 500 in production rather than a red test here.
    expect([...LEAD_SOURCES]).toEqual(['pricing', 'schedule', 'checkout']);
  });

  it('NEVER carries utm_* into the row, however they are sent (FR-024a)', () => {
    // The requirement is that the outbound link MAY carry campaign parameters and this
    // table may NOT store them. The row is built by naming two fields rather than by
    // spreading the body, which is what makes this hold for parameters nobody has thought
    // of yet — so this case is really testing the construction, not a deny-list.
    const r = resolveLead({
      source: 'pricing',
      product_id: 'svc-landing',
      utm_source: 'newsletter',
      utm_content: 'lead_123',
      utm_campaign: 'spring',
      name: 'Mallory',
      email: 'mallory@example.com',
      status: 'converted',
      id: '00000000-0000-4000-8000-000000000000',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.row).sort()).toEqual(['product_id', 'source']);
    }
  });

  it('will not let an anonymous caller name the lead or set its stage', () => {
    // Counterweight to the case above, stated as the security property rather than as a
    // key count: `name`, `email` and `status` are real columns, and accepting them here
    // would let anyone write any name against any lead. Only a confirmed booking can fill
    // them honestly.
    const r = resolveLead({
      source: 'schedule',
      name: 'Mallory',
      status: 'scheduled',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row).not.toHaveProperty('name');
      expect(r.row).not.toHaveProperty('status');
    }
  });

  it('rejects a product_id that is not shaped like a catalog id', () => {
    // It is a FOREIGN KEY, so a bad value is a database error rather than a bad row.
    for (const bad of ['../etc/passwd', 'SVC-LANDING', 'a'.repeat(80), 'x y']) {
      const r = resolveLead({ source: 'pricing', product_id: bad });
      expect(r.ok, `expected "${bad}" to be rejected`).toBe(false);
    }
  });

  it('rejects a body that is not an object at all', () => {
    for (const bad of [null, 'pricing', 42, undefined]) {
      expect(resolveLead(bad).ok).toBe(false);
    }
  });
});

describe('the rate limiter can actually limit', () => {
  const headers = (h: Record<string, string>) => ({
    get: (n: string) => h[n.toLowerCase()] ?? null,
  });

  it('takes the FIRST x-forwarded-for entry, not the last', () => {
    // The last entry is attacker-controlled: a caller can prepend their own header and
    // rotate identifiers at will, which is a limiter that cannot limit.
    expect(
      clientIp(
        headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' })
      )
    ).toBe('203.0.113.7');
  });

  it('falls back to cf-connecting-ip, then to null so the caller fails closed', () => {
    expect(clientIp(headers({ 'cf-connecting-ip': '198.51.100.4' }))).toBe(
      '198.51.100.4'
    );
    expect(clientIp(headers({}))).toBeNull();
  });

  it('uses an attempt_type the database will accept', () => {
    // `rate_limit_attempts_attempt_type_check` was widened by DROP+ADD and applied to
    // production. An inline edit to the CREATE TABLE would have been a silent no-op there.
    expect(ATTEMPT_TYPE).toBe('booking_lead');
  });
});
