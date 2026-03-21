import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EncryptionKeyGate from './EncryptionKeyGate';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockHasKeys = vi.fn();
const mockGetCurrentKeys = vi.fn();
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    hasKeys: () => mockHasKeys(),
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
  });

  it('shows loading spinner while checking keys', () => {
    mockHasKeys.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    expect(
      screen.getByTestId('encryption-key-gate-loading')
    ).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('redirects to /messages/setup when no keys in database', async () => {
    mockHasKeys.mockResolvedValue(false);
    render(
      <EncryptionKeyGate>
        <div>Protected</div>
      </EncryptionKeyGate>
    );
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/messages/setup');
    });
    // Children never render on the redirect path
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('shows ReAuthModal when keys in DB but not in memory', async () => {
    mockHasKeys.mockResolvedValue(true);
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
    mockHasKeys.mockResolvedValue(true);
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
    mockHasKeys.mockResolvedValue(true);
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
