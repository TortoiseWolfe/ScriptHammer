import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReAuthModal } from './ReAuthModal';

// Mock the key service
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    needsMigration: vi.fn(),
    deriveKeys: vi.fn(),
  },
}));

describe('ReAuthModal', () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <ReAuthModal
          isOpen={false}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Unlock Messaging')).toBeInTheDocument();
    });

    it('should render password input', () => {
      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Enter your password')
      ).toBeInTheDocument();
    });

    it('should render unlock button', () => {
      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByRole('button', { name: 'Unlock' })
      ).toBeInTheDocument();
    });

    it('should render close button when onClose is provided', () => {
      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByRole('button', { name: 'Close modal' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Cancel' })
      ).toBeInTheDocument();
    });

    it('should not render close/cancel buttons when onClose is not provided', () => {
      render(<ReAuthModal isOpen={true} onSuccess={mockOnSuccess} />);

      expect(
        screen.queryByRole('button', { name: 'Close modal' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Cancel' })
      ).not.toBeInTheDocument();
    });
  });

  describe('Password visibility toggle', () => {
    it('should show password when show button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const showButton = screen.getByRole('button', { name: 'Show password' });
      await user.click(showButton);

      expect(passwordInput).toHaveAttribute('type', 'text');
    });

    it('should hide password when hide button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      const showButton = screen.getByRole('button', { name: 'Show password' });

      await user.click(showButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      const hideButton = screen.getByRole('button', { name: 'Hide password' });
      await user.click(hideButton);

      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form validation', () => {
    it('should show error when submitting with empty password', async () => {
      const user = userEvent.setup();

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      expect(
        screen.getByText('Please enter your password')
      ).toBeInTheDocument();
    });
  });

  describe('Keyboard interactions', () => {
    it('should call onClose when Escape is pressed', () => {
      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backdrop click', () => {
    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      // Click backdrop (the outer div)
      const backdrop = screen.getByRole('presentation');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when dialog content is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const dialog = screen.getByRole('dialog');
      await user.click(dialog);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Successful re-authentication', () => {
    it('should call onSuccess when password is correct', async () => {
      const user = userEvent.setup();
      const { keyManagementService } = await import(
        '@/services/messaging/key-service'
      );

      vi.mocked(keyManagementService.needsMigration).mockResolvedValue(false);
      vi.mocked(keyManagementService.deriveKeys).mockResolvedValue({} as any);

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'correct-password');

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      await waitFor(() => {
        expect(keyManagementService.deriveKeys).toHaveBeenCalledWith(
          'correct-password'
        );
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('should clear password after successful re-auth', async () => {
      const user = userEvent.setup();
      const { keyManagementService } = await import(
        '@/services/messaging/key-service'
      );

      vi.mocked(keyManagementService.needsMigration).mockResolvedValue(false);
      vi.mocked(keyManagementService.deriveKeys).mockResolvedValue({} as any);

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'test-password');

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      await waitFor(() => {
        expect(passwordInput).toHaveValue('');
      });
    });
  });

  describe('Error handling', () => {
    it('should show error for incorrect password', async () => {
      const user = userEvent.setup();
      const { keyManagementService } = await import(
        '@/services/messaging/key-service'
      );

      vi.mocked(keyManagementService.needsMigration).mockResolvedValue(false);
      vi.mocked(keyManagementService.deriveKeys).mockRejectedValue(
        new Error('Key mismatch')
      );

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'wrong-password');

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      await waitFor(() => {
        expect(
          screen.getByText('Incorrect password. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should show migration message for legacy users', async () => {
      const user = userEvent.setup();
      const { keyManagementService } = await import(
        '@/services/messaging/key-service'
      );

      vi.mocked(keyManagementService.needsMigration).mockResolvedValue(true);

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'any-password');

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Your account needs to be updated. Please sign out and sign back in.'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner when unlocking', async () => {
      const user = userEvent.setup();
      const { keyManagementService } = await import(
        '@/services/messaging/key-service'
      );

      // Create a promise that we can control
      let resolveDerive: () => void;
      const derivePromise = new Promise<void>((resolve) => {
        resolveDerive = resolve;
      });

      vi.mocked(keyManagementService.needsMigration).mockResolvedValue(false);
      vi.mocked(keyManagementService.deriveKeys).mockReturnValue(
        derivePromise as any
      );

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'test-password');

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      // Should show loading spinner - button changes to spinner so check for submit button disabled
      const submitButton = screen.getByRole('button', { name: '' });
      expect(submitButton).toBeDisabled();

      // Resolve the promise
      resolveDerive!();
    });

    it('should disable inputs while loading', async () => {
      const user = userEvent.setup();
      const { keyManagementService } = await import(
        '@/services/messaging/key-service'
      );

      let resolveDerive: () => void;
      const derivePromise = new Promise<void>((resolve) => {
        resolveDerive = resolve;
      });

      vi.mocked(keyManagementService.needsMigration).mockResolvedValue(false);
      vi.mocked(keyManagementService.deriveKeys).mockReturnValue(
        derivePromise as any
      );

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'test-password');

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      // Password input should be disabled
      expect(passwordInput).toBeDisabled();

      // Cancel button should be disabled
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

      resolveDerive!();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute(
        'aria-label',
        'Re-authentication required'
      );
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-describedby', 'reauth-description');
    });

    it('should have description text', () => {
      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByText(/Your session has been restored/)
      ).toBeInTheDocument();
    });

    it('should have error announced by screen reader', async () => {
      const user = userEvent.setup();

      render(
        <ReAuthModal
          isOpen={true}
          onSuccess={mockOnSuccess}
          onClose={mockOnClose}
        />
      );

      const unlockButton = screen.getByRole('button', { name: 'Unlock' });
      await user.click(unlockButton);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });
  });
});
