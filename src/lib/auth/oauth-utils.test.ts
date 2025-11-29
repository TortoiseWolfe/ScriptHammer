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
