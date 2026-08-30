import React from 'react';

export interface FormErrorProps {
  /** Error message to display */
  error?: string;
  /** ID for ARIA labeling */
  id?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show animation on error change */
  animate?: boolean;
}

/**
 * Accessible form error message component
 *
 * Features:
 * - ARIA live region for screen reader announcements
 * - Smooth animations when errors appear/disappear
 * - Consistent error styling with theme support
 * - Icon indicator for visual users
 *
 * @example
 * ```tsx
 * <FormError
 *   error={fieldError}
 *   id="email-error"
 *   animate
 * />
 * ```
 */
export const FormError: React.FC<FormErrorProps> = ({
  error,
  id,
  className = '',
  animate = true,
}) => {
  if (!error) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`text-error mt-1 flex items-center gap-1 text-xs ${animate ? 'animate-in fade-in slide-in-from-top-1' : ''} ${className} `}
    >
      <svg
        className="h-3 w-3 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span>{error}</span>
    </div>
  );
};
