import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paymentLimits } from '../payment';

/**
 * The payment ceiling is a blast-radius control, so it is pinned to the most
 * expensive thing actually sold rather than to a round number with headroom
 * (#557). That only stays true if something checks — the ceiling lives in three
 * places (the migration CHECK, `paymentLimits`, and a doc comment) and the catalog
 * lives in a fourth.
 *
 * These tests hold the two that matter in step:
 *   1. the TypeScript constant agrees with the SQL constraint, and
 *   2. neither is below the priciest active product.
 *
 * Without (2), adding a $5,000 SKU silently creates a product nobody can buy —
 * the INSERT succeeds, the storefront renders it, and checkout fails at the
 * constraint with an error about cents.
 */

const MIGRATION = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20251006_complete_monolithic_setup.sql'
);

const sql = readFileSync(MIGRATION, 'utf8');

/** The ceiling as the DATABASE enforces it — the only real control. */
function ceilingFromMigration(): number {
  const m = /payment_intents_amount_check[\s\S]{0,200}?amount <= (\d+)/.exec(
    sql
  );
  if (!m) {
    throw new Error(
      'Could not find the payment_intents amount ceiling in the migration. ' +
        'The constraint moved or was renamed — this test can no longer verify anything.'
    );
  }
  return Number(m[1]);
}

type SeededProduct = { sku: string; amount: number; active: boolean };

/**
 * Parse the seeded catalog out of the migration.
 *
 * Throws rather than returning a short list if parsing degrades. A regex that
 * quietly stops matching would leave max() at 0, and every assertion below would
 * pass while checking nothing — the exact shape of defect this repo keeps
 * rediscovering (#396).
 */
function seededProducts(): SeededProduct[] {
  const insert = /INSERT INTO products[\s\S]*?ON CONFLICT/.exec(sql);
  if (!insert)
    throw new Error('Could not locate the products INSERT in the migration.');

  const rows = insert[0]
    .split(/\n\s*\(/)
    .slice(1)
    .map((chunk) => {
      const sku = /^'([^']+)'/.exec(chunk)?.[1];
      const amount = /,\s*(\d+),\s*'(?:fixed|variable)'/.exec(chunk)?.[1];
      const active = /,\s*(true|false)\)/.exec(chunk)?.[1];
      if (!sku || amount === undefined || active === undefined) return null;
      return { sku, amount: Number(amount), active: active === 'true' };
    })
    .filter((r): r is SeededProduct => r !== null);

  if (rows.length < 11) {
    throw new Error(
      `Parsed only ${rows.length} seeded products; the migration seeds 11. ` +
        'The seed format changed and this parser is no longer reading it — ' +
        'fix the parser rather than the expectation, or these tests verify nothing.'
    );
  }
  return rows;
}

describe('payment ceiling', () => {
  it('the TypeScript constant matches the constraint the database enforces', () => {
    // validatePaymentAmount() runs in the browser and a tampered client skips it,
    // so the constant is documentation — but documentation that disagrees with the
    // control is worse than none.
    expect(paymentLimits.maxAmount).toBe(ceilingFromMigration());
  });

  it('is pinned to the most expensive active product, not a round number', () => {
    const active = seededProducts().filter((p) => p.active);
    const priciest = Math.max(...active.map((p) => p.amount));

    expect(priciest).toBeGreaterThan(0);
    expect(paymentLimits.maxAmount).toBe(priciest);
  });

  it('leaves no active product unsellable', () => {
    for (const p of seededProducts().filter((p) => p.active)) {
      expect(
        p.amount,
        `${p.sku} costs ${p.amount} but the ceiling is ${paymentLimits.maxAmount} — it could never be charged`
      ).toBeLessThanOrEqual(paymentLimits.maxAmount);
    }
  });

  it('still admits the smallest thing sold', () => {
    const active = seededProducts().filter((p) => p.active && p.amount > 0);
    const cheapest = Math.min(...active.map((p) => p.amount));
    expect(cheapest).toBeGreaterThanOrEqual(paymentLimits.minAmount);
  });

  it('parses the catalog it claims to parse', () => {
    // Guards the guard. If the seed format drifts, seededProducts() throws — but
    // only if something calls it, and only if the count check is real.
    const rows = seededProducts();
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r.sku)).toContain('svc-site');
    expect(rows.find((r) => r.sku === 'svc-site')?.amount).toBe(350000);
    // The three recurring SKUs ship inactive until they have provider ids.
    expect(rows.filter((r) => !r.active)).toHaveLength(3);
  });
});
