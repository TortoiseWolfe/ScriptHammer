import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ReAuthModal } from './ReAuthModal';

expect.extend(toHaveNoViolations);

// Mock the key service
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    needsMigration: vi.fn(),
    deriveKeys: vi.fn(),
    hasKeys: vi.fn().mockResolvedValue(true),
    initializeKeys: vi.fn(),
  },
}));

// Mock AuthContext - email user by default
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      app_metadata: { provider: 'email' },
      identities: [{ provider: 'email' }],
    },
  })),
}));

// Mock OAuth utils - not OAuth user
vi.mock('@/lib/auth/oauth-utils', () => ({
  isOAuthUser: vi.fn(() => false),
  getOAuthProvider: vi.fn(() => null),
}));

describe('ReAuthModal Accessibility', () => {
  const defaultProps = {
    isOpen: true,
    onSuccess: vi.fn(),
    onClose: vi.fn(),
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(<ReAuthModal {...defaultProps} />);

    // Wait for the form to load after checking keys
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Unlock Messages' })
      ).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper modal role and attributes', async () => {
    render(<ReAuthModal {...defaultProps} />);

    // Wait for the form to load
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Unlock Messages' })
      ).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Re-authentication required');
    expect(dialog).toHaveAttribute('aria-describedby', 'reauth-description');
  });

  it('should have accessible description', async () => {
    render(<ReAuthModal {...defaultProps} />);

    // Wait for the async state to settle after checking keys
    await waitFor(() => {
      const description = screen.getByText(/Your session has been restored/);
      expect(description).toHaveAttribute('id', 'reauth-description');
    });
  });

  it('should have properly labeled password input', async () => {
    render(<ReAuthModal {...defaultProps} />);

    // Wait for the async state to settle after checking keys
    await waitFor(() => {
      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });
  });

  it('should have accessible show/hide password toggle', async () => {
    render(<ReAuthModal {...defaultProps} />);

    await waitFor(() => {
      const toggleButton = screen.getByRole('button', {
        name: 'Show password',
      });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('type', 'button');
    });
  });

  it('should have accessible close button', async () => {
    render(<ReAuthModal {...defaultProps} />);

    await waitFor(() => {
      const closeButton = screen.getByRole('button', { name: 'Close modal' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('type', 'button');
    });
  });

  it('should have accessible submit button', async () => {
    render(<ReAuthModal {...defaultProps} />);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', {
        name: 'Unlock Messages',
      });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });

  it('should have accessible cancel button', async () => {
    render(<ReAuthModal {...defaultProps} />);

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toHaveAttribute('type', 'button');
    });
  });

  it('should meet minimum touch target size (44x44px)', async () => {
    render(<ReAuthModal {...defaultProps} />);

    await waitFor(() => {
      // Check submit button
      const submitButton = screen.getByRole('button', {
        name: 'Unlock Messages',
      });
      expect(submitButton).toHaveClass('min-h-11');

      // Check cancel button
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toHaveClass('min-h-11');

      // Check password input
      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveClass('min-h-11');
    });
  });

  it('should have focus visible on interactive elements', async () => {
    render(<ReAuthModal {...defaultProps} />);

    await waitFor(() => {
      const passwordInput = screen.getByLabelText('Password');
      passwordInput.focus();
      expect(document.activeElement).toBe(passwordInput);
    });
  });

  it('should not have violations when showing error', async () => {
    const { container } = render(<ReAuthModal {...defaultProps} />);

    // Wait for the form to load
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Unlock Messages' })
      ).toBeInTheDocument();
    });

    // Trigger form submission with empty password to show error
    const submitButton = screen.getByRole('button', {
      name: 'Unlock Messages',
    });
    submitButton.click();

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
