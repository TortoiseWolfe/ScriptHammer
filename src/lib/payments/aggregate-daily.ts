/**
 * Client-side aggregation of a user's own payment activity into the
 * `DailyPaymentPoint[]` series the PaymentTrendChart renders.
 *
 * The admin PaymentTrendChart is fed by an admin RPC (all users). A regular user
 * can't call that, but their own payments are already fetched by PaymentHistory
 * (`getPaymentHistory`). This groups those by UTC day, counts succeeded/failed,
 * sums revenue (succeeded charged_amount), and zero-fills gap days so the chart
 * is continuous — matching the admin series' shape/contract.
 */

import type { PaymentActivity } from '@/types/payment';
import type { DailyPaymentPoint } from '@/services/admin/admin-payment-service';

/** UTC YYYY-MM-DD for an ISO timestamp. */
function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Add `n` UTC days to a YYYY-MM-DD string. */
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregate payments into a dense, ordered daily series (oldest → newest) with
 * gap days zero-filled. Returns [] for no payments.
 *
 * `revenue_cents` counts only succeeded payments (a failed charge earns nothing).
 */
export function aggregateDailyPayments(
  payments: PaymentActivity[]
): DailyPaymentPoint[] {
  if (payments.length === 0) return [];

  const byDay = new Map<string, DailyPaymentPoint>();
  for (const p of payments) {
    const day = utcDay(p.created_at);
    const point =
      byDay.get(day) ??
      ({ day, succeeded: 0, failed: 0, revenue_cents: 0 } as DailyPaymentPoint);
    if (p.status === 'succeeded') {
      point.succeeded += 1;
      point.revenue_cents += p.charged_amount;
    } else if (p.status === 'failed') {
      point.failed += 1;
    }
    byDay.set(day, point);
  }

  const days = [...byDay.keys()].sort();
  const first = days[0];
  const last = days[days.length - 1];

  // Zero-fill every UTC day from first → last so the chart has no gaps.
  const series: DailyPaymentPoint[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) {
    series.push(
      byDay.get(day) ?? { day, succeeded: 0, failed: 0, revenue_cents: 0 }
    );
  }
  return series;
}
