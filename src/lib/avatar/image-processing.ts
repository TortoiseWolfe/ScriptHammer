/**
 * Image processing utilities for avatar upload
 * Feature 022: User Avatar Upload
 *
 * Uses Canvas API for client-side image manipulation:
 * - Cropping to user-selected area
 * - Resizing to standard dimensions (800x800px)
 * - Compressing to WebP format
 */

import type { CroppedAreaPixels } from './types';

/**
 * Target dimensions for avatar output (square)
 */
const TARGET_SIZE = 800; // 800x800px

/**
 * WebP compression quality (0.0 - 1.0)
 */
const WEBP_QUALITY = 0.85; // 85% quality

/**
 * Create cropped and compressed image from user's selection
 *
 * @param imageSrc - Data URL of original image
 * @param croppedAreaPixels - Crop coordinates from react-easy-crop
 * @returns Blob of processed image (WebP format, 800x800px)
 */
export async function createCroppedImage(
  imageSrc: string,
  croppedAreaPixels: CroppedAreaPixels
): Promise<Blob> {
  // Load the image
  const image = await loadImage(imageSrc);

  // Create canvas for cropping
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Set canvas size to target dimensions
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;

  // Draw cropped and resized image
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    TARGET_SIZE,
    TARGET_SIZE
  );

  // Convert to WebP blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas to Blob conversion failed'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      WEBP_QUALITY
    );
  });
}

/**
 * Compress image to WebP format
 * Used for images that don't need cropping
 *
 * @param blob - Original image blob
 * @returns Compressed WebP blob (800x800px)
 */
export async function compressImage(blob: Blob): Promise<Blob> {
  // Create image from blob
  const imageSrc = URL.createObjectURL(blob);
  const image = await loadImage(imageSrc);

  // Clean up object URL
  URL.revokeObjectURL(imageSrc);

  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Resize to target dimensions
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;

  // Draw image
  ctx.drawImage(image, 0, 0, TARGET_SIZE, TARGET_SIZE);

  // Convert to WebP
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (compressedBlob) => {
        if (!compressedBlob) {
          reject(new Error('Compression failed'));
          return;
        }
        resolve(compressedBlob);
      },
      'image/webp',
      WEBP_QUALITY
    );
  });
}

/**
 * Load image from data URL or blob URL
 *
 * @param src - Image source URL
 * @returns HTMLImageElement when loaded
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    img.src = src;
  });
}

/**
 * Convert File to data URL for preview
 *
 * @param file - Image file
 * @returns Data URL string
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };

    reader.onerror = () => reject(new Error('FileReader error'));

    reader.readAsDataURL(file);
  });
}
