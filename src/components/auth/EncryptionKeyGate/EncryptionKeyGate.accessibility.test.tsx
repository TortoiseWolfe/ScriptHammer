import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import EncryptionKeyGate from './EncryptionKeyGate';

expect.extend(toHaveNoViolations);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    isLoading: false,
  }),
}));

const mockHasKeys = vi.fn().mockResolvedValue(true);
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    hasKeys: () => mockHasKeys(),
    getCurrentKeys: vi.fn().mockReturnValue({ privateKey: {}, publicKey: {} }),
  },
}));

vi.mock('@/components/auth/ReAuthModal', () => ({
  ReAuthModal: () => null,
}));

describe('EncryptionKeyGate Accessibility', () => {
  it('should have no accessibility violations in loading state', async () => {
    const { container } = render(
      <EncryptionKeyGate>
        <div>Content</div>
      </EncryptionKeyGate>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations after keys resolve', async () => {
    const { container, getByText } = render(
      <EncryptionKeyGate>
        <main>
          <h1>Content</h1>
        </main>
      </EncryptionKeyGate>
    );
    await waitFor(() => expect(getByText('Content')).toBeInTheDocument());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('loading spinner has accessible role and label', () => {
    // Force the promise to stay pending so we catch the loading state
    mockHasKeys.mockReturnValueOnce(new Promise(() => {}));

    const { getByRole } = render(
      <EncryptionKeyGate>
        <div>Content</div>
      </EncryptionKeyGate>
    );
    const spinner = getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Checking encryption keys');
  });
});
