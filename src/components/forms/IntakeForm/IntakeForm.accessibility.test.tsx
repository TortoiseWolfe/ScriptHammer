import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import IntakeForm from './IntakeForm';

describe('IntakeForm accessibility', () => {
  it('has no violations at rest', async () => {
    const { container } = render(<IntakeForm onSubmit={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations while showing errors', async () => {
    // The error state is the one users in trouble actually experience.
    const u = userEvent.setup();
    const { container } = render(<IntakeForm onSubmit={vi.fn()} />);
    await u.click(screen.getByRole('button', { name: /continue|pay/i }));
    await waitFor(() =>
      expect(screen.getByText(/Phone is required/)).toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('points each field at its own error message', async () => {
    const u = userEvent.setup();
    render(<IntakeForm onSubmit={vi.fn()} />);
    await u.click(screen.getByRole('button', { name: /continue|pay/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Phone/)).toHaveAttribute(
        'aria-describedby',
        'phone-error'
      )
    );
  });

  it('meets the 44px touch target on the submit button', () => {
    render(<IntakeForm onSubmit={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /continue|pay/i }).className
    ).toMatch(/min-h-11/);
  });
});
