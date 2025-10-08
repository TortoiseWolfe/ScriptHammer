/**
 * TypeScript type definitions for avatar upload functionality
 * Feature 022: User Avatar Upload
 */

/**
 * Result of avatar upload operation
 */
export interface UploadAvatarResult {
  /** Public URL to uploaded avatar (empty string if error) */
  url: string;
  /** Error message if upload failed */
  error?: string;
}

/**
 * Result of file validation
 */
export interface ValidationResult {
  /** Whether file passed validation */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Crop area coordinates from react-easy-crop
 */
export interface CropArea {
  /** X coordinate (pixels) */
  x: number;
  /** Y coordinate (pixels) */
  y: number;
  /** Width (pixels) */
  width: number;
  /** Height (pixels) */
  height: number;
}

/**
 * Crop result with pixel coordinates
 */
export interface CroppedAreaPixels {
  /** X coordinate in original image */
  x: number;
  /** Y coordinate in original image */
  y: number;
  /** Width of cropped area */
  width: number;
  /** Height of cropped area */
  height: number;
}

/**
 * Avatar removal operation result
 */
export interface RemoveAvatarResult {
  /** Error message if removal failed */
  error?: string;
}
