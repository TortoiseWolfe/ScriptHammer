import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaymentTrendChart from './PaymentTrendChart';
import type { DailyPaymentPoint } from '@/services/admin/admin-payment-service';

const week: DailyPaymentPoint[] = [
  { day: '2026-02-26', succeeded: 6, failed: 0, revenue_cents: 18_000 },
  { day: '2026-02-27', succeeded: 5, failed: 1, revenue_cents: 15_000 },
  { day: '2026-02-28', succeeded: 8, failed: 0, revenue_cents: 22_000 },
  { day: '2026-03-01', succeeded: 3, failed: 2, revenue_cents: 9_000 },
  { day: '2026-03-02', succeeded: 9, failed: 0, revenue_cents: 27_000 },
  { day: '2026-03-03', succeeded: 7, failed: 1, revenue_cents: 19_000 },
  { day: '2026-03-04', succeeded: 4, failed: 0, revenue_cents: 12_000 },
];

function pointCount(polyline: Element | null): number {
  const attr = polyline?.getAttribute('points')?.trim() ?? '';
  if (!attr) return 0;
  return attr.split(/\s+/).length;
}

describe('PaymentTrendChart', () => {
  it('strokes succeeded line with var(--color-success) — the theme-reactive contract', () => {
    const { container } = render(<PaymentTrendChart data={week} />);
    // If this string is anything other than a raw var() reference, we have
    // lost runtime theme reactivity. jsdom won't resolve the token — that is
    // the point. The browser does, per [data-theme].
    const line = container.querySelector('polyline[data-series="succeeded"]');
    expect(line).toHaveAttribute('stroke', 'var(--color-success)');
  });

  it('strokes failed line with var(--color-error)', () => {
    const { container } = render(<PaymentTrendChart data={week} />);
    const line = container.querySelector('polyline[data-series="failed"]');
    expect(line).toHaveAttribute('stroke', 'var(--color-error)');
  });

  it('emits one polyline coordinate per data point', () => {
    const { container } = render(<PaymentTrendChart data={week} />);
    const succeeded = container.querySelector(
      'polyline[data-series="succeeded"]'
    );
    const failed = container.querySelector('polyline[data-series="failed"]');
    expect(pointCount(succeeded)).toBe(week.length);
    expect(pointCount(failed)).toBe(week.length);
  });

  it('computes finite coordinates when every value is zero (no NaN from max=0 division)', () => {
    const flat: DailyPaymentPoint[] = [
      { day: '2026-03-01', succeeded: 0, failed: 0, revenue_cents: 0 },
      { day: '2026-03-02', succeeded: 0, failed: 0, revenue_cents: 0 },
      { day: '2026-03-03', succeeded: 0, failed: 0, revenue_cents: 0 },
    ];
    const { container } = render(<PaymentTrendChart data={flat} />);
    const line = container.querySelector('polyline[data-series="succeeded"]');
    const points = line?.getAttribute('points') ?? '';
    expect(points).not.toMatch(/NaN/);
    expect(points).not.toMatch(/Infinity/);
    expect(pointCount(line)).toBe(3);
  });

  it('renders a single-point series without dividing by (N-1)=0', () => {
    const one: DailyPaymentPoint[] = [
      { day: '2026-03-01', succeeded: 5, failed: 1, revenue_cents: 1000 },
    ];
    const { container } = render(<PaymentTrendChart data={one} />);
    const line = container.querySelector('polyline[data-series="succeeded"]');
    const points = line?.getAttribute('points') ?? '';
    expect(points).not.toMatch(/NaN/);
    expect(pointCount(line)).toBe(1);
  });

  it('renders fallback text and no polylines when data is empty', () => {
    const { container } = render(<PaymentTrendChart data={[]} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    expect(screen.getByText(/no activity/i)).toBeInTheDocument();
  });

  it('is an accessible image with a summarising label', () => {
    const { container } = render(<PaymentTrendChart data={week} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    const label = svg?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/42/); // total succeeded across week fixture
    expect(label).toMatch(/4/); // total failed
    expect(label).toMatch(/7/); // days
  });

  it('labels the x-axis with the first and last day', () => {
    render(<PaymentTrendChart data={week} />);
    expect(screen.getByText('Feb 26')).toBeInTheDocument();
    expect(screen.getByText('Mar 4')).toBeInTheDocument();
  });

  it('labels the y-axis with 0 and the max observed value', () => {
    render(<PaymentTrendChart data={week} />);
    // max across fixture is 9 (Mar 2 succeeded)
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('draws gridlines with the base-300 token so they recede in any theme', () => {
    const { container } = render(<PaymentTrendChart data={week} />);
    const grids = container.querySelectorAll('line[data-grid]');
    expect(grids.length).toBeGreaterThanOrEqual(2);
    grids.forEach((g) =>
      expect(g).toHaveAttribute('stroke', 'var(--color-base-300)')
    );
  });

  it('succeeded polyline points are monotonically increasing in x', () => {
    // Catches accidental index reversal or sort bugs — the RPC already returns
    // a dense ordered series so the component should preserve order.
    const { container } = render(<PaymentTrendChart data={week} />);
    const line = container.querySelector('polyline[data-series="succeeded"]');
    const xs = (line?.getAttribute('points') ?? '')
      .trim()
      .split(/\s+/)
      .map((p) => Number(p.split(',')[0]));
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });
});
