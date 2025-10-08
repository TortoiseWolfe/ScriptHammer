import { useState, useCallback, useRef } from 'react';
import { validateAvatarFile } from '@/lib/avatar/validation';
import { createCroppedImage } from '@/lib/avatar/image-processing';
import { uploadAvatar } from '@/lib/avatar/upload';
import type { CroppedAreaPixels } from '@/lib/avatar/types';

export interface UseAvatarUploadResult {
  // File state
  selectedFile: File | null;
  imageSrc: string | null;
  // Crop state
  showCropModal: boolean;
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels: CroppedAreaPixels | null;
  // Upload state
  isUploading: boolean;
  uploadProgress: number;
  // Messages
  error: string | null;
  success: boolean;
  // Actions
  handleFileSelect: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => Promise<void>;
  handleCropChange: (crop: { x: number; y: number }) => void;
  handleZoomChange: (zoom: number) => void;
  handleCropComplete: (
    croppedArea: { x: number; y: number; width: number; height: number },
    croppedAreaPixels: CroppedAreaPixels
  ) => void;
  handleSaveCrop: () => Promise<void>;
  handleCancelCrop: () => void;
  clearError: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Custom hook for AvatarUpload component
 *
 * Manages file selection, validation, cropping, and upload workflow
 */
export function useAvatarUpload(
  onUploadComplete?: (url: string) => void
): UseAvatarUploadResult {
  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedAreaPixels | null>(null);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Clear previous state
      setError(null);
      setSuccess(false);

      // Validate file
      const validationResult = await validateAvatarFile(file);
      if (!validationResult.valid) {
        setError(validationResult.error || 'Invalid file');
        return;
      }

      // Set file and create object URL
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImageSrc(objectUrl);

      // Open crop modal
      setShowCropModal(true);
    },
    []
  );

  /**
   * Handle crop position change
   */
  const handleCropChange = useCallback((newCrop: { x: number; y: number }) => {
    setCrop(newCrop);
  }, []);

  /**
   * Handle zoom level change
   */
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  /**
   * Handle crop complete (from react-easy-crop)
   */
  const handleCropComplete = useCallback(
    (
      croppedArea: { x: number; y: number; width: number; height: number },
      croppedAreaPixels: CroppedAreaPixels
    ) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  /**
   * Handle save crop and upload
   */
  const handleSaveCrop = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Create cropped image blob
      setUploadProgress(25);
      const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels);

      // Upload to Supabase
      setUploadProgress(50);
      const uploadResult = await uploadAvatar(croppedBlob);

      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      setUploadProgress(100);
      setSuccess(true);
      setShowCropModal(false);

      // Clean up
      if (imageSrc) URL.revokeObjectURL(imageSrc);
      setImageSrc(null);
      setSelectedFile(null);

      // Notify parent
      if (onUploadComplete) {
        onUploadComplete(uploadResult.url);
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [imageSrc, croppedAreaPixels, onUploadComplete]);

  /**
   * Handle cancel crop
   */
  const handleCancelCrop = useCallback(() => {
    // Clean up
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setSelectedFile(null);
    setShowCropModal(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [imageSrc]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // File state
    selectedFile,
    imageSrc,
    // Crop state
    showCropModal,
    crop,
    zoom,
    croppedAreaPixels,
    // Upload state
    isUploading,
    uploadProgress,
    // Messages
    error,
    success,
    // Actions
    handleFileSelect,
    handleCropChange,
    handleZoomChange,
    handleCropComplete,
    handleSaveCrop,
    handleCancelCrop,
    clearError,
    inputRef,
  };
}
