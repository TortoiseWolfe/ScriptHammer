/**
 * Integration Test: Avatar Upload Flow
 *
 * Tests the complete avatar upload workflow:
 * 1. User authentication
 * 2. File validation
 * 3. Image cropping and processing
 * 4. Upload to Supabase Storage
 * 5. Profile metadata update
 * 6. Old avatar deletion
 *
 * Prerequisites:
 * - Supabase test environment configured
 * - Test user exists (see .env.example for TEST_USER_PRIMARY_EMAIL/PASSWORD)
 * - Avatars bucket created with RLS policies
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/client';
import { validateAvatarFile } from '@/lib/avatar/validation';
import { createCroppedImage } from '@/lib/avatar/image-processing';
import { uploadAvatar, removeAvatar } from '@/lib/avatar/upload';

describe('Avatar Upload Integration Flow', () => {
  const supabase = createClient();
  let userId: string;
  let authToken: string;

  beforeAll(async () => {
    // Sign in test user
    const testEmail = process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
    const testPassword =
      process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (error || !data.user) {
      throw new Error(`Failed to authenticate test user: ${error?.message}`);
    }

    userId = data.user.id;
    authToken = data.session?.access_token || '';

    // Clean up any existing test avatars
    const oldAvatarUrl = data.user.user_metadata?.avatar_url as
      | string
      | undefined;
    if (oldAvatarUrl) {
      await removeAvatar();
    }
  });

  afterAll(async () => {
    // Clean up test avatars
    await removeAvatar();
    await supabase.auth.signOut();
  });

  it('should complete full upload flow for new avatar', async () => {
    // Step 1: Create test image file (500x500px JPEG)
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d')!;

    // Draw test pattern
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, 500, 500);
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TEST', 250, 250);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
    });

    const file = new File([blob], 'test-avatar.jpg', { type: 'image/jpeg' });

    // Step 2: Validate file
    const validationResult = await validateAvatarFile(file);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.error).toBeUndefined();

    // Step 3: Crop image (center crop)
    const imageSrc = URL.createObjectURL(file);
    const croppedBlob = await createCroppedImage(imageSrc, {
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    });

    expect(croppedBlob).toBeInstanceOf(Blob);
    expect(croppedBlob.type).toBe('image/webp');
    expect(croppedBlob.size).toBeGreaterThan(0);

    // Step 4: Upload avatar
    const uploadResult = await uploadAvatar(croppedBlob);
    expect(uploadResult.error).toBeUndefined();
    expect(uploadResult.url).toBeTruthy();
    expect(uploadResult.url).toContain('avatars');
    expect(uploadResult.url).toContain(userId);

    // Step 5: Verify profile updated
    const { data: userData } = await supabase.auth.getUser();
    expect(userData.user?.user_metadata?.avatar_url).toBe(uploadResult.url);

    // Step 6: Verify file exists in storage
    const pathMatch = uploadResult.url.match(/avatars\/(.+)$/);
    expect(pathMatch).not.toBeNull();

    if (pathMatch) {
      const filePath = pathMatch[1];
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('avatars')
        .download(filePath);

      expect(downloadError).toBeNull();
      expect(fileData).toBeInstanceOf(Blob);
      expect(fileData?.type).toBe('image/webp');
    }

    URL.revokeObjectURL(imageSrc);
  }, 30000); // 30 second timeout for full upload flow

  it('should replace existing avatar with new one', async () => {
    // Upload first avatar
    const canvas1 = document.createElement('canvas');
    canvas1.width = 400;
    canvas1.height = 400;
    const ctx1 = canvas1.getContext('2d')!;
    ctx1.fillStyle = '#ef4444';
    ctx1.fillRect(0, 0, 400, 400);

    const blob1 = await new Promise<Blob>((resolve) => {
      canvas1.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
    });

    const file1 = new File([blob1], 'avatar1.jpg', { type: 'image/jpeg' });
    const imageSrc1 = URL.createObjectURL(file1);
    const croppedBlob1 = await createCroppedImage(imageSrc1, {
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    });

    const uploadResult1 = await uploadAvatar(croppedBlob1);
    expect(uploadResult1.error).toBeUndefined();
    const firstAvatarUrl = uploadResult1.url;

    // Upload second avatar (replacement)
    const canvas2 = document.createElement('canvas');
    canvas2.width = 400;
    canvas2.height = 400;
    const ctx2 = canvas2.getContext('2d')!;
    ctx2.fillStyle = '#10b981';
    ctx2.fillRect(0, 0, 400, 400);

    const blob2 = await new Promise<Blob>((resolve) => {
      canvas2.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
    });

    const file2 = new File([blob2], 'avatar2.jpg', { type: 'image/jpeg' });
    const imageSrc2 = URL.createObjectURL(file2);
    const croppedBlob2 = await createCroppedImage(imageSrc2, {
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    });

    const uploadResult2 = await uploadAvatar(croppedBlob2);
    expect(uploadResult2.error).toBeUndefined();
    expect(uploadResult2.url).not.toBe(firstAvatarUrl);

    // Verify profile updated to new avatar
    const { data: userData } = await supabase.auth.getUser();
    expect(userData.user?.user_metadata?.avatar_url).toBe(uploadResult2.url);

    // Verify old avatar deleted (attempt to download should fail)
    const oldPathMatch = firstAvatarUrl.match(/avatars\/(.+)$/);
    if (oldPathMatch) {
      const oldFilePath = oldPathMatch[1];
      const { error: downloadError } = await supabase.storage
        .from('avatars')
        .download(oldFilePath);

      // Old file should be deleted (404 error)
      expect(downloadError).not.toBeNull();
      expect(downloadError?.message).toContain('not found');
    }

    URL.revokeObjectURL(imageSrc1);
    URL.revokeObjectURL(imageSrc2);
  }, 45000); // 45 second timeout for double upload flow

  it('should reject invalid file during validation', async () => {
    // Create oversized file (6MB > 5MB limit)
    const largeBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)]);
    const largeFile = new File([largeBlob], 'large.jpg', {
      type: 'image/jpeg',
    });

    const validationResult = await validateAvatarFile(largeFile);
    expect(validationResult.valid).toBe(false);
    expect(validationResult.error).toContain('5MB');
  });

  it('should handle upload failure gracefully', async () => {
    // Sign out to trigger authentication error
    await supabase.auth.signOut();

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 300, 300);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
    });

    const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });
    const imageSrc = URL.createObjectURL(file);
    const croppedBlob = await createCroppedImage(imageSrc, {
      x: 0,
      y: 0,
      width: 300,
      height: 300,
    });

    const uploadResult = await uploadAvatar(croppedBlob);
    expect(uploadResult.error).toBeTruthy();
    expect(uploadResult.error).toContain('not authenticated');
    expect(uploadResult.url).toBe('');

    URL.revokeObjectURL(imageSrc);

    // Re-authenticate for cleanup
    const testEmail = process.env.TEST_USER_PRIMARY_EMAIL || 'test@example.com';
    const testPassword =
      process.env.TEST_USER_PRIMARY_PASSWORD || 'TestPassword123!';
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
  });

  it('should remove existing avatar successfully', async () => {
    // Upload avatar first
    const canvas = document.createElement('canvas');
    canvas.width = 350;
    canvas.height = 350;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(0, 0, 350, 350);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
    });

    const file = new File([blob], 'to-remove.jpg', { type: 'image/jpeg' });
    const imageSrc = URL.createObjectURL(file);
    const croppedBlob = await createCroppedImage(imageSrc, {
      x: 0,
      y: 0,
      width: 350,
      height: 350,
    });

    const uploadResult = await uploadAvatar(croppedBlob);
    expect(uploadResult.error).toBeUndefined();

    // Remove avatar
    const removeResult = await removeAvatar();
    expect(removeResult.error).toBeUndefined();

    // Verify profile cleared
    const { data: userData } = await supabase.auth.getUser();
    expect(userData.user?.user_metadata?.avatar_url).toBeUndefined();

    // Verify file deleted from storage
    const pathMatch = uploadResult.url.match(/avatars\/(.+)$/);
    if (pathMatch) {
      const filePath = pathMatch[1];
      const { error: downloadError } = await supabase.storage
        .from('avatars')
        .download(filePath);

      expect(downloadError).not.toBeNull();
      expect(downloadError?.message).toContain('not found');
    }

    URL.revokeObjectURL(imageSrc);
  }, 30000);
});
