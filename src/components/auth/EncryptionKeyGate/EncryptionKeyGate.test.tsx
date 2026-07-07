import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EncryptionKeyGate from './EncryptionKeyGate';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockHasKeysForUser = vi.fn();
const mockGetCurrentKeys = vi.fn();
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    hasKeysForUser: (...args: unknown[]) => mockHasKeysForUser(...args),
    restoreKeysFromCache: () => Promise.resolve(false),
    getCurrentKeys: () => mockGetCurrentKeys(),
  },
}));

// Capture ReAuthModal props to assert isOpen wiring
const reAuthProps: { isOpen: boolean; onSuccess: () => void }[] = [];
vi.mock('@/components/auth/ReAuthModal', () => ({
  ReAuthModal: (props: { isOpen: boolean; onSuccess: () => void }) => {
    reAuthProps.push(props);
    return props.isOpen ? <div data-testid="reauth-modal-mock" /> : null;
  },
}));

describe('EncryptionKeyGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reAuthProps.length = 0;
    // Default: authenticated user, auth loading complete
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      isLoading: false,
    });
  });

  it('shows loading overlay while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    expect(
      screen.getByTestId('encryption-key-gate-loading')
    ).toBeInTheDocument();
    // Children render behind the overlay (not blocked)
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('shows loading overlay while checking keys', () => {
    mockHasKeysForUser.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    expect(
      screen.getByTestId('encryption-key-gate-loading')
    ).toBeInTheDocument();
    // Children render behind the overlay
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('redirects to /messages/setup when no keys in database', async () => {
    mockHasKeysForUser.mockResolvedValue(false);
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/messages/setup');
    });
    // Children render behind the overlay (redirect is client-side)
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('shows ReAuthModal when keys in DB but not in memory', async () => {
    mockHasKeysForUser.mockResolvedValue(true);
    mockGetCurrentKeys.mockReturnValue(null);
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(screen.getByTestId('reauth-modal-mock')).toBeInTheDocument();
    });
    // Children render behind the modal
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  it('renders children directly when keys are in memory', async () => {
    mockHasKeysForUser.mockResolvedValue(true);
    mockGetCurrentKeys.mockReturnValue({ privateKey: {}, publicKey: {} });
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(screen.getByText('Protected')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('reauth-modal-mock')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('closes ReAuthModal on successful re-auth', async () => {
    mockHasKeysForUser.mockResolvedValue(true);
    mockGetCurrentKeys.mockReturnValue(null);
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(screen.getByTestId('reauth-modal-mock')).toBeInTheDocument();
    });

    // Last captured props have the live onSuccess
    reAuthProps[reAuthProps.length - 1].onSuccess();

    await waitFor(() => {
      expect(screen.queryByTestId('reauth-modal-mock')).not.toBeInTheDocument();
    });
  });
});
