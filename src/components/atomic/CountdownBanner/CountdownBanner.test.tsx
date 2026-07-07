import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock Next.js router (required for useRouter hook)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { CountdownBanner } from './CountdownBanner';

function mockDate(dateString: string) {
  const fakeNow = new Date(dateString).getTime();
  vi.useFakeTimers({ now: fakeNow, shouldAdvanceTime: true });
}

describe('CountdownBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('during season (Oct 31 - Dec 31)', () => {
    beforeEach(() => {
      mockDate('2025-11-15T12:00:00');
    });

    it('renders countdown timer', () => {
      const { container } = render(<CountdownBanner />);
      const timerText = container.textContent;
      expect(timerText).toMatch(/\d+d\s+\d+h\s+\d+m\s+\d+s/);
    });

    it('renders correct price for 2025 season', () => {
      render(<CountdownBanner />);
      expect(screen.getByText('$432.10/yr')).toBeInTheDocument();
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

  describe('outside season', () => {
    it('returns null in February', () => {
      mockDate('2026-02-08T12:00:00');
      const { container } = render(<CountdownBanner />);
      expect(container.innerHTML).toBe('');
    });

    it('returns null in July', () => {
      mockDate('2025-07-04T12:00:00');
      const { container } = render(<CountdownBanner />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('pricing by year', () => {
    it('shows $543.21/yr for 2026 season', () => {
      mockDate('2026-11-15T12:00:00');
      render(<CountdownBanner />);
      expect(screen.getByText('$543.21/yr')).toBeInTheDocument();
    });

    it('caps at $987.65/yr for 2031+', () => {
      mockDate('2031-11-15T12:00:00');
      render(<CountdownBanner />);
      expect(screen.getByText('$987.65/yr')).toBeInTheDocument();
    });
  });
});
