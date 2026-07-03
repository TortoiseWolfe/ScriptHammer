/**
 * Unit Tests: useAuth Hook
 * Tests the useAuth hook and AuthProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock Supabase client first (this needs to be hoisted)
vi.mock('@/lib/supabase/client', () => {
  const mockAuth = {
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
  };

  const mockSupabaseClient = { auth: mockAuth };

  return {
    createClient: vi.fn(() => mockSupabaseClient),
    supabase: mockSupabaseClient,
    setAllowAuthTokenRemoval: vi.fn(),
  };
});

// Unmock AuthContext to use real implementation for these unit tests
vi.unmock('@/contexts/AuthContext');

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations to defaults
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    } as any);
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
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.signUp('test@example.com', 'password123');

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: expect.stringContaining('/auth/callback'),
      },
    });
  });

  it('should call signIn with correct parameters', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.signIn('test@example.com', 'password123');

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should call signOut', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.signOut();

    expect(supabase.auth.signOut).toHaveBeenCalled();
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

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
      (callback) => {
        authStateCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        } as any;
      }
    );

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
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.refreshSession();

    expect(supabase.auth.refreshSession).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Auth error');

    vi.mocked(supabase.auth.signInWithPassword).mockRejectedValue(mockError);

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

  describe('basePath-aware redirects (issue #154)', () => {
    const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

    const stubLocation = (pathname: string) => {
      // Repo-standard jsdom location stub (see ReAuthModal.test.tsx) —
      // records href assignments instead of navigating.
      Object.defineProperty(window, 'location', {
        value: {
          href: `http://localhost:3000${pathname}`,
          origin: 'http://localhost:3000',
          pathname,
        },
        writable: true,
        configurable: true,
      });
      return window.location;
    };

    beforeEach(() => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/RescueDogs';
      localStorage.clear();
    });

    afterEach(() => {
      if (originalBasePath === undefined) {
        delete process.env.NEXT_PUBLIC_BASE_PATH;
      } else {
        process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath;
      }
    });

    it('sends a basePath-prefixed emailRedirectTo at sign-up', async () => {
      stubLocation('/RescueDogs/sign-up/');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.signUp('test@example.com', 'password123');

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: 'http://localhost:3000/RescueDogs/auth/callback/',
        },
      });
    });

    it('redirects signOut to the basePath root, not the domain root', async () => {
      const loc = stubLocation('/RescueDogs/profile/');

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.signOut();

      expect(loc.href).toBe('/RescueDogs/');
    });

    it('redirects a real cross-tab SIGNED_OUT to the basePath root', async () => {
      const loc = stubLocation('/RescueDogs/profile/');

      let authStateCallback: any;
      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
        (callback) => {
          authStateCallback = callback;
          return {
            data: { subscription: { unsubscribe: vi.fn() } },
          } as any;
        }
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // No sb-*-auth-token in localStorage, so this SIGNED_OUT is "real"
      await authStateCallback('SIGNED_OUT', null);

      expect(loc.href).toBe('/RescueDogs/');
    });

    it('never redirects a SIGNED_OUT fired on the auth callback page', async () => {
      const loc = stubLocation('/RescueDogs/auth/callback/');
      const hrefBefore = loc.href;

      let authStateCallback: any;
      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
        (callback) => {
          authStateCallback = callback;
          return {
            data: { subscription: { unsubscribe: vi.fn() } },
          } as any;
        }
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // During email confirmation no auth-token exists yet, so a transient
      // SIGNED_OUT passes the validity guard — it must not hijack the
      // callback page (the pre-#154 bounce to the domain root).
      await authStateCallback('SIGNED_OUT', null);

      expect(loc.href).toBe(hrefBefore);
    });
  });
});
