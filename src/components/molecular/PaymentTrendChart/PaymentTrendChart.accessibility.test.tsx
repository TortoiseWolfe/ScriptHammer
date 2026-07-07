import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import PaymentTrendChart from './PaymentTrendChart';
import type { DailyPaymentPoint } from '@/services/admin/admin-payment-service';

expect.extend(toHaveNoViolations);

const sample: DailyPaymentPoint[] = [
  { day: '2026-02-26', succeeded: 6, failed: 0, revenue_cents: 18_000 },
  { day: '2026-02-27', succeeded: 5, failed: 1, revenue_cents: 15_000 },
  { day: '2026-02-28', succeeded: 8, failed: 0, revenue_cents: 22_000 },
];

describe('PaymentTrendChart Accessibility', () => {
  it('has no axe violations with data', async () => {
    const { container } = render(<PaymentTrendChart data={sample} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when empty', async () => {
    const { container } = render(<PaymentTrendChart data={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('SVG has role=img and a non-empty aria-label', () => {
    const { container } = render(<PaymentTrendChart data={sample} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg?.getAttribute('aria-label')?.length).toBeGreaterThan(0);
  });

  it('does not rely on color alone — the aria-label carries the totals', () => {
    // The two lines differ only by stroke color to sighted users. The summary
    // in aria-label is the non-color channel: a screen reader reads the counts
    // without needing to perceive green vs red.
    const { container } = render(<PaymentTrendChart data={sample} />);
    const label = container.querySelector('svg')?.getAttribute('aria-label');
    expect(label).toMatch(/succeeded/i);
    expect(label).toMatch(/failed/i);
  });
});
