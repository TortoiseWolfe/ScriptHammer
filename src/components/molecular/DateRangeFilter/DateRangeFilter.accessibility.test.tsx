import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import DateRangeFilter from './DateRangeFilter';

expect.extend(toHaveNoViolations);

describe('DateRangeFilter Accessibility', () => {
  it('has no axe violations with no value', async () => {
    const { container } = render(<DateRangeFilter onChange={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a value', async () => {
    const { container } = render(
      <DateRangeFilter
        value={{ start: '2026-02-01', end: '2026-03-01' }}
        onChange={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('associates labels with inputs via htmlFor/id', () => {
    const { container } = render(<DateRangeFilter onChange={vi.fn()} />);
    const labels = container.querySelectorAll('label[for]');
    labels.forEach((label) => {
      const forId = label.getAttribute('for');
      expect(container.querySelector(`#${forId}`)).toBeInTheDocument();
    });
    expect(labels.length).toBe(2);
  });

  it('groups preset buttons with an accessible name', () => {
    const { container } = render(<DateRangeFilter onChange={vi.fn()} />);
    const group = container.querySelector('[role="group"]');
    expect(group).toHaveAttribute('aria-label');
  });

  it('all focusable elements are visible', () => {
    const { container } = render(<DateRangeFilter onChange={vi.fn()} />);
    const focusable = container.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThanOrEqual(5); // 2 inputs + 3 buttons
    focusable.forEach((el) => expect(el).toBeVisible());
  });
});
