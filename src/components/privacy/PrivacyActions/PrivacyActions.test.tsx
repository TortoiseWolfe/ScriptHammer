import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyActions } from './PrivacyActions';

const mockOpenModal = vi.fn();
vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({ openModal: mockOpenModal }),
}));

beforeEach(() => mockOpenModal.mockClear());

describe('PrivacyActions', () => {
  it('renders a labelled navigation region', () => {
    // The label is what distinguishes this nav from every other one on the page for a
    // screen-reader user cycling landmarks.
    render(<PrivacyActions />);
    expect(
      screen.getByRole('navigation', { name: /Privacy policy actions/i })
    ).toBeInTheDocument();
  });

  it('opens the consent modal when the button is pressed', async () => {
    const user = userEvent.setup();
    render(<PrivacyActions />);
    await user.click(
      screen.getByRole('button', { name: /manage cookie preferences/i })
    );
    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  it('does not open the modal without a click', () => {
    // Anti-vacuity for the test above: without this, a component that called openModal
    // on render would satisfy it.
    render(<PrivacyActions />);
    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it('links onward to /cookies', () => {
    render(<PrivacyActions />);
    expect(
      screen.getByRole('link', { name: /View Cookie Policy/i })
    ).toHaveAttribute('href', '/cookies');
  });

  it('renders 1 outbound link(s)', () => {
    render(<PrivacyActions />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
