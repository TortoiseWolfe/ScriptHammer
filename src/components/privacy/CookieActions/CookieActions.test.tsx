import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CookieActions } from './CookieActions';

const mockOpenModal = vi.fn();
vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({ openModal: mockOpenModal }),
}));

beforeEach(() => mockOpenModal.mockClear());

describe('CookieActions', () => {
  it('renders a labelled navigation region', () => {
    // The label is what distinguishes this nav from every other one on the page for a
    // screen-reader user cycling landmarks.
    render(<CookieActions />);
    expect(
      screen.getByRole('navigation', { name: /Cookie policy actions/i })
    ).toBeInTheDocument();
  });

  it('opens the consent modal when the button is pressed', async () => {
    const user = userEvent.setup();
    render(<CookieActions />);
    await user.click(
      screen.getByRole('button', { name: /manage cookie preferences/i })
    );
    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  it('does not open the modal without a click', () => {
    // Anti-vacuity for the test above: without this, a component that called openModal
    // on render would satisfy it.
    render(<CookieActions />);
    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('links onward to /privacy', () => {
    render(<CookieActions />);
    expect(
      screen.getByRole('link', { name: /View Privacy Policy/i })
    ).toHaveAttribute('href', '/privacy');
  });

  it('renders 2 outbound link(s)', () => {
    render(<CookieActions />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});
