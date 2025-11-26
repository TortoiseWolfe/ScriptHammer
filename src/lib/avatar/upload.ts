/**
 * Avatar upload utilities using Supabase Storage
 * Feature 022: User Avatar Upload
 */

import { createClient } from '@/lib/supabase/client';
import type { UploadAvatarResult, RemoveAvatarResult } from './types';
import { getStorageErrorMessage } from './validation';

/**
 * Upload cropped avatar to Supabase Storage
 *
 * Flow:
 * 1. Get current user
 * 2. Generate unique file path ({userId}/{timestamp}.webp)
 * 3. Upload to Supabase Storage
 * 4. Get public URL
 * 5. Update user profile with avatar URL
 * 6. Delete old avatar if exists
 *
 * @param croppedImageBlob - Processed image from crop interface
 * @returns Public URL of uploaded avatar or error
 */
export async function uploadAvatar(
  croppedImageBlob: Blob
): Promise<UploadAvatarResult> {
  const supabase = createClient();

  try {
    // Step 1: Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { url: '', error: 'User not authenticated' };
    }

    // Store old avatar URL for cleanup
    const oldAvatarUrl = user.user_metadata?.avatar_url as string | undefined;

    // Step 2: Generate unique file path
    const userId = user.id;
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.webp`;

    // Step 3: Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, croppedImageBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/webp',
      });

    if (uploadError) {
      return {
        url: '',
        error: getStorageErrorMessage(uploadError),
      };
    }

    // Step 4: Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(uploadData.path);

    const publicUrl = urlData.publicUrl;

    // Step 5: Update user profile (both auth metadata and user_profiles table)
    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    });

    if (updateError) {
      // Rollback: Delete uploaded file
      await supabase.storage.from('avatars').remove([uploadData.path]);
      return {
        url: '',
        error: `Profile update failed: ${updateError.message}`,
      };
    }

    // Also update user_profiles table for consistency
    await supabase
      .from('user_profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    // Step 6: Delete old avatar if exists
    if (oldAvatarUrl) {
      const oldPath = extractPathFromUrl(oldAvatarUrl);
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
        // Ignore errors on old file deletion - cleanup can happen later
      }
    }

    return { url: publicUrl };
  } catch (error) {
    return {
      url: '',
      error: getStorageErrorMessage(error),
    };
  }
}

/**
 * Remove user avatar
 *
 * Flow:
 * 1. Get current user
 * 2. Clear avatar URL from user profile
 * 3. Delete avatar file from storage
 *
 * @returns Success or error result
 */
export async function removeAvatar(): Promise<RemoveAvatarResult> {
  const supabase = createClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'User not authenticated' };
    }

    const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

    if (!avatarUrl) {
      return {}; // No avatar to remove
    }

    // Step 1: Clear avatar URL from profile (both auth metadata and user_profiles table)
    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    });

    if (updateError) {
      return { error: `Failed to remove avatar: ${updateError.message}` };
    }

    // Also clear from user_profiles table
    await supabase
      .from('user_profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    // Step 2: Delete file from storage
    const path = extractPathFromUrl(avatarUrl);
    if (path) {
      await supabase.storage.from('avatars').remove([path]);
      // Ignore errors on file deletion
    }

    return {};
  } catch (error) {
    return { error: getStorageErrorMessage(error) };
  }
}

/**
 * Extract storage path from public URL
 *
 * Example:
 * Input: "https://abc123.supabase.co/storage/v1/object/public/avatars/user-id/1234567890.webp"
 * Output: "user-id/1234567890.webp"
 *
 * @param url - Full public URL from Supabase Storage
 * @returns Relative path within avatars bucket
 */
export function extractPathFromUrl(url: string): string {
  const parts = url.split('/avatars/');
  return parts[1] || '';
}

/**
 * Upload avatar with retry mechanism
 * Uses exponential backoff for failed uploads
 *
 * @param blob - Image blob to upload
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Upload result
 */
export async function uploadWithRetry(
  blob: Blob,
  maxRetries = 3
): Promise<UploadAvatarResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await uploadAvatar(blob);

    if (!result.error) {
      return result;
    }

    // Don't retry on authentication or permission errors
    if (
      result.error.includes('authenticated') ||
      result.error.includes('permission')
    ) {
      return result;
    }

    // Last attempt failed
    if (attempt === maxRetries) {
      return {
        url: '',
        error: `Upload failed after ${maxRetries} attempts: ${result.error}`,
      };
    }

    // Exponential backoff delay
    const delay = 1000 * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return { url: '', error: 'Upload failed after maximum retries' };
}
