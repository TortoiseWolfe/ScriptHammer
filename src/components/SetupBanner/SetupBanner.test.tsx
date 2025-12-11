import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupBanner } from './SetupBanner';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
  isSupabaseConfigured: vi.fn(() => false),
}));

// Mock sessionStorage
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('SetupBanner', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockSessionStorage.clear();
  });

  describe('Rendering', () => {
    it('should render the banner with default message', () => {
      render(<SetupBanner show={true} />);

      expect(screen.getByTestId('setup-banner')).toBeInTheDocument();
      expect(
        screen.getByText(/Supabase is not configured/i)
      ).toBeInTheDocument();
    });

    it('should render with custom message', () => {
      render(<SetupBanner show={true} message="Custom setup message" />);

      expect(screen.getByText('Custom setup message')).toBeInTheDocument();
    });

    it('should render setup guide link with default URL', () => {
      render(<SetupBanner show={true} />);

      const link = screen.getByText('View setup guide');
      expect(link).toHaveAttribute(
        'href',
        'https://github.com/TortoiseWolfe/ScriptHammer#supabase-setup'
      );
    });

    it('should render setup guide link with custom URL', () => {
      render(<SetupBanner show={true} docsUrl="https://custom-docs.com" />);

      const link = screen.getByText('View setup guide');
      expect(link).toHaveAttribute('href', 'https://custom-docs.com');
    });

    it('should not render link when docsUrl is empty', () => {
      render(<SetupBanner show={true} docsUrl="" />);

      expect(screen.queryByText('View setup guide')).not.toBeInTheDocument();
    });
  });

  describe('Dismissal', () => {
    it('should not render when show prop is false', () => {
      render(<SetupBanner show={false} />);

      expect(screen.queryByTestId('setup-banner')).not.toBeInTheDocument();
    });

    it('should dismiss banner when close button is clicked', () => {
      render(<SetupBanner show={true} />);

      const dismissButton = screen.getByRole('button', {
        name: /dismiss setup banner/i,
      });
      fireEvent.click(dismissButton);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'supabase_setup_banner_dismissed',
        'true'
      );
    });

    it('should not render when previously dismissed in session', () => {
      mockSessionStorage.getItem.mockReturnValue('true');

      render(<SetupBanner />);

      // Banner should not appear because it was dismissed
      expect(screen.queryByTestId('setup-banner')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert"', () => {
      render(<SetupBanner show={true} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live="polite"', () => {
      render(<SetupBanner show={true} />);

      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible dismiss button', () => {
      render(<SetupBanner show={true} />);

      const button = screen.getByRole('button', {
        name: /dismiss setup banner/i,
      });
      expect(button).toBeInTheDocument();
    });

    it('should hide decorative icons from screen readers', () => {
      const { container } = render(<SetupBanner show={true} />);

      // SVGs with aria-hidden="true" should not be accessible to screen readers
      const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(svgs.length).toBeGreaterThan(0);
      // Verify the alert itself is accessible
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
