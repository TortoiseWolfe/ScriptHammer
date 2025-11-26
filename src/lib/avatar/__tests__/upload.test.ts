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
const mockGetUser = vi.fn();
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
const mockDbFrom = vi.fn(() => ({
  update: mockDbUpdate,
}));

// Mock Supabase client with persistent mocks
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
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

  it('should return error if user not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      },
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.url).toBe('');
    expect(result.error).toContain('not authenticated');
  });

  it('should handle upload errors', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
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

  it('should rollback upload if profile update fails', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
      },
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

    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Update failed',
        name: 'AuthError',
        status: 500,
      },
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.url).toBe('');
    expect(result.error).toContain('Profile update failed');
    expect(mockRemove).toHaveBeenCalledWith(['user-123/123.webp']);
  });
});

describe('removeAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if user not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      },
    });

    const result = await removeAvatar();

    expect(result.error).toContain('not authenticated');
  });

  it('should return success if no avatar exists', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
      },
      error: null,
    });

    const result = await removeAvatar();

    expect(result.error).toBeUndefined();
  });

  it('should handle profile update errors', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          user_metadata: { avatar_url: 'https://example.com/avatar.webp' },
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
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
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
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      },
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadWithRetry(blob, 3);

    expect(result.url).toBe('');
    expect(result.error).toContain('authenticated');
    // Should fail immediately without retries
  });
});
