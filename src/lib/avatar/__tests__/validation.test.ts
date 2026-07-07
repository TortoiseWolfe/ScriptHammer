/**
 * Unit tests for avatar validation
 * Feature 022: User Avatar Upload
 */

import { describe, it, expect } from 'vitest';
import { validateAvatarFile, getStorageErrorMessage } from '../validation';

describe('validateAvatarFile', () => {
  it('should accept valid JPEG files', async () => {
    // Create a mock valid JPEG file
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg');
    });
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });

    const result = await validateAvatarFile(file);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept valid PNG files', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    const file = new File([blob], 'avatar.png', { type: 'image/png' });

    const result = await validateAvatarFile(file);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept valid WebP files', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/webp');
    });
    const file = new File([blob], 'avatar.webp', { type: 'image/webp' });

    const result = await validateAvatarFile(file);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject files with invalid MIME type', async () => {
    const file = new File(['content'], 'file.pdf', {
      type: 'application/pdf',
    });

    const result = await validateAvatarFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file type');
    expect(result.error).toContain('JPEG, PNG, or WebP');
  });

  it('should reject files larger than 5MB', async () => {
    // Create a file > 5MB
    const largeBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)]);
    const file = new File([largeBlob], 'large.jpg', { type: 'image/jpeg' });

    const result = await validateAvatarFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('5MB');
    expect(result.error).toContain('exceeds');
  });

  it('should reject images smaller than 200x200px', async () => {
    // Create a small image (100x100)
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg');
    });
    const file = new File([blob], 'small.jpg', { type: 'image/jpeg' });

    const result = await validateAvatarFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('too small');
    expect(result.error).toContain('200');
  });

  it('should reject corrupted image files', async () => {
    // Create a file with image MIME type but corrupted data
    const file = new File(['not an image'], 'corrupted.jpg', {
      type: 'image/jpeg',
    });

    const result = await validateAvatarFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid or corrupted');
  });
});

describe('getStorageErrorMessage', () => {
  it('should return authentication error for 401', () => {
    const error = new Error('Unauthorized 401');
    const message = getStorageErrorMessage(error);

    expect(message).toContain('sign in');
  });

  it('should return permission error for 403', () => {
    const error = new Error('Forbidden 403');
    const message = getStorageErrorMessage(error);

    expect(message).toContain('Permission denied');
  });

  it('should return size error for 413', () => {
    const error = new Error('Payload Too Large 413');
    const message = getStorageErrorMessage(error);

    expect(message).toContain('File too large');
  });

  it('should return network error for fetch failures', () => {
    const error = new Error('Network fetch failed');
    const message = getStorageErrorMessage(error);

    expect(message).toContain('connection');
  });

  it('should return quota error for storage limits', () => {
    const error = new Error('Storage quota exceeded');
    const message = getStorageErrorMessage(error);

    expect(message).toContain('Storage limit');
  });

  it('should return generic message for unknown errors', () => {
    const error = new Error('Something went wrong');
    const message = getStorageErrorMessage(error);

    expect(message).toBe('Something went wrong');
  });

  it('should handle non-Error objects', () => {
    const message = getStorageErrorMessage('string error');

    expect(message).toContain('unexpected error');
  });
});
