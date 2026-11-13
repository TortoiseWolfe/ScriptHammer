import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/config/payment', () => ({ paypalConfig: {} }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'jwt' } },
      }),
    },
  },
}));

import {
  approvePayPalOrder,
  PAYPAL_PROCESSING_MESSAGE,
} from '@/lib/payments/paypal';

/**
 * What the buyer's page makes of capture-paypal-order's answer (#1349). A capture PayPal holds
 * (PENDING) is neither paid nor failed, and the page must be able to tell it from a failure:
 * "Order status: PENDING" read as a failure is what sent buyers to pay by card as well.
 */
describe('approvePayPalOrder', () => {
  const answer = (body: unknown, ok = true) =>
    vi.fn().mockResolvedValue({ ok, json: async () => body });

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('COMPLETED is success', async () => {
    vi.stubGlobal('fetch', answer({ status: 'COMPLETED' }));
    expect(await approvePayPalOrder('o-1')).toEqual({ success: true });
  });

  it('PENDING is pending: not success, and in words about processing, not failure', async () => {
    vi.stubGlobal('fetch', answer({ status: 'PENDING' }));
    const result = await approvePayPalOrder('o-1');
    expect(result).toEqual({
      success: false,
      pending: true,
      error: PAYPAL_PROCESSING_MESSAGE,
    });
    expect(PAYPAL_PROCESSING_MESSAGE).toMatch(/still processing/);
    expect(PAYPAL_PROCESSING_MESSAGE).not.toMatch(/fail/i);
  });

  it('CONTROL: any other status is a failure and is not marked pending', async () => {
    vi.stubGlobal('fetch', answer({ status: 'DECLINED' }));
    const result = await approvePayPalOrder('o-1');
    expect(result.success).toBe(false);
    expect(result.pending).toBeUndefined();
    expect(result.error).toBe('Order status: DECLINED');
  });

  it('CONTROL: an HTTP error is a failure with the server’s sentence', async () => {
    vi.stubGlobal(
      'fetch',
      answer({ error: 'This payment has already gone through.' }, false)
    );
    const result = await approvePayPalOrder('o-1');
    expect(result).toEqual({
      success: false,
      error: 'This payment has already gone through.',
    });
  });
});
