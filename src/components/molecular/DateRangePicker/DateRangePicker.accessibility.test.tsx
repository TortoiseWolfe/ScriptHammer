import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { DateRangePicker } from './DateRangePicker';

const noop = () => {};

describe('DateRangePicker Accessibility', () => {
  it('should have no accessibility violations (empty range)', async () => {
    const { container } = render(
      <DateRangePicker value={{ from: null, to: null }} onChange={noop} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (populated range)', async () => {
    const { container } = render(
      <DateRangePicker
        value={{
          from: new Date('2025-06-01'),
          to: new Date('2025-06-30'),
        }}
        onChange={noop}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('date inputs have accessible names', () => {
    const { getByLabelText } = render(
      <DateRangePicker value={{ from: null, to: null }} onChange={noop} />
    );
    expect(getByLabelText(/from/i)).toBeInTheDocument();
    expect(getByLabelText(/to/i)).toBeInTheDocument();
  });

  it('preset group has accessible label', () => {
    const { getByRole } = render(
      <DateRangePicker value={{ from: null, to: null }} onChange={noop} />
    );
    expect(
      getByRole('group', { name: /date range presets/i })
    ).toBeInTheDocument();
  });

  it('all interactive elements meet 44px touch target (min-h-11)', () => {
    const { container } = render(
      <DateRangePicker value={{ from: null, to: null }} onChange={noop} />
    );
    const interactive = container.querySelectorAll('input, button');
    interactive.forEach((el) => {
      expect(el.className).toContain('min-h-11');
    });
  });
});
