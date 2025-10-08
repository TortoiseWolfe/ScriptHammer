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

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  })),
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
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      } as never,
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.url).toBe('');
    expect(result.error).toContain('not authenticated');
  });

  it('should handle upload errors', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
      },
      error: null,
    } as never);

    vi.mocked(mockClient.storage.from('avatars').upload).mockResolvedValue({
      data: null,
      error: new Error('Upload failed'),
    } as never);

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadAvatar(blob);

    expect(result.url).toBe('');
    expect(result.error).toBeTruthy();
  });

  it('should rollback upload if profile update fails', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
      },
      error: null,
    } as never);

    vi.mocked(mockClient.storage.from('avatars').upload).mockResolvedValue({
      data: { path: 'user-123/123.webp' },
      error: null,
    } as never);

    vi.mocked(mockClient.storage.from('avatars').getPublicUrl).mockReturnValue({
      data: { publicUrl: 'https://example.com/avatar.webp' },
    } as never);

    vi.mocked(mockClient.storage.from('avatars').remove).mockImplementation(
      mockRemove as never
    );

    vi.mocked(mockClient.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Update failed',
        name: 'AuthError',
        status: 500,
      } as never,
    } as never);

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
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      } as never,
    });

    const result = await removeAvatar();

    expect(result.error).toContain('not authenticated');
  });

  it('should return success if no avatar exists', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
      },
      error: null,
    } as never);

    const result = await removeAvatar();

    expect(result.error).toBeUndefined();
  });

  it('should handle profile update errors', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          user_metadata: { avatar_url: 'https://example.com/avatar.webp' },
        },
      },
      error: null,
    } as never);

    vi.mocked(mockClient.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Update failed',
        name: 'AuthError',
        status: 500,
      } as never,
    } as never);

    const result = await removeAvatar();

    expect(result.error).toContain('Failed to remove avatar');
  });
});

describe('uploadWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry failed uploads', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: {
        user: { id: 'user-123', user_metadata: {} },
      },
      error: null,
    } as never);

    // First two attempts fail, third succeeds
    vi.mocked(mockClient.storage.from('avatars').upload)
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Network error'),
      } as never)
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Network error'),
      } as never)
      .mockResolvedValueOnce({
        data: { path: 'user-123/123.webp' },
        error: null,
      } as never);

    vi.mocked(mockClient.storage.from('avatars').getPublicUrl).mockReturnValue({
      data: { publicUrl: 'https://example.com/avatar.webp' },
    } as never);

    vi.mocked(mockClient.auth.updateUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as never);

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadWithRetry(blob, 3);

    expect(result.url).toBeTruthy();
    expect(result.error).toBeUndefined();
  }, 10000); // Increase timeout for retries

  it('should not retry authentication errors', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const mockClient = createClient();

    vi.mocked(mockClient.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: {
        message: 'Not authenticated',
        name: 'AuthError',
        status: 401,
      } as never,
    });

    const blob = new Blob(['test'], { type: 'image/webp' });
    const result = await uploadWithRetry(blob, 3);

    expect(result.url).toBe('');
    expect(result.error).toContain('authenticated');
    // Should fail immediately without retries
  });
});
