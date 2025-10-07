import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import IdleTimeoutModal from './IdleTimeoutModal';

describe('IdleTimeoutModal Accessibility', () => {
  it('should have no accessibility violations when open', async () => {
    const { container } = render(
      <IdleTimeoutModal
        isOpen={true}
        timeRemaining={60}
        onContinue={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels for buttons', () => {
    const { getByRole } = render(
      <IdleTimeoutModal
        isOpen={true}
        timeRemaining={60}
        onContinue={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    expect(
      getByRole('button', { name: /continue session/i })
    ).toBeInTheDocument();
    expect(getByRole('button', { name: /sign out now/i })).toBeInTheDocument();
  });

  it('should have timer role for countdown', () => {
    const { getByRole } = render(
      <IdleTimeoutModal
        isOpen={true}
        timeRemaining={60}
        onContinue={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    const timer = getByRole('timer');
    expect(timer).toHaveAttribute('aria-live', 'polite');
  });
});
