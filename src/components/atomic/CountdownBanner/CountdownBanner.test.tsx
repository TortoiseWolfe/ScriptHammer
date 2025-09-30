import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Next.js router (required for useRouter hook)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { CountdownBanner } from './CountdownBanner';

describe('CountdownBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders countdown timer', () => {
    const { container } = render(<CountdownBanner />);
    // Verify countdown class exists (DaisyUI component)
    expect(container.querySelector('.countdown')).toBeInTheDocument();
  });

  it('renders promotional content', () => {
    render(<CountdownBanner />);
    expect(screen.getByText('$321/year')).toBeInTheDocument();
    expect(screen.getByText('Book Now')).toBeInTheDocument();
  });

  it('persists dismissal with timestamp', () => {
    render(<CountdownBanner />);
    const dismissButton = screen.getByLabelText(/dismiss/i);
    fireEvent.click(dismissButton);
    const dismissedAt = localStorage.getItem('countdown-dismissed');
    expect(dismissedAt).toBeTruthy();
    expect(parseInt(dismissedAt!, 10)).toBeGreaterThan(Date.now() - 1000);
  });
});
