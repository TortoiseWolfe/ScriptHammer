/**
 * Email Validator
 * RFC 5322 compliant email validation
 */

// RFC 5322 simplified regex for email validation
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export interface EmailValidationResult {
  valid: boolean;
  error: string | null;
  normalizedEmail?: string;
}

/**
 * Check if email is valid (simple boolean check)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();

  // Check basic format
  if (!EMAIL_REGEX.test(trimmed)) {
    return false;
  }

  // Additional checks
  if (trimmed.includes('..')) {
    return false; // No consecutive dots
  }

  return true;
}

/**
 * Validate email with detailed result
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email is required',
    };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Email is required',
    };
  }

  if (!isValidEmail(trimmed)) {
    return {
      valid: false,
      error: 'Invalid email format',
    };
  }

  return {
    valid: true,
    error: null,
    normalizedEmail: trimmed.toLowerCase(),
  };
}
