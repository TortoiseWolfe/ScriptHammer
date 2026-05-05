/**
 * OAuth Utility Functions - Unit Tests
 * Tests for OAuth metadata extraction functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
} as unknown as SupabaseClient;

// Mock query builder
const createMockQueryBuilder = (
  data: unknown = null,
  error: unknown = null
) => ({
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error }),
});

// Mock the createClient function BEFORE importing oauth-utils
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Import after mocks are set up
const {
  extractOAuthDisplayName,
  extractOAuthAvatarUrl,
  isOAuthUser,
  getOAuthProvider,
  populateOAuthProfile,
} = await import('./oauth-utils');

// Helper to create mock User objects
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

describe('extractOAuthDisplayName', () => {
  it('returns full_name when available in user_metadata', () => {
    const user = createMockUser({
      user_metadata: { full_name: 'Jon Pohlner' },
    });
    expect(extractOAuthDisplayName(user)).toBe('Jon Pohlner');
  });

  it('returns name when full_name is not available', () => {
    const user = createMockUser({
      user_metadata: { name: 'johndoe' },
    });
    expect(extractOAuthDisplayName(user)).toBe('johndoe');
  });

  it('prefers full_name over name when both are available', () => {
    const user = createMockUser({
      user_metadata: { full_name: 'Jon Pohlner', name: 'johndoe' },
    });
    expect(extractOAuthDisplayName(user)).toBe('Jon Pohlner');
  });

  it('returns email prefix when no full_name or name available', () => {
    const user = createMockUser({
      email: 'user@example.com',
      user_metadata: {},
    });
    expect(extractOAuthDisplayName(user)).toBe('user');
  });

  it('returns "Anonymous User" when user is null', () => {
    expect(extractOAuthDisplayName(null)).toBe('Anonymous User');
  });

  it('returns "Anonymous User" when user has no metadata and no email', () => {
    const user = createMockUser({
      email: undefined,
      user_metadata: {},
    });
    expect(extractOAuthDisplayName(user)).toBe('Anonymous User');
  });

  it('returns "Anonymous User" when email prefix is empty', () => {
    const user = createMockUser({
      email: '@example.com',
      user_metadata: {},
    });
    expect(extractOAuthDisplayName(user)).toBe('Anonymous User');
  });

  it('preserves special characters in full_name', () => {
    const user = createMockUser({
      user_metadata: { full_name: 'José García 🚀' },
    });
    expect(extractOAuthDisplayName(user)).toBe('José García 🚀');
  });

  // Issue #29: GitHub puts the user's @handle in user_name, not name. Without
  // this tier in the cascade, GitHub users with no display name set would
  // fall through to email prefix even though the @handle is a meaningful
  // identifier provided by the OAuth flow.
  describe('issue #29 — extended cascade for GitHub / OIDC providers', () => {
    it('returns user_name when full_name and name are absent (GitHub @handle)', () => {
      const user = createMockUser({
        user_metadata: { user_name: 'octocat' },
      });
      expect(extractOAuthDisplayName(user)).toBe('octocat');
    });

    it('prefers name over user_name (GitHub user with display name set)', () => {
      const user = createMockUser({
        user_metadata: { name: 'The Octocat', user_name: 'octocat' },
      });
      expect(extractOAuthDisplayName(user)).toBe('The Octocat');
    });

    it('returns preferred_username when nothing higher is set (OIDC)', () => {
      const user = createMockUser({
        user_metadata: { preferred_username: 'jsmith' },
      });
      expect(extractOAuthDisplayName(user)).toBe('jsmith');
    });

    it('prefers user_name over preferred_username when both present', () => {
      const user = createMockUser({
        user_metadata: {
          user_name: 'octocat',
          preferred_username: 'fallback',
        },
      });
      expect(extractOAuthDisplayName(user)).toBe('octocat');
    });

    it('skips whitespace-only metadata fields and falls through', () => {
      const user = createMockUser({
        email: 'jsmith@example.com',
        user_metadata: {
          full_name: '   ',
          name: '',
          user_name: '   ',
        },
      });
      expect(extractOAuthDisplayName(user)).toBe('jsmith');
    });

    it('trims surrounding whitespace from a populated tier', () => {
      const user = createMockUser({
        user_metadata: { full_name: '  Jon Pohlner  ' },
      });
      expect(extractOAuthDisplayName(user)).toBe('Jon Pohlner');
    });

    // Realistic Google fixture: full_name + name + avatar_url, no user_name
    it('handles Google OAuth metadata shape', () => {
      const user = createMockUser({
        email: 'jpohlner@gmail.com',
        user_metadata: {
          full_name: 'Jon Pohlner',
          name: 'Jon Pohlner',
          avatar_url: 'https://lh3.googleusercontent.com/a/abc',
          email_verified: true,
        },
      });
      expect(extractOAuthDisplayName(user)).toBe('Jon Pohlner');
    });

    // Realistic GitHub fixture: name set to display name, user_name to handle
    it('handles GitHub OAuth metadata shape with display name', () => {
      const user = createMockUser({
        email: 'octocat@users.noreply.github.com',
        user_metadata: {
          name: 'The Octocat',
          user_name: 'octocat',
          avatar_url: 'https://avatars.githubusercontent.com/u/583231',
        },
      });
      expect(extractOAuthDisplayName(user)).toBe('The Octocat');
    });

    // Realistic GitHub fixture: handle only (user has no display name set on GitHub)
    it('handles GitHub OAuth metadata shape with handle only', () => {
      const user = createMockUser({
        email: 'octocat@users.noreply.github.com',
        user_metadata: {
          user_name: 'octocat',
          avatar_url: 'https://avatars.githubusercontent.com/u/583231',
        },
      });
      expect(extractOAuthDisplayName(user)).toBe('octocat');
    });

    it('ignores non-string metadata values without throwing', () => {
      const user = createMockUser({
        email: 'jsmith@example.com',
        user_metadata: {
          full_name: 42 as unknown as string,
          name: null as unknown as string,
          user_name: undefined as unknown as string,
        },
      });
      expect(extractOAuthDisplayName(user)).toBe('jsmith');
    });
  });
});

describe('extractOAuthAvatarUrl', () => {
  it('returns avatar_url when available in user_metadata', () => {
    const user = createMockUser({
      user_metadata: { avatar_url: 'https://example.com/avatar.jpg' },
    });
    expect(extractOAuthAvatarUrl(user)).toBe('https://example.com/avatar.jpg');
  });

  it('returns null when avatar_url is not in metadata', () => {
    const user = createMockUser({
      user_metadata: {},
    });
    expect(extractOAuthAvatarUrl(user)).toBeNull();
  });

  it('returns null when user is null', () => {
    expect(extractOAuthAvatarUrl(null)).toBeNull();
  });

  it('returns null when user_metadata is undefined', () => {
    const user = createMockUser({
      user_metadata: undefined,
    });
    expect(extractOAuthAvatarUrl(user)).toBeNull();
  });
});

// Existing function tests for completeness
describe('isOAuthUser', () => {
  it('returns false for null user', () => {
    expect(isOAuthUser(null)).toBe(false);
  });

  it('returns true for Google OAuth user', () => {
    const user = createMockUser({
      app_metadata: { provider: 'google' },
    });
    expect(isOAuthUser(user)).toBe(true);
  });

  it('returns true for GitHub OAuth user', () => {
    const user = createMockUser({
      app_metadata: { provider: 'github' },
    });
    expect(isOAuthUser(user)).toBe(true);
  });

  it('returns false for email user', () => {
    const user = createMockUser({
      app_metadata: { provider: 'email' },
    });
    expect(isOAuthUser(user)).toBe(false);
  });
});

describe('getOAuthProvider', () => {
  it('returns null for null user', () => {
    expect(getOAuthProvider(null)).toBeNull();
  });

  it('returns capitalized provider name for Google', () => {
    const user = createMockUser({
      app_metadata: { provider: 'google' },
    });
    expect(getOAuthProvider(user)).toBe('Google');
  });

  it('returns capitalized provider name for GitHub', () => {
    const user = createMockUser({
      app_metadata: { provider: 'github' },
    });
    expect(getOAuthProvider(user)).toBe('Github');
  });
});

describe('populateOAuthProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates display_name when profile has NULL display_name', async () => {
    const user = createMockUser({
      id: 'test-user-id',
      user_metadata: { full_name: 'Jon Pohlner' },
    });

    // Mock profile query - existing profile with NULL display_name
    const selectBuilder = createMockQueryBuilder({
      display_name: null,
      avatar_url: null,
    });

    // Mock update success
    const updateBuilder = createMockQueryBuilder({ success: true });

    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { display_name: null, avatar_url: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as any;
      }
      return selectBuilder as any;
    });

    const result = await populateOAuthProfile(user);
    expect(result).toBe(true);
  });

  it('does NOT overwrite existing display_name', async () => {
    const user = createMockUser({
      id: 'test-user-id',
      user_metadata: { full_name: 'Jon Pohlner' },
    });

    // Mock profile query - existing profile with display_name already set
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  display_name: 'Existing Name',
                  avatar_url: 'https://existing.jpg',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as any;
      }
      return {} as any;
    });

    const result = await populateOAuthProfile(user);
    expect(result).toBe(false);
  });

  it('populates avatar_url when NULL and OAuth has avatar', async () => {
    const user = createMockUser({
      id: 'test-user-id',
      user_metadata: {
        full_name: 'Jon Pohlner',
        avatar_url: 'https://oauth-avatar.jpg',
      },
    });

    // Mock profile with display_name set but avatar_url NULL
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { display_name: null, avatar_url: null },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        } as any;
      }
      return {} as any;
    });

    const result = await populateOAuthProfile(user);
    expect(result).toBe(true);
  });

  it('returns false when profile query fails', async () => {
    const user = createMockUser({
      id: 'test-user-id',
      user_metadata: { full_name: 'Jon Pohlner' },
    });

    // Mock profile query failure
    vi.mocked(mockSupabase.from).mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    const result = await populateOAuthProfile(user);
    expect(result).toBe(false);
  });
});
