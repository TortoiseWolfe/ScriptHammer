/**
 * Unit Tests: useAuth Hook
 * Tests the useAuth hook and AuthProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: null },
          error: null,
        })
      ),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
      signUp: vi.fn(() =>
        Promise.resolve({
          data: { user: null, session: null },
          error: null,
        })
      ),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({
          data: { user: null, session: null },
          error: null,
        })
      ),
      signOut: vi.fn(() =>
        Promise.resolve({
          error: null,
        })
      ),
      refreshSession: vi.fn(() =>
        Promise.resolve({
          data: { session: null },
          error: null,
        })
      ),
    },
  })),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });

  it('should provide initial auth state', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should call signUp with correct parameters', async () => {
    const mockSignUp = vi.fn(() =>
      Promise.resolve({
        data: { user: null, session: null },
        error: null,
      })
    );

    // Mock before rendering
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signUp: mockSignUp,
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.signUp('test@example.com', 'password123');

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: expect.stringContaining('/auth/callback'),
      },
    });
  });

  it('should call signIn with correct parameters', async () => {
    const mockSignIn = vi.fn(() =>
      Promise.resolve({
        data: { user: null, session: null },
        error: null,
      })
    );

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: mockSignIn,
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.signIn('test@example.com', 'password123');

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should call signOut', async () => {
    const mockSignOut = vi.fn(() =>
      Promise.resolve({
        error: null,
      })
    );

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signOut: mockSignOut,
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.signOut();

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should handle auth state changes', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    const mockSession = {
      user: mockUser,
      access_token: 'token',
      refresh_token: 'refresh',
    };

    let authStateCallback: any;

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn((callback) => {
          authStateCallback = callback;
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          };
        }),
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Trigger auth state change
    authStateCallback('SIGNED_IN', mockSession);

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('should refresh session', async () => {
    const mockRefreshSession = vi.fn(() =>
      Promise.resolve({
        data: {
          session: {
            user: { id: 'user-123' },
            access_token: 'new-token',
          },
        },
        error: null,
      })
    );

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        refreshSession: mockRefreshSession,
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refreshSession();

    expect(mockRefreshSession).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Auth error');
    const mockSignIn = vi.fn(() => {
      throw mockError;
    });

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signInWithPassword: mockSignIn,
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const { error } = await result.current.signIn(
      'test@example.com',
      'password123'
    );

    expect(error).toEqual(mockError);
  });
});
