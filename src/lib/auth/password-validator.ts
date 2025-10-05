/**
 * Password Validator
 * Enforces strong password requirements
 */

export enum PasswordStrength {
  WEAK = 0,
  MEDIUM = 1,
  STRONG = 2,
}

export interface PasswordValidationResult {
  valid: boolean;
  error: string | null;
  strength?: PasswordStrength;
}

const MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

/**
 * Validate password meets security requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      error: 'Password is required',
    };
  }

  if (password.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_LENGTH} characters`,
    };
  }

  if (!UPPERCASE_REGEX.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter',
    };
  }

  if (!LOWERCASE_REGEX.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter',
    };
  }

  if (!NUMBER_REGEX.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number',
    };
  }

  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return {
      valid: false,
      error:
        'Password must contain at least one special character (!@#$%^&*...)',
    };
  }

  return {
    valid: true,
    error: null,
    strength: getPasswordStrength(password),
  };
}

/**
 * Calculate password strength
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length < MIN_LENGTH) {
    return PasswordStrength.WEAK;
  }

  let score = 0;

  // Length bonus
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Complexity bonus
  if (UPPERCASE_REGEX.test(password)) score += 1;
  if (LOWERCASE_REGEX.test(password)) score += 1;
  if (NUMBER_REGEX.test(password)) score += 1;
  if (SPECIAL_CHAR_REGEX.test(password)) score += 1;

  // Variety bonus (multiple numbers/special chars)
  if ((password.match(/[0-9]/g) || []).length >= 2) score += 1;
  if ((password.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length >= 2) score += 1;

  if (score <= 3) return PasswordStrength.WEAK;
  if (score <= 6) return PasswordStrength.MEDIUM;
  return PasswordStrength.STRONG;
}
