import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

/**
 * Validation result for a form field
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  validating?: boolean;
}

/**
 * Form validation state for multiple fields
 */
export interface FormValidationState {
  [fieldName: string]: ValidationResult;
}

/**
 * Options for the useFormValidation hook
 */
export interface UseFormValidationOptions {
  /** Delay in ms before validation runs (default: 300) */
  debounceMs?: number;
  /** Validate on mount (default: false) */
  validateOnMount?: boolean;
  /** Validate on blur (default: true) */
  validateOnBlur?: boolean;
  /** Validate on change (default: true) */
  validateOnChange?: boolean;
  /** Show errors immediately or wait for first interaction (default: wait) */
  showErrorsImmediately?: boolean;
}

/**
 * Custom hook for form validation with Zod schemas
 *
 * @param schema - Zod schema for validation
 * @param options - Validation options
 * @returns Validation utilities and state
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   email: emailSchema,
 *   password: passwordSchema,
 * });
 *
 * const { validateField, errors, isValid } = useFormValidation(schema);
 * ```
 */
export function useFormValidation<T extends z.ZodType>(
  schema: T,
  options: UseFormValidationOptions = {}
) {
  const {
    debounceMs = 300,
    validateOnMount = false,
    validateOnBlur = true,
    validateOnChange = true,
    showErrorsImmediately = false,
  } = options;

  const [errors, setErrors] = useState<FormValidationState>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Clear any pending debounce timers
   */
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    async (fieldName: string, value: unknown, immediate = false) => {
      // Clear existing timer for this field
      const existingTimer = debounceTimers.current.get(fieldName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Mark as validating
      setValidating((prev) => new Set(prev).add(fieldName));

      const performValidation = async () => {
        try {
          // If schema is an object, validate just the field
          if (schema instanceof z.ZodObject) {
            const fieldSchema = schema.shape[fieldName];
            if (fieldSchema) {
              await fieldSchema.parseAsync(value);
              setErrors((prev) => ({
                ...prev,
                [fieldName]: { valid: true },
              }));
            }
          } else {
            // For non-object schemas, validate the whole value
            await schema.parseAsync(value);
            setErrors((prev) => ({
              ...prev,
              [fieldName]: { valid: true },
            }));
          }
        } catch (error) {
          if (error instanceof z.ZodError) {
            const fieldError = error.issues[0];
            setErrors((prev) => ({
              ...prev,
              [fieldName]: {
                valid: false,
                error: fieldError?.message || 'Invalid value',
              },
            }));
          }
        } finally {
          setValidating((prev) => {
            const next = new Set(prev);
            next.delete(fieldName);
            return next;
          });
        }
      };

      if (immediate || debounceMs === 0) {
        await performValidation();
      } else {
        const timer = setTimeout(performValidation, debounceMs);
        debounceTimers.current.set(fieldName, timer);
      }
    },
    [schema, debounceMs]
  );

  /**
   * Validate all fields in a form data object
   */
  const validateForm = useCallback(
    async (formData: Record<string, unknown>) => {
      const validationPromises = Object.entries(formData).map(
        ([fieldName, value]) => validateField(fieldName, value, true)
      );
      await Promise.all(validationPromises);
    },
    [validateField]
  );

  /**
   * Mark a field as touched
   */
  const touchField = useCallback((fieldName: string) => {
    setTouched((prev) => new Set(prev).add(fieldName));
  }, []);

  /**
   * Reset validation state for a field
   */
  const resetField = useCallback((fieldName: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    setTouched((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  }, []);

  /**
   * Reset all validation state
   */
  const resetForm = useCallback(() => {
    setErrors({});
    setTouched(new Set());
    setValidating(new Set());
    debounceTimers.current.forEach((timer) => clearTimeout(timer));
    debounceTimers.current.clear();
  }, []);

  /**
   * Get error for a field (only if touched or showErrorsImmediately)
   */
  const getFieldError = useCallback(
    (fieldName: string): string | undefined => {
      const shouldShow = showErrorsImmediately || touched.has(fieldName);
      const fieldError = errors[fieldName];
      return shouldShow && fieldError && !fieldError.valid
        ? fieldError.error
        : undefined;
    },
    [errors, touched, showErrorsImmediately]
  );

  /**
   * Get validation state for a field
   */
  const getFieldState = useCallback(
    (fieldName: string) => {
      const error = getFieldError(fieldName);
      const isValidating = validating.has(fieldName);
      const isTouched = touched.has(fieldName);
      const fieldResult = errors[fieldName];

      return {
        error,
        isValidating,
        isTouched,
        isValid: fieldResult?.valid ?? false,
        showError: !!error,
      };
    },
    [getFieldError, validating, touched, errors]
  );

  /**
   * Handle input change with validation
   */
  const handleChange = useCallback(
    (fieldName: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (validateOnChange) {
        validateField(fieldName, value);
      }
      return value;
    },
    [validateField, validateOnChange]
  );

  /**
   * Handle input blur with validation
   */
  const handleBlur = useCallback(
    (fieldName: string) => () => {
      touchField(fieldName);
      if (validateOnBlur) {
        const input = document.querySelector(
          `[name="${fieldName}"]`
        ) as HTMLInputElement;
        if (input) {
          validateField(fieldName, input.value, true);
        }
      }
    },
    [touchField, validateField, validateOnBlur]
  );

  /**
   * Check if the entire form is valid
   */
  const isValid = Object.values(errors).every(
    (result) => result.valid === true
  );

  /**
   * Check if form has any errors
   */
  const hasErrors = Object.values(errors).some(
    (result) => result.valid === false
  );

  /**
   * Check if any field is validating
   */
  const isValidating = validating.size > 0;

  return {
    // State
    errors,
    touched,
    isValid,
    hasErrors,
    isValidating,

    // Field utilities
    validateField,
    validateForm,
    touchField,
    resetField,
    resetForm,
    getFieldError,
    getFieldState,

    // Event handlers
    handleChange,
    handleBlur,

    // Register field helper
    register: (fieldName: string) => ({
      name: fieldName,
      onBlur: handleBlur(fieldName),
      onChange: handleChange(fieldName),
      'aria-invalid': !!getFieldError(fieldName),
      'aria-describedby': getFieldError(fieldName)
        ? `${fieldName}-error`
        : undefined,
    }),
  };
}
