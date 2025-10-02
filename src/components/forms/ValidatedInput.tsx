'use client';

import React, { forwardRef, useEffect, useState } from 'react';
import { z } from 'zod';
import { validateField } from '@/schemas/forms';
import { FormError } from './FormError';

export interface ValidatedInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'size'
  > {
  /** Zod schema for validation */
  schema?: z.ZodSchema;
  /** Error message override */
  error?: string;
  /** Success message */
  success?: string;
  /** Show validation state icons */
  showStateIcon?: boolean;
  /** Debounce validation in ms */
  debounceMs?: number;
  /** Validate on change */
  validateOnChange?: boolean;
  /** Validate on blur */
  validateOnBlur?: boolean;
  /** Custom onChange handler */
  onChange?: (value: string, isValid: boolean) => void;
  /** Custom onBlur handler */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Loading state */
  loading?: boolean;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * Input component with built-in validation
 *
 * Features:
 * - Real-time validation with Zod schemas
 * - Debounced validation for performance
 * - Visual state indicators (error, success, loading)
 * - Accessible error messages
 * - Customizable validation behavior
 *
 * @example
 * ```tsx
 * <ValidatedInput
 *   name="email"
 *   type="email"
 *   schema={emailSchema}
 *   placeholder="Enter your email"
 *   validateOnChange
 *   showStateIcon
 * />
 * ```
 */
export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    {
      schema,
      error: externalError,
      success,
      showStateIcon = true,
      debounceMs = 300,
      validateOnChange = true,
      validateOnBlur = true,
      onChange,
      onBlur,
      loading = false,
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const [internalError, setInternalError] = useState<string | undefined>();
    const [isValidating, setIsValidating] = useState(false);
    const [touched, setTouched] = useState(false);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
      null
    );

    const error = externalError || (touched ? internalError : undefined);
    const hasError = !!error;
    const hasSuccess = !hasError && !!success && touched;

    // Clean up debounce timer on unmount
    useEffect(() => {
      return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    }, [debounceTimer]);

    const performValidation = async (value: string) => {
      if (!schema) return true;

      setIsValidating(true);
      const result = validateField(schema, value);
      setIsValidating(false);

      if (!result.valid) {
        setInternalError(result.error);
        return false;
      } else {
        setInternalError(undefined);
        return true;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Clear existing timer
      if (debounceTimer) clearTimeout(debounceTimer);

      if (validateOnChange && schema) {
        // Set up new debounce timer
        const timer = setTimeout(() => {
          performValidation(value).then((isValid) => {
            onChange?.(value, isValid);
          });
        }, debounceMs);
        setDebounceTimer(timer);
      } else {
        onChange?.(value, true);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);

      // Clear any pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        setDebounceTimer(null);
      }

      if (validateOnBlur && schema) {
        performValidation(e.target.value);
      }

      onBlur?.(e);
    };

    // Mobile-first touch targets (PRP-017 T028)
    // All sizes enforce 44px minimum height
    const sizeClasses = {
      xs: 'input-xs min-h-11',
      sm: 'input-sm min-h-11',
      md: 'input-md min-h-11',
      lg: 'input-lg',
    };

    // State classes
    const stateClasses = hasError
      ? 'input-error'
      : hasSuccess
        ? 'input-success'
        : '';

    // Build className
    const inputClassName = `
      input input-bordered
      ${sizeClasses[size]}
      ${stateClasses}
      ${loading || isValidating ? 'opacity-75' : ''}
      ${className}
    `.trim();

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          className={inputClassName}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={hasError}
          aria-describedby={
            error && props.name ? `${props.name}-error` : undefined
          }
          disabled={loading || props.disabled}
          {...props}
        />

        {/* State icon */}
        {showStateIcon &&
          (loading || isValidating || hasError || hasSuccess) && (
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              {loading || isValidating ? (
                <span className="loading loading-spinner loading-xs text-base-content/50"></span>
              ) : hasError ? (
                <svg
                  className="text-error h-4 w-4"
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
              ) : hasSuccess ? (
                <svg
                  className="text-success h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : null}
            </div>
          )}

        {/* Error message */}
        {error && props.name && (
          <FormError error={error} id={`${props.name}-error`} />
        )}

        {/* Success message */}
        {hasSuccess && (
          <div className="text-success mt-1 text-xs">{success}</div>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';
