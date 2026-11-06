import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LIVE_SUBSCRIPTION_STATUSES,
  LIVE_SUBSCRIPTION_MESSAGE,
  deletionBlockedBy,
} from '../../supabase/functions/delete-account/resolve';

/**
 * delete-account refuses while a subscription is still billing (#1309).
 *
 * The fix for #1309 sets a deleted buyer's subscription owner to NULL instead of failing the
 * delete. That keeps the payment records, but an ownerless subscription cannot be cancelled
 * (cancel-subscription authorises by owner), so the provider would keep charging. The refusal
 * that the old foreign key gave by accident is made deliberate here.
 */
describe('deletionBlockedBy', () => {
  it('allows deletion with no subscriptions', () => {
    expect(deletionBlockedBy([])).toBeNull();
  });

  it.each(['active', 'grace_period', 'past_due', 'canceling'])(
    'blocks while a subscription is %s',
    (status) => {
      expect(deletionBlockedBy([{ status }])).toBe(LIVE_SUBSCRIPTION_MESSAGE);
    }
  );

  it.each(['canceled', 'expired'])(
    'does not block on a %s subscription',
    (status) => {
      expect(deletionBlockedBy([{ status }])).toBeNull();
    }
  );

  it('blocks when one of several is live', () => {
    expect(
      deletionBlockedBy([{ status: 'canceled' }, { status: 'active' }])
    ).toBe(LIVE_SUBSCRIPTION_MESSAGE);
  });

  it('uses the same live set as the one-live-per-user index in the schema', () => {
    // Two lists drift silently. The index predicate is the schema's definition of "live".
    const sql = readFileSync(
      path.join(
        process.cwd(),
        'supabase/migrations/20251006_complete_monolithic_setup.sql'
      ),
      'utf8'
    );
    const m = sql.match(
      /idx_subscriptions_one_live_per_user\s+ON subscriptions\(template_user_id\)\s+WHERE status IN \(([^)]*)\)/
    );
    expect(m).not.toBeNull();
    const inSchema = [...m![1].matchAll(/'(\w+)'/g)].map((x) => x[1]).sort();
    expect([...LIVE_SUBSCRIPTION_STATUSES].sort()).toEqual(inSchema);
  });
});

describe('delete-account/index.ts', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'supabase/functions/delete-account/index.ts'),
    'utf8'
  );

  it('checks for a live subscription before it deletes the user', () => {
    const check = src.indexOf('deletionBlockedBy(');
    const del = src.indexOf('admin.auth.admin.deleteUser(');
    expect(check).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(-1);
    expect(check).toBeLessThan(del);
  });
});
