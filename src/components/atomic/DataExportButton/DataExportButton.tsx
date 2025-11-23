import React, { useState } from 'react';
import { gdprService } from '@/services/messaging/gdpr-service';

export interface DataExportButtonProps {
  /** Callback when export completes successfully */
  onExportComplete?: () => void;
  /** Callback when export fails */
  onExportError?: (error: Error) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DataExportButton component
 * Task: T186
 *
 * Triggers GDPR-compliant data export with progress indicator.
 * Downloads all user data as JSON file.
 *
 * @category atomic
 */
export default function DataExportButton({
  onExportComplete,
  onExportError,
  className = '',
}: DataExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      // Export user data
      const exportData = await gdprService.exportUserData();

      // Create JSON blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-messages-export-${Date.now()}.json`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      onExportComplete?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to export data';
      setError(errorMessage);
      onExportError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="btn btn-primary min-h-11 min-w-11"
        aria-label="Download my data"
      >
        {isExporting ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            Exporting...
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Download My Data
          </>
        )}
      </button>

      {/* ARIA live region for status updates */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isExporting && 'Exporting your data...'}
        {error && `Error: ${error}`}
        {!isExporting && !error && 'Ready to export'}
      </div>

      {/* Error message */}
      {error && (
        <div className="alert alert-error mt-2" role="alert">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
