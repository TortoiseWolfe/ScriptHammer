import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { AdminGate } from './AdminGate';

/**
 * Regression coverage for the safety properties documented at the top of
 * AdminGate.tsx. Three of these properties were removed/regressed three
 * times in `ProtectedRoute` (commits 6b4c13a, 2c97e67, 259b38d) before the
 * fix landed; without coverage at this layer, a future refactor can
 * silently strip the same defenses from `AdminGate` and the bug returns.
 *
 * The cases below pin:
 *   - The pre-resolution loading spinner (no false render of children).
 *   - The `wasAdmin` ref debounce against a transient admin→null flip.
 *   - The `cancelled` flag preventing post-unmount setState.
 *   - The dep-array re-running checkIsAdmin when `user.id` changes.
 *   - The "no children, no redirect spam" terminal state for non-admins.
 *
 * Mocking strategy mirrors ProtectedRoute.test.tsx: override the global
 * AuthContext mock with a per-test reconfigurable object, mock
 * next/navigation router, mock AdminAuthService at the module boundary
 * so the component's `new AdminAuthService(supabase)` call resolves to
 * our controllable spy.
 */

const mockAuth = {
  user: null as Pick<User, 'id'> | null,
  session: null as { access_token: string } | null,
  isLoading: false,
  isAuthenticated: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockPush = vi.fn();
// Stable router object identity across renders. AdminGate's effect lists
// `router` in its dep array, so an unstable identity would re-fire the
// effect on every render and inflate the call count.
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}));

const mockCheckIsAdmin = vi.fn<(userId: string) => Promise<boolean>>();
vi.mock('@/services/admin', () => ({
  AdminAuthService: vi.fn().mockImplementation(() => ({
    checkIsAdmin: mockCheckIsAdmin,
  })),
}));

describe('AdminGate', () => {
  beforeEach(() => {
    mockAuth.user = { id: 'user-A' } as User;
    mockAuth.session = { access_token: 'token' };
    mockAuth.isLoading = false;
    mockAuth.isAuthenticated = true;
    mockPush.mockClear();
    mockCheckIsAdmin.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the loading spinner while authLoading is true', () => {
    mockAuth.isLoading = true;
    const { container } = render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    expect(container.querySelector('.loading-spinner')).not.toBeNull();
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('renders the loading spinner while the admin check is in flight', () => {
    // Promise that never resolves — the check is still running.
    mockCheckIsAdmin.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    expect(container.querySelector('.loading-spinner')).not.toBeNull();
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('renders children when the admin check resolves true', async () => {
    mockCheckIsAdmin.mockResolvedValue(true);
    render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    await waitFor(() =>
      expect(screen.getByText('admin content')).toBeInTheDocument()
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to / when the admin check resolves false on first mount', async () => {
    mockCheckIsAdmin.mockResolvedValue(false);
    render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('admin content')).toBeNull();
  });

  it('does NOT redirect on a transient admin→non-admin flip after the user was already admin (wasAdmin.current debounce)', async () => {
    // First mount sees admin=true.
    mockCheckIsAdmin.mockResolvedValueOnce(true);
    const { rerender } = render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    await waitFor(() =>
      expect(screen.getByText('admin content')).toBeInTheDocument()
    );
    expect(mockPush).not.toHaveBeenCalled();

    // Simulate a transient flip: same user, but the next admin check
    // resolves false (e.g. RLS hiccup during token refresh). Trigger a
    // re-run by toggling user identity to and from a different ref while
    // keeping the same user.id is hard, so instead use a fresh user.id —
    // representing the "user changed mid-mount" branch — and prove that
    // even then, wasAdmin.current keeps the redirect from firing.
    mockCheckIsAdmin.mockResolvedValueOnce(false);
    mockAuth.user = { id: 'user-B' } as User;
    rerender(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    // Let the second check resolve.
    await waitFor(() => expect(mockCheckIsAdmin).toHaveBeenCalledTimes(2));

    // wasAdmin.current was set true on the first resolution; the second
    // resolution lands false but must NOT push to '/'.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('re-runs checkIsAdmin when user.id changes (dep-array integrity)', async () => {
    mockCheckIsAdmin.mockResolvedValue(true);
    const { rerender } = render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    await waitFor(() => expect(mockCheckIsAdmin).toHaveBeenCalledTimes(1));
    expect(mockCheckIsAdmin).toHaveBeenLastCalledWith('user-A');

    mockAuth.user = { id: 'user-B' } as User;
    rerender(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    await waitFor(() => expect(mockCheckIsAdmin).toHaveBeenCalledTimes(2));
    expect(mockCheckIsAdmin).toHaveBeenLastCalledWith('user-B');
  });

  it('does not call setIsAdmin after unmount (cancelled flag)', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Promise we resolve manually so we can unmount mid-flight.
    let resolveCheck!: (admin: boolean) => void;
    mockCheckIsAdmin.mockImplementation(
      () => new Promise<boolean>((res) => (resolveCheck = res))
    );

    const { unmount } = render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    // Effect has fired and is awaiting the promise.
    expect(mockCheckIsAdmin).toHaveBeenCalledTimes(1);

    unmount();
    // Now resolve the in-flight check after unmount.
    await act(async () => {
      resolveCheck(true);
      // give the microtask queue a turn so the .then would fire if it were going to
      await Promise.resolve();
    });

    // If the cancelled flag works, setState is never called after unmount,
    // so React emits no "can't perform a React state update on an unmounted
    // component" warning.
    const reactWarnings = consoleErrorSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('unmounted component')
    );
    expect(reactWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  it('returns null (renders nothing) when admin check resolves false and never-was-admin', async () => {
    mockCheckIsAdmin.mockResolvedValue(false);
    const { container } = render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    // Container has no admin chrome (the <nav> with admin tabs).
    expect(
      container.querySelector('nav[aria-label="Admin navigation"]')
    ).toBeNull();
  });

  it('does not start the admin check while authLoading is true', () => {
    mockAuth.isLoading = true;
    render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    expect(mockCheckIsAdmin).not.toHaveBeenCalled();
  });

  it('does not start the admin check when user is null', () => {
    mockAuth.user = null;
    render(
      <AdminGate>
        <div>admin content</div>
      </AdminGate>
    );
    expect(mockCheckIsAdmin).not.toHaveBeenCalled();
  });
});
