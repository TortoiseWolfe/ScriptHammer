import { vi } from 'vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ResendConfirmation from './ResendConfirmation';

expect.extend(toHaveNoViolations);

// tests/setup.ts mocks useAuth with a SIGNED-IN user, and this component renders nothing for
// one. Mock the real production state instead: nobody signed in.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ResendConfirmation Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<ResendConfirmation />);
    expect(container).not.toBeEmptyDOMElement();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('labels its only field and names its button', () => {
    render(<ResendConfirmation />);

    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
    expect(
      screen.getByRole('button', { name: /resend the confirmation email/i })
    ).toBeInTheDocument();
  });

  it('keeps its focusable elements visible and in tab order', () => {
    const { container } = render(<ResendConfirmation />);

    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThan(0);
    focusable.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('announces the outcome through a polite live region that exists before it fills', () => {
    render(<ResendConfirmation />);

    // A region added at the moment of the message is often not announced; this one is
    // always in the tree.
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
