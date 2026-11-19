import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

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

  it('is never "loaded with no profile" when the same user signs out and back in', async () => {
    const row = (id: string) => ({
      data: {
        id,
        username: null,
        display_name: null,
        avatar_url: null,
        bio: null,
        created_at: '',
        updated_at: '',
      },
      error: null,
    });
    mocks.single.mockResolvedValue(row('u1'));
    mocks.user = { id: 'u1' };

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
    await waitFor(() => expect(renders.at(-1)?.hasProfile).toBe(true));

    // Sign out, with no page reload in between.
    mocks.user = null;
    rerender();
    await waitFor(() => expect(renders.at(-1)?.hasProfile).toBe(false));

    // Sign back in as the SAME user. Only renders from here on count.
    const before = renders.length;
    mocks.user = { id: 'u1' };
    rerender();
    await waitFor(() => expect(renders.at(-1)?.hasProfile).toBe(true));

    const looksLikeNoProfile = renders
      .slice(before)
      .filter((r) => r.hasUser && !r.loading && !r.hasProfile);
    expect(looksLikeNoProfile).toEqual([]);
  });

  it('ignores a slow fetch for a user who is no longer signed in', async () => {
    const profile = (id: string, name: string) => ({
      data: {
        id,
        username: name,
        display_name: null,
        avatar_url: null,
        bio: null,
        created_at: '',
        updated_at: '',
      },
      error: null,
    });
    let finishA: (value: unknown) => void = () => {};
    mocks.single.mockReturnValueOnce(
      new Promise((resolve) => {
        finishA = resolve;
      })
    );
    mocks.single.mockResolvedValueOnce(profile('uB', 'user-b'));

    mocks.user = { id: 'uA' };
    const { result, rerender } = renderHook(() => useUserProfile());

    // User B replaces user A while A's fetch is still in flight.
    mocks.user = { id: 'uB' };
    rerender();
    await waitFor(() =>
      expect(result.current.profile?.username).toBe('user-b')
    );

    // A's fetch now finishes late. It must not replace B's profile.
    await act(async () => {
      finishA(profile('uA', 'user-a'));
    });
    expect(result.current.profile?.username).toBe('user-b');
    expect(result.current.loading).toBe(false);
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
