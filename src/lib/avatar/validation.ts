/**
 * Avatar file validation utilities
 * Feature 022: User Avatar Upload
 */

import type { ValidationResult } from './types';

/**
 * Allowed MIME types for avatar uploads
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Maximum file size in bytes (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB = 5,242,880 bytes

/**
 * Minimum image dimensions (width and height)
 */
const MIN_DIMENSIONS = 200; // 200x200px

/**
 * Validate avatar file before upload
 * Performs comprehensive validation:
 * - MIME type check
 * - File size check
 * - Image decode validation (ensures it's a real image)
 * - Dimension check
 *
 * @param file - File to validate
 * @returns ValidationResult with valid flag and error message if invalid
 */
export async function validateAvatarFile(
  file: File
): Promise<ValidationResult> {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Please upload a JPEG, PNG, or WebP image.`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds the 5MB limit. Please choose a smaller image.`,
    };
  }

  // Validate image by attempting to decode it
  try {
    const img = await createImageBitmap(file);

    // Check dimensions
    if (img.width < MIN_DIMENSIONS || img.height < MIN_DIMENSIONS) {
      return {
        valid: false,
        error: `Image is too small (${img.width}x${img.height}px). Minimum dimensions are ${MIN_DIMENSIONS}x${MIN_DIMENSIONS}px.`,
      };
    }

    // Close the image bitmap to free memory
    img.close();

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error:
        'Invalid or corrupted image file. Please select a different image.',
    };
  }
}

/**
 * Get user-friendly error message for Supabase Storage errors
 * Maps storage error codes to clear, actionable messages with helpful guidance
 *
 * @param error - Error from Supabase Storage
 * @returns User-friendly error message
 */
export function getStorageErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('unauthorized') || message.includes('401')) {
      return 'Authentication required. Please sign in to upload an avatar.';
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return 'Permission denied. You can only upload avatars to your own profile.';
    }

    if (message.includes('payload too large') || message.includes('413')) {
      return 'File too large. Please select an image smaller than 5MB.';
    }

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection')
    ) {
      return 'Network error. Please check your internet connection and try again.';
    }

    if (message.includes('timeout')) {
      return 'Upload timeout. Your internet may be slow. Try a smaller image or check your connection.';
    }

    if (message.includes('quota') || message.includes('storage')) {
      return 'Storage limit reached. Please contact support or delete old avatars.';
    }

    if (message.includes('not found') || message.includes('404')) {
      return 'Avatar not found. It may have been already deleted.';
    }

    if (message.includes('bucket')) {
      return 'Storage configuration error. Please contact support.';
    }

    // Return original error message if it's short and readable
    if (error.message.length < 100 && !error.message.includes('Error:')) {
      return error.message;
    }

    return 'Upload failed. Please try again or contact support if the problem persists.';
  }

  return 'An unexpected error occurred. Please try again later.';
}
