'use client';

import React from 'react';
import Cropper from 'react-easy-crop';
import { useAvatarUpload } from './useAvatarUpload';

export interface AvatarUploadProps {
  /** Callback when avatar upload completes successfully */
  onUploadComplete?: (url: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AvatarUpload component
 *
 * Provides file upload with crop interface for user avatars.
 * Features:
 * - File validation (JPEG/PNG/WebP, <5MB, 200x200px min)
 * - Interactive crop interface with zoom
 * - Mobile-first touch targets (44px minimum)
 * - Progress indicator during upload
 * - Keyboard navigation and screen reader support
 *
 * @category atomic
 */
export default function AvatarUpload({
  onUploadComplete,
  className = '',
}: AvatarUploadProps) {
  const {
    imageSrc,
    showCropModal,
    crop,
    zoom,
    isUploading,
    uploadProgress,
    error,
    success,
    handleFileSelect,
    handleCropChange,
    handleZoomChange,
    handleCropComplete,
    handleSaveCrop,
    handleCancelCrop,
    clearError,
    inputRef,
  } = useAvatarUpload(onUploadComplete);

  return (
    <div className={`flex flex-col gap-4${className ? ` ${className}` : ''}`}>
      {/* Upload Button */}
      <div className="flex flex-col gap-2">
        <label htmlFor="avatar-upload" className="sr-only">
          Upload profile picture
        </label>
        <input
          ref={inputRef}
          id="avatar-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload profile picture"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn btn-primary min-h-11 min-w-11"
          disabled={isUploading}
          aria-label="Upload avatar"
        >
          Upload Avatar
        </button>

        {/* Error Message */}
        {error && (
          <div role="alert" aria-live="assertive" className="alert alert-error">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="btn btn-sm btn-ghost min-h-11 min-w-11"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div role="status" aria-live="polite" className="alert alert-success">
            <span>Avatar uploaded successfully!</span>
          </div>
        )}
      </div>

      {/* Crop Modal */}
      {showCropModal && imageSrc && (
        <dialog
          open
          className="modal modal-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-title"
        >
          <div className="modal-box max-w-2xl">
            <h3 id="crop-title" className="mb-4 text-lg font-bold">
              Crop Your Avatar
            </h3>

            {/* Crop Area */}
            <div className="bg-base-200 relative mb-4 h-96 overflow-hidden rounded-lg">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={handleCropChange}
                onZoomChange={handleZoomChange}
                onCropComplete={handleCropComplete}
              />
            </div>

            {/* Zoom Control */}
            <div className="mb-6 flex flex-col gap-2">
              <label htmlFor="zoom-slider" className="text-sm font-medium">
                Zoom
              </label>
              <input
                id="zoom-slider"
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="range range-primary"
                aria-label="Zoom level"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={zoom}
              />
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div
                className="mb-4"
                role="status"
                aria-live="polite"
                aria-label="Uploading avatar"
              >
                <progress
                  className="progress progress-primary w-full"
                  value={uploadProgress}
                  max="100"
                ></progress>
                <p className="mt-2 text-center text-sm">
                  {uploadProgress}% uploaded
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="modal-action flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelCrop}
                className="btn btn-ghost min-h-11 min-w-11"
                disabled={isUploading}
                aria-label="Cancel crop"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                className="btn btn-primary min-h-11 min-w-11"
                disabled={isUploading}
                aria-label="Save cropped avatar"
              >
                {isUploading ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Modal backdrop */}
          <div className="modal-backdrop" onClick={handleCancelCrop}>
            <button type="button" aria-label="Close modal">
              close
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
