/**
 * AuthProvider must not retry a Supabase client that was never configured.
 *
 * `createDisabledClient()` is a deterministic mock: its `getSession()` resolves
 * instantly to `{ error: 'Supabase not configured' }`, always. Feeding that to
 * `retryWithBackoff(3, [1000, 2000, 4000])` meant a fresh fork spent ~7 seconds
 * retrying something that cannot succeed, held `isLoading` true for all of it, and
 * then logged at ERROR — on top of the SetupBanner that already tells the user
 * exactly what is wrong.
 *
 * Measured on a real rebranded fork with Supabase unconfigured: one console error
 * on every page load, gone after this change, banner still rendering.
 *
 * Lives in its own file because the mock's configured-ness is decided at module
 * scope, and the sibling suite needs it true.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase/client', () => {
  const mockAuth = {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: null,
        error: { message: 'Supabase not configured', status: 503 },
      })
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };
  const mockSupabaseClient = { auth: mockAuth };
  return {
    createClient: vi.fn(() => mockSupabaseClient),
    supabase: mockSupabaseClient,
    setAllowAuthTokenRemoval: vi.fn(),
    isSupabaseConfigured: vi.fn(() => false),
  };
});

vi.unmock('@/contexts/AuthContext');

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

describe('AuthProvider with Supabase unconfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never calls getSession, so there is nothing to retry', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The assertion that pins the fix: the disabled client is not consulted at all.
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it('resolves loading immediately rather than after the ~7s backoff', async () => {
    const started = Date.now();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Generous bound: the point is that it is not waiting on 1s + 2s + 4s of
    // retries, not that it is fast to the millisecond.
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('reports no error, because "not configured yet" is not a failure', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // SetupBanner is the user-facing signal for this state. Setting AUTH_FAILED as
    // well put a project that simply has not been wired up into an error state.
    expect(result.current.error).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });
});
