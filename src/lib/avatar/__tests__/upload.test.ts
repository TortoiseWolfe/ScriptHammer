/**
 * Unit tests for avatar upload
 * Feature 022: User Avatar Upload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadAvatar,
  removeAvatar,
  extractPathFromUrl,
  uploadWithRetry,
} from '../upload';

// Create persistent mock objects using vi.hoisted()
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockFrom = vi.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
}));

// Mock for database queries (user_profiles table)
const mockDbUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
});
// `select(...).eq(...).maybeSingle()` is the previous-avatar fallback added with
// #1068: the auth-metadata mirror is best-effort now, so it can legitimately be
// missing and `user_profiles` is consulted instead. Resolves to no prior avatar
// by default; individual tests override it.
const mockDbMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
const mockDbSelect = vi.fn(() => ({
  eq: vi.fn(() => ({ maybeSingle: mockDbMaybeSingle })),
}));
const mockDbFrom = vi.fn(() => ({
  update: mockDbUpdate,
  select: mockDbSelect,
}));

// Mock Supabase client with persistent mocks
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      updateUser: mockUpdateUser,
    },
    storage: {
      from: mockFrom,
    },
    from: mockDbFrom, // Database queries for user_profiles
  }),
}));

describe('extractPathFromUrl', () => {
  it('should extract path from Supabase Storage URL', () => {
    const url =
      'https://abc123.supabase.co/storage/v1/object/public/avatars/user-id/1234567890.webp';

    const path = extractPathFromUrl(url);

    expect(path).toBe('user-id/1234567890.webp');
  });

  it('should handle URLs without avatars segment', () => {
    const url = 'https://example.com/some/path';

    const path = extractPathFromUrl(url);

    expect(path).toBe('');
  });

  it('should handle URLs with multiple slashes', () => {
    const url =
      'https://abc123.supabase.co/storage/v1/object/public/avatars/user-id/folder/1234567890.webp';

    const path = extractPathFromUrl(url);

    expect(path).toBe('user-id/folder/1234567890.webp');
  });
});

describe('uploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if session missing', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      },
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.url).toBe('');
    expect(result.error).toContain('session missing');
  });

  it('should handle upload errors', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-123', user_metadata: {} } },
      },
      error: null,
    });

    mockUpload.mockResolvedValue({
      data: null,
      error: new Error('Upload failed'),
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.url).toBe('');
    expect(result.error).toBeTruthy();
  });

  it('rolls back when the SOURCE OF TRUTH write fails', async () => {
    // `user_profiles.avatar_url` is what the product reads (useUserProfile.ts).
    // If it cannot be written, the uploaded file is unreachable and must not be
    // left orphaned in the bucket.
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123', user_metadata: {} } } },
      error: null,
    });
    mockUpload.mockResolvedValue({
      data: { path: 'user-123/123.webp' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.com/avatar.webp' },
    });
    mockRemove.mockResolvedValue({ data: null, error: null });
    mockDbUpdate.mockReturnValue({
      eq: vi.fn(async () => ({ error: { message: 'row-level security' } })),
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.url).toBe('');
    expect(result.error).toContain('Profile update failed');
    expect(mockRemove).toHaveBeenCalledWith(['user-123/123.webp']);
  });

  it('does NOT roll back when only the auth-metadata mirror fails (#1068)', async () => {
    // THE REGRESSION THIS PINS. The mirror used to be written first and treated as
    // fatal, so `Auth session missing!` from `auth.updateUser` deleted a file that
    // had already uploaded successfully and told the user the upload failed —
    // observed on the hosted E2E lane. Nothing in the product reads the mirror
    // except this module's own previous-avatar cleanup.
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123', user_metadata: {} } } },
      error: null,
    });
    mockUpload.mockResolvedValue({
      data: { path: 'user-123/123.webp' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.com/avatar.webp' },
    });
    mockRemove.mockResolvedValue({ data: null, error: null });
    mockDbUpdate.mockReturnValue({ eq: vi.fn(async () => ({ error: null })) });
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Auth session missing!',
        name: 'AuthError',
        status: 400,
      },
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.error).toBeUndefined();
    expect(result.url).toBe('https://example.com/avatar.webp');
    // The counterweight that matters: the file must survive.
    expect(mockRemove).not.toHaveBeenCalledWith(['user-123/123.webp']);
  });
});

describe('removeAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if session missing', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      },
    });

    const result = await removeAvatar();

    expect(result.error).toContain('session missing');
  });

  it('should return success if no avatar exists', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-123', user_metadata: {} } },
      },
      error: null,
    });

    const result = await removeAvatar();

    expect(result.error).toBeUndefined();
  });

  it('should handle profile update errors', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
            user_metadata: { avatar_url: 'https://example.com/avatar.webp' },
          },
        },
      },
      error: null,
    });

    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Update failed',
        name: 'AuthError',
        status: 500,
      },
    });

    const result = await removeAvatar();

    expect(result.error).toContain('Failed to remove avatar');
  });
});

describe('uploadWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry failed uploads', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-123', user_metadata: {} } },
      },
      error: null,
    });

    // First two attempts fail, third succeeds
    mockUpload
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Network error'),
      })
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Network error'),
      })
      .mockResolvedValueOnce({
        data: { path: 'user-123/123.webp' },
        error: null,
      });

    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.com/avatar.webp' },
    });

    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadWithRetry(blob, 3);

    expect(result.url).toBeTruthy();
    expect(result.error).toBeUndefined();
  }, 10000); // Increase timeout for retries

  it('should not retry authentication errors', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      },
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadWithRetry(blob, 3);

    expect(result.url).toBe('');
    expect(result.error).toContain('session missing');
    // Should fail immediately without retries
  });
});
