import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  single: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: mocks.single }),
      }),
    }),
  }),
}));

import { useUserProfile } from './useUserProfile';

describe('useUserProfile', () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.single.mockReset();
  });

  it('is never "loaded with no profile" in the render where the user first appears (#1514)', async () => {
    mocks.single.mockResolvedValue({
      data: {
        id: 'u1',
        username: null,
        display_name: null,
        avatar_url: null,
        bio: null,
        created_at: '',
        updated_at: '',
      },
      error: null,
    });

    // Every render the hook produces, in order. The bug lived in ONE of them:
    // the render right after `user` appears, before the effect starts the fetch.
    const renders: Array<{
      hasUser: boolean;
      loading: boolean;
      hasProfile: boolean;
    }> = [];
    const { rerender } = renderHook(() => {
      const result = useUserProfile();
      renders.push({
        hasUser: mocks.user !== null,
        loading: result.loading,
        hasProfile: result.profile !== null,
      });
      return result;
    });

    // Signed out first: nothing to load.
    await waitFor(() => expect(renders.at(-1)?.loading).toBe(false));

    mocks.user = { id: 'u1' };
    rerender();
    await waitFor(() => expect(renders.at(-1)?.hasProfile).toBe(true));

    const withUser = renders.filter((r) => r.hasUser);
    const looksLikeNoProfile = withUser.filter(
      (r) => !r.loading && !r.hasProfile
    );
    expect(looksLikeNoProfile).toEqual([]);
  });

  it('reports a user with no profile row as loaded once the fetch has settled', async () => {
    mocks.user = { id: 'u2' };
    mocks.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });

    const { result } = renderHook(() => useUserProfile());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
  });

  it('is not loading when nobody is signed in', async () => {
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
  });
});
