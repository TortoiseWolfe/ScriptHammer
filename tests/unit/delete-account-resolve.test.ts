import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LIVE_SUBSCRIPTION_STATUSES,
  LIVE_SUBSCRIPTION_MESSAGE,
  deletionBlockedBy,
  deleteAccount,
  type AccountEraser,
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

describe('deleteAccount', () => {
  /** A fake admin client that records the order its calls arrive in. */
  function fakeAdmin(
    subs: Array<{ status: string }> | null,
    opts: {
      lookupError?: string;
      deleteError?: string;
      stillThere?: boolean;
    } = {}
  ) {
    const calls: string[] = [];
    const admin: AccountEraser = {
      from: () => ({
        select: () => ({
          eq: async () => {
            calls.push('lookup');
            return {
              data: subs,
              error: opts.lookupError ? { message: opts.lookupError } : null,
            };
          },
        }),
      }),
      auth: {
        admin: {
          deleteUser: async () => {
            calls.push('delete');
            return {
              error: opts.deleteError ? { message: opts.deleteError } : null,
            };
          },
          getUserById: async () => {
            calls.push('confirm');
            return { data: { user: opts.stillThere ? { id: 'u' } : null } };
          },
        },
      },
    };
    return { admin, calls };
  }

  it('looks up subscriptions before it deletes, then confirms the user is gone', async () => {
    const { admin, calls } = fakeAdmin([{ status: 'canceled' }]);
    expect(await deleteAccount(admin, 'u')).toEqual({
      status: 200,
      body: { success: true },
    });
    expect(calls).toEqual(['lookup', 'delete', 'confirm']);
  });

  it('answers 409 and never deletes while a subscription is billing', async () => {
    const { admin, calls } = fakeAdmin([{ status: 'active' }]);
    expect(await deleteAccount(admin, 'u')).toEqual({
      status: 409,
      body: { error: LIVE_SUBSCRIPTION_MESSAGE },
    });
    expect(calls).toEqual(['lookup']);
  });

  it('fails closed when the subscription lookup errors', async () => {
    const { admin, calls } = fakeAdmin(null, { lookupError: 'boom' });
    const result = await deleteAccount(admin, 'u');
    expect(result.status).toBe(500);
    expect(calls).toEqual(['lookup']);
  });

  it('reports a delete that did not remove the user', async () => {
    const { admin } = fakeAdmin([], { stillThere: true });
    expect((await deleteAccount(admin, 'u')).status).toBe(500);
  });

  it('reports an error from the delete call', async () => {
    const { admin, calls } = fakeAdmin([], { deleteError: 'nope' });
    expect((await deleteAccount(admin, 'u')).status).toBe(500);
    expect(calls).toEqual(['lookup', 'delete']);
  });
});

describe('delete-account/index.ts', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'supabase/functions/delete-account/index.ts'),
    'utf8'
  );

  it('hands the whole decision to deleteAccount, so the database test runs the same code', () => {
    expect(src).toContain('deleteAccount(admin, userId)');
    // Nothing privileged is called inline any more: a second copy of the logic here would be
    // a path the database test does not cover.
    expect(src).not.toContain('admin.auth.admin.deleteUser(');
  });
});
