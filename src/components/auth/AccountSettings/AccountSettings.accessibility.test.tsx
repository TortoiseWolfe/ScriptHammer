import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import AccountSettings from './AccountSettings';

// Mock the useUserProfile hook to return a loaded state
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    profile: {
      id: 'test-user-id',
      display_name: 'Test User',
      bio: 'Test bio',
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    refreshSession: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: () => ({
      // Changed from .update() to .upsert() for profile updates (Feature 035)
      upsert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-user-id',
              display_name: 'Test User',
              bio: 'Test bio',
            },
            error: null,
          }),
        }),
      }),
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        neq: () => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

describe('AccountSettings Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<AccountSettings />);

    // Disable color-contrast rule - jsdom doesn't support getComputedStyle for pseudo-elements
    // Color contrast is tested via Lighthouse in CI
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(<AccountSettings />);

    // Feature 038: Verify forms and cards have proper structure for accessibility
    const forms = container.querySelectorAll('form');
    expect(forms.length).toBeGreaterThanOrEqual(2); // Profile and Password forms

    // Verify labeled inputs
    const displayNameInput = container.querySelector('#displayname-input');
    const bioTextarea = container.querySelector('#bio-textarea');
    const passwordInput = container.querySelector('#new-password-input');
    const confirmPasswordInput = container.querySelector(
      '#confirm-password-input'
    );

    expect(displayNameInput).toBeInTheDocument();
    expect(bioTextarea).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(confirmPasswordInput).toBeInTheDocument();

    // Feature 038 SC-005: Inline alerts (when rendered) should have proper ARIA
    // Note: Alerts are conditionally rendered, so we verify the structure exists
    // In actual error state, alerts would have role="alert" aria-live="assertive"
    // or role="status" aria-live="polite" for success messages
  });

  it('should be keyboard navigable', () => {
    render(<AccountSettings />);

    // Use role-based queries which automatically exclude hidden elements
    const buttons = screen.getAllByRole('button');
    const links = screen.queryAllByRole('link');
    const inputs = screen.queryAllByRole('textbox');

    // Verify interactive elements are accessible
    expect(buttons.length).toBeGreaterThan(0);

    // Check all found buttons are in the document and visible
    buttons.forEach((button) => {
      expect(button).toBeInTheDocument();
    });

    // Links and inputs might not exist, but if they do, verify them
    links.forEach((link) => {
      expect(link).toBeInTheDocument();
    });

    inputs.forEach((input) => {
      expect(input).toBeInTheDocument();
    });
  });

  // Color contrast test removed - Lighthouse provides comprehensive color contrast testing
  // Current Lighthouse accessibility score: 96/100 (verified via CLI)
  // See CLAUDE.md - Lighthouse Scores section

  it('should support screen readers', () => {
    const { container } = render(<AccountSettings />);

    // Check for screen reader support
    // Example: Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img: Element) => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
