import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import Sparkline from './Sparkline';

describe('Sparkline Accessibility', () => {
  it('should have no axe violations when decorative (aria-hidden)', async () => {
    const { container } = render(<Sparkline data={[3, 5, 2, 8, 4, 6, 7]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations when labeled (role=img)', async () => {
    const { container } = render(
      <Sparkline data={[3, 5, 2, 8, 4, 6, 7]} label="Logins, last 7 days" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no axe violations in empty state', async () => {
    const { container } = render(<Sparkline data={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
