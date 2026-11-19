/**
 * Unit tests for resolveAvatarUrl (#1514).
 *
 * The case that matters is the second one: the profile row exists and says "no
 * avatar" while the auth-metadata mirror still holds an address. That is the
 * state a half-finished remove leaves behind, and showing it asks storage for a
 * deleted file (HTTP 400, which WebKit logs as a console error).
 */

import { describe, it, expect } from 'vitest';
import { resolveAvatarUrl } from '../resolve';

const PROFILE_URL = 'http://storage.test/avatars/u1/new.webp';
const MIRROR_URL = 'http://storage.test/avatars/u1/gone.webp';

describe('resolveAvatarUrl', () => {
  it('shows the profile avatar when there is one', () => {
    expect(
      resolveAvatarUrl(
        { profile: { avatar_url: PROFILE_URL }, loading: false },
        MIRROR_URL
      )
    ).toBe(PROFILE_URL);
  });

  it('ignores the mirror when the profile row says there is no avatar', () => {
    expect(
      resolveAvatarUrl(
        { profile: { avatar_url: null }, loading: false },
        MIRROR_URL
      )
    ).toBeNull();
  });

  it('shows nothing while the profile is loading, even if the mirror has an address', () => {
    expect(
      resolveAvatarUrl({ profile: null, loading: true }, MIRROR_URL)
    ).toBeNull();
  });

  it('uses the mirror only when the account has no profile row (OAuth first sign-in)', () => {
    expect(
      resolveAvatarUrl({ profile: null, loading: false }, MIRROR_URL)
    ).toBe(MIRROR_URL);
  });

  it('returns null when the mirror is missing or not a string', () => {
    expect(
      resolveAvatarUrl({ profile: null, loading: false }, undefined)
    ).toBeNull();
    expect(resolveAvatarUrl({ profile: null, loading: false }, 42)).toBeNull();
    expect(resolveAvatarUrl({ profile: null, loading: false }, '')).toBeNull();
  });
});
