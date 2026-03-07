import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AdminTrendChart } from './AdminTrendChart';

const sample = [
  { label: 'A', value: 10 },
  { label: 'B', value: 25 },
  { label: 'C', value: 15 },
];

describe('AdminTrendChart Accessibility', () => {
  it('should have no axe violations with data', async () => {
    const { container } = render(
      <AdminTrendChart data={sample} title="Trend" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when empty', async () => {
    const { container } = render(<AdminTrendChart data={[]} title="Empty" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('figure has an accessible name matching the title', () => {
    const { getByRole } = render(
      <AdminTrendChart data={sample} title="Refund rate over time" />
    );
    expect(
      getByRole('figure', { name: 'Refund rate over time' })
    ).toBeInTheDocument();
  });

  it('svg has role=img with descriptive aria-label', () => {
    const { getByRole } = render(
      <AdminTrendChart data={sample} title="Revenue" />
    );
    // The figure name is "Revenue"; the inner svg's name is "Revenue chart".
    expect(getByRole('img', { name: /revenue chart/i })).toBeInTheDocument();
  });
});
