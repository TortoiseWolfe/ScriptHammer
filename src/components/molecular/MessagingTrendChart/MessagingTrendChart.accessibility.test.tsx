import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MessagingTrendChart from './MessagingTrendChart';
import type { DailyMessagingPoint } from '@/services/admin/admin-messaging-service';

expect.extend(toHaveNoViolations);

const sample: DailyMessagingPoint[] = [
  { day: '2026-02-26', messages: 110, conversations_created: 2 },
  { day: '2026-02-27', messages: 98, conversations_created: 1 },
  { day: '2026-02-28', messages: 134, conversations_created: 3 },
];

describe('MessagingTrendChart Accessibility', () => {
  it('has no axe violations with data', async () => {
    const { container } = render(<MessagingTrendChart data={sample} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when empty', async () => {
    const { container } = render(<MessagingTrendChart data={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('SVG has role=img and a non-empty aria-label', () => {
    const { container } = render(<MessagingTrendChart data={sample} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg?.getAttribute('aria-label')?.length).toBeGreaterThan(0);
  });

  it('does not rely on color alone — the aria-label names both series', () => {
    // The two lines differ only by stroke token to sighted users. A screen
    // reader hears "messages" and "conversations" by name in the summary,
    // no color perception needed.
    const { container } = render(<MessagingTrendChart data={sample} />);
    const label = container.querySelector('svg')?.getAttribute('aria-label');
    expect(label).toMatch(/messages/i);
    expect(label).toMatch(/conversations/i);
  });
});
