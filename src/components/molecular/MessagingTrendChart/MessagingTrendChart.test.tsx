import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessagingTrendChart from './MessagingTrendChart';
import type { DailyMessagingPoint } from '@/services/admin/admin-messaging-service';

// The two series are intentionally off-scale — messages run 100-140,
// conversations 1-3. The shared y-axis flattens the conversations line
// against the floor, which is HONEST. 110 messages per day vs 2 new
// threads per day is a real ratio; pretending otherwise is a dual-axis lie.
const week: DailyMessagingPoint[] = [
  { day: '2026-02-26', messages: 110, conversations_created: 2 },
  { day: '2026-02-27', messages: 98, conversations_created: 1 },
  { day: '2026-02-28', messages: 134, conversations_created: 3 },
  { day: '2026-03-01', messages: 122, conversations_created: 0 },
  { day: '2026-03-02', messages: 101, conversations_created: 2 },
  { day: '2026-03-03', messages: 140, conversations_created: 1 },
  { day: '2026-03-04', messages: 142, conversations_created: 3 },
];

function pointCount(polyline: Element | null): number {
  const attr = polyline?.getAttribute('points')?.trim() ?? '';
  if (!attr) return 0;
  return attr.split(/\s+/).length;
}

describe('MessagingTrendChart', () => {
  it('strokes messages line with var(--color-info) — matches the overview spark', () => {
    // AdminDashboardOverview spark-messages already uses tone=info. The
    // detail chart keeps the same hue so "messages" reads the same color
    // whether you're at the overview or drilled into /admin/messaging.
    const { container } = render(<MessagingTrendChart data={week} />);
    const line = container.querySelector('polyline[data-series="messages"]');
    expect(line).toHaveAttribute('stroke', 'var(--color-info)');
  });

  it('strokes conversations line with var(--color-primary)', () => {
    const { container } = render(<MessagingTrendChart data={week} />);
    const line = container.querySelector(
      'polyline[data-series="conversations"]'
    );
    expect(line).toHaveAttribute('stroke', 'var(--color-primary)');
  });

  it('emits one polyline coordinate per data point', () => {
    const { container } = render(<MessagingTrendChart data={week} />);
    const messages = container.querySelector(
      'polyline[data-series="messages"]'
    );
    const convs = container.querySelector(
      'polyline[data-series="conversations"]'
    );
    expect(pointCount(messages)).toBe(week.length);
    expect(pointCount(convs)).toBe(week.length);
  });

  it('computes finite coordinates when every value is zero', () => {
    const flat: DailyMessagingPoint[] = [
      { day: '2026-03-01', messages: 0, conversations_created: 0 },
      { day: '2026-03-02', messages: 0, conversations_created: 0 },
      { day: '2026-03-03', messages: 0, conversations_created: 0 },
    ];
    const { container } = render(<MessagingTrendChart data={flat} />);
    const line = container.querySelector('polyline[data-series="messages"]');
    const points = line?.getAttribute('points') ?? '';
    expect(points).not.toMatch(/NaN/);
    expect(points).not.toMatch(/Infinity/);
    expect(pointCount(line)).toBe(3);
  });

  it('renders a single-point series without dividing by (N-1)=0', () => {
    const one: DailyMessagingPoint[] = [
      { day: '2026-03-01', messages: 50, conversations_created: 2 },
    ];
    const { container } = render(<MessagingTrendChart data={one} />);
    const line = container.querySelector('polyline[data-series="messages"]');
    const points = line?.getAttribute('points') ?? '';
    expect(points).not.toMatch(/NaN/);
    expect(pointCount(line)).toBe(1);
  });

  it('renders fallback text and no polylines when data is empty', () => {
    const { container } = render(<MessagingTrendChart data={[]} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    expect(screen.getByText(/no activity/i)).toBeInTheDocument();
  });

  it('is an accessible image with a summarising label', () => {
    const { container } = render(<MessagingTrendChart data={week} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    const label = svg?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/847/); // total messages across week fixture
    expect(label).toMatch(/12/); // total conversations_created
    expect(label).toMatch(/7/); // days
  });

  it('labels the x-axis with the first and last day', () => {
    render(<MessagingTrendChart data={week} />);
    expect(screen.getByText('Feb 26')).toBeInTheDocument();
    expect(screen.getByText('Mar 4')).toBeInTheDocument();
  });

  it('labels the y-axis with 0 and the max observed value', () => {
    render(<MessagingTrendChart data={week} />);
    // Max across both series — messages dominates at 142 (Mar 4).
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('draws gridlines with the base-300 token', () => {
    const { container } = render(<MessagingTrendChart data={week} />);
    const grids = container.querySelectorAll('line[data-grid]');
    expect(grids.length).toBeGreaterThanOrEqual(2);
    grids.forEach((g) =>
      expect(g).toHaveAttribute('stroke', 'var(--color-base-300)')
    );
  });

  it('messages polyline points are monotonically increasing in x', () => {
    // RPC returns dense ordered series — component must preserve order.
    const { container } = render(<MessagingTrendChart data={week} />);
    const line = container.querySelector('polyline[data-series="messages"]');
    const xs = (line?.getAttribute('points') ?? '')
      .trim()
      .split(/\s+/)
      .map((p) => Number(p.split(',')[0]));
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('the conversations line sits at or below the messages line (shared scale, lower magnitude)', () => {
    // Proves the single-axis behavior is deliberate: at every index,
    // conversations_created ≤ messages in the fixture, so every y-coord
    // on the conversations line is ≥ the messages y-coord (SVG y grows down).
    const { container } = render(<MessagingTrendChart data={week} />);
    const ys = (sel: string) =>
      (container.querySelector(sel)?.getAttribute('points') ?? '')
        .trim()
        .split(/\s+/)
        .map((p) => Number(p.split(',')[1]));
    const msgY = ys('polyline[data-series="messages"]');
    const convY = ys('polyline[data-series="conversations"]');
    for (let i = 0; i < msgY.length; i++) {
      expect(convY[i]).toBeGreaterThanOrEqual(msgY[i]);
    }
  });
});
