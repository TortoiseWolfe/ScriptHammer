import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import FallbackPanel from './FallbackPanel';

expect.extend(toHaveNoViolations);

describe('FallbackPanel Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<FallbackPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Retry button is focusable (in the tab order)', () => {
    render(<FallbackPanel />);
    const retry = screen.getByRole('button', {
      name: /retry rendering 3d scene/i,
    });
    expect(retry.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('Retry button has 44px minimum touch target (min-h-11 min-w-44 in DaisyUI = 44px)', () => {
    render(<FallbackPanel />);
    const retry = screen.getByRole('button', {
      name: /retry rendering 3d scene/i,
    });
    expect(retry.className).toContain('min-h-11');
    expect(retry.className).toContain('min-w-44');
  });
});
