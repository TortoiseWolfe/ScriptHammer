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
 * Maps storage error codes to clear, actionable messages
 *
 * @param error - Error from Supabase Storage
 * @returns User-friendly error message
 */
export function getStorageErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('unauthorized') || message.includes('401')) {
      return 'Please sign in to upload an avatar.';
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return 'You do not have permission to perform this action.';
    }

    if (message.includes('payload too large') || message.includes('413')) {
      return 'File size exceeds maximum limit.';
    }

    if (message.includes('network') || message.includes('fetch')) {
      return 'Upload failed. Please check your connection and try again.';
    }

    if (message.includes('quota')) {
      return 'Storage quota exceeded. Please contact support.';
    }

    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}
