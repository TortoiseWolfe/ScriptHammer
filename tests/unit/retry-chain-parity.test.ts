/**
 * The two retry walks must agree (#1308).
 *
 * The webhook advances an order by following a retry chain (`supabase/functions/_shared/
 * advance-order.ts`); the buyer's return page follows the same chain to show it
 * (`src/lib/payments/retry-chain.ts`). They are separate copies because an Edge Function cannot
 * import app code. If they drifted, a buyer could be shown a receipt for an order the webhook did
 * not advance, or the reverse, so this pins them together, and both to create-order's limit.
 */

import { describe, it, expect } from 'vitest';
import {
  MAX_RETRY_HOPS as SERVER_HOPS,
  isFaithfulRetry as serverFaithful,
} from '../../supabase/functions/_shared/advance-order';
import { RETRY_LIMIT } from '../../supabase/functions/create-order/resolve';
import {
  MAX_RETRY_HOPS as PAGE_HOPS,
  isFaithfulRetry as pageFaithful,
} from '../../src/lib/payments/retry-chain';

const ROOT = {
  id: 'int-1',
  parent_intent_id: null,
  amount: 3900,
  currency: 'usd',
  template_user_id: 'user-1',
};

describe('the webhook and the return page walk retries the same way', () => {
  it('use the same bound, and it covers every chain create-order can build', () => {
    expect(PAGE_HOPS).toBe(SERVER_HOPS);
    // A chain is at most RETRY_LIMIT deep; a bound below that would strand the last retry.
    expect(SERVER_HOPS).toBeGreaterThan(RETRY_LIMIT);
  });

  it('accept and refuse the same links', () => {
    const cases = [
      { ...ROOT, id: 'int-2', parent_intent_id: 'int-1' },
      { ...ROOT, id: 'int-2', amount: 100 },
      { ...ROOT, id: 'int-2', currency: 'eur' },
      { ...ROOT, id: 'int-2', template_user_id: 'someone-else' },
    ];
    for (const child of cases) {
      expect(pageFaithful(child, ROOT)).toBe(serverFaithful(child, ROOT));
    }
  });
});
