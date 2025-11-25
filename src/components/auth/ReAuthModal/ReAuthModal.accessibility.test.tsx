import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ReAuthModal } from './ReAuthModal';

expect.extend(toHaveNoViolations);

// Mock the key service
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    needsMigration: vi.fn(),
    deriveKeys: vi.fn(),
  },
}));

describe('ReAuthModal Accessibility', () => {
  const defaultProps = {
    isOpen: true,
    onSuccess: vi.fn(),
    onClose: vi.fn(),
  };

  it('should have no accessibility violations', async () => {
    const { container } = render(<ReAuthModal {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper modal role and attributes', () => {
    render(<ReAuthModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Re-authentication required');
    expect(dialog).toHaveAttribute('aria-describedby', 'reauth-description');
  });

  it('should have accessible description', () => {
    render(<ReAuthModal {...defaultProps} />);

    const description = screen.getByText(/Your session has been restored/);
    expect(description).toHaveAttribute('id', 'reauth-description');
  });

  it('should have properly labeled password input', () => {
    render(<ReAuthModal {...defaultProps} />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  it('should have accessible show/hide password toggle', () => {
    render(<ReAuthModal {...defaultProps} />);

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('type', 'button');
  });

  it('should have accessible close button', () => {
    render(<ReAuthModal {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: 'Close modal' });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveAttribute('type', 'button');
  });

  it('should have accessible submit button', () => {
    render(<ReAuthModal {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Unlock' });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('should have accessible cancel button', () => {
    render(<ReAuthModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveAttribute('type', 'button');
  });

  it('should meet minimum touch target size (44x44px)', () => {
    render(<ReAuthModal {...defaultProps} />);

    // Check submit button
    const submitButton = screen.getByRole('button', { name: 'Unlock' });
    expect(submitButton).toHaveClass('min-h-11');

    // Check cancel button
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toHaveClass('min-h-11');

    // Check password input
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveClass('min-h-11');
  });

  it('should have focus visible on interactive elements', () => {
    render(<ReAuthModal {...defaultProps} />);

    const passwordInput = screen.getByLabelText('Password');
    passwordInput.focus();
    expect(document.activeElement).toBe(passwordInput);
  });

  it('should not have violations when showing error', async () => {
    const { container, rerender } = render(<ReAuthModal {...defaultProps} />);

    // Trigger form submission with empty password to show error
    const submitButton = screen.getByRole('button', { name: 'Unlock' });
    submitButton.click();

    // Wait for error to appear
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Re-render to get error state
    rerender(<ReAuthModal {...defaultProps} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
