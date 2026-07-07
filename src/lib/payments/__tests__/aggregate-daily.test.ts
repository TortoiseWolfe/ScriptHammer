import { describe, it, expect } from 'vitest';
import { aggregateDailyPayments } from '../aggregate-daily';
import type { PaymentActivity } from '@/types/payment';

function pay(
  over: Partial<PaymentActivity> &
    Pick<PaymentActivity, 'created_at' | 'status'>
): PaymentActivity {
  return {
    id: 'x',
    provider: 'stripe',
    transaction_id: 't',
    charged_amount: 1000,
    charged_currency: 'usd',
    customer_email: 'a@b.c',
    webhook_verified: true,
    ...over,
  } as PaymentActivity;
}

describe('aggregateDailyPayments', () => {
  it('returns [] for no payments', () => {
    expect(aggregateDailyPayments([])).toEqual([]);
  });

  it('groups by UTC day, counts succeeded/failed, sums succeeded revenue', () => {
    const series = aggregateDailyPayments([
      pay({
        created_at: '2026-01-01T10:00:00Z',
        status: 'succeeded',
        charged_amount: 500,
      }),
      pay({
        created_at: '2026-01-01T23:00:00Z',
        status: 'succeeded',
        charged_amount: 700,
      }),
      pay({
        created_at: '2026-01-01T12:00:00Z',
        status: 'failed',
        charged_amount: 999,
      }),
    ]);
    expect(series).toEqual([
      { day: '2026-01-01', succeeded: 2, failed: 1, revenue_cents: 1200 },
    ]);
  });

  it('zero-fills gap days between first and last', () => {
    const series = aggregateDailyPayments([
      pay({ created_at: '2026-01-01T10:00:00Z', status: 'succeeded' }),
      pay({ created_at: '2026-01-03T10:00:00Z', status: 'failed' }),
    ]);
    expect(series.map((p) => p.day)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
    expect(series[1]).toEqual({
      day: '2026-01-02',
      succeeded: 0,
      failed: 0,
      revenue_cents: 0,
    });
  });

  it('does not count pending/refunded toward succeeded revenue or failed', () => {
    const series = aggregateDailyPayments([
      pay({
        created_at: '2026-01-01T10:00:00Z',
        status: 'pending',
        charged_amount: 500,
      }),
      pay({
        created_at: '2026-01-01T11:00:00Z',
        status: 'refunded',
        charged_amount: 500,
      }),
    ]);
    expect(series).toEqual([
      { day: '2026-01-01', succeeded: 0, failed: 0, revenue_cents: 0 },
    ]);
  });

  it('orders days oldest → newest regardless of input order', () => {
    const series = aggregateDailyPayments([
      pay({ created_at: '2026-01-05T10:00:00Z', status: 'succeeded' }),
      pay({ created_at: '2026-01-02T10:00:00Z', status: 'succeeded' }),
    ]);
    expect(series[0].day).toBe('2026-01-02');
    expect(series[series.length - 1].day).toBe('2026-01-05');
  });
});
