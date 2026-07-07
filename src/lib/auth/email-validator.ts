/**
 * Email Validator
 * RFC 5322 compliant email validation with security enhancements
 * REQ-SEC-004: Enhanced email validation with TLD and disposable email checks
 */

// RFC 5322 simplified regex for email validation
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// TLD validation: must be 2+ alphabetic chars (IANA TLDs are all-alpha, 2+ chars)
// Using a pattern check instead of an allowlist to avoid rejecting legitimate TLDs
const VALID_TLD_PATTERN = /^[a-zA-Z]{2,}$/;

// Known disposable email domains (subset - can be expanded)
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  'trashmail.com',
  'yopmail.com',
  'temp-mail.org',
  'getnada.com',
  'fakeinbox.com',
  'sharklasers.com',
]);

export interface EmailValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: string;
}

/**
 * Check if email is valid (simple boolean check)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();

  // Length limits (RFC 5321)
  if (trimmed.length > 254) {
    return false;
  }

  // Check basic format
  if (!EMAIL_REGEX.test(trimmed)) {
    return false;
  }

  // Additional checks
  if (trimmed.includes('..')) {
    return false; // No consecutive dots
  }

  // Check local part length (before @)
  const [localPart, domain] = trimmed.split('@');
  if (localPart.length > 64) {
    return false;
  }

  // Check TLD: domain must have a dot, TLD must be 2+ alphabetic chars
  if (!domain.includes('.')) {
    return false;
  }
  const tld = domain.split('.').pop()?.toLowerCase();
  if (!tld || !VALID_TLD_PATTERN.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Check if email domain is a known disposable email provider
 */
export function isDisposableEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split('@')[1];
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/**
 * Validate email with detailed result and warnings
 * REQ-SEC-004: Enhanced validation with TLD and disposable email detection
 */
export function validateEmail(email: string): EmailValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      errors: ['Email is required'],
      warnings: [],
    };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      errors: ['Email is required'],
      warnings: [],
    };
  }

  // Length check
  if (trimmed.length > 254) {
    return {
      valid: false,
      errors: ['Email exceeds maximum length (254 characters)'],
      warnings: [],
    };
  }

  // Format check
  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      valid: false,
      errors: ['Invalid email format'],
      warnings: [],
    };
  }

  // Reject potentially dangerous characters (for security)
  // While RFC 5322 allows these, we reject them for security/compatibility
  if (/[#<>()[\]\\,;:]/.test(trimmed.split('@')[0])) {
    return {
      valid: false,
      errors: ['Email contains invalid characters'],
      warnings: [],
    };
  }

  // Consecutive dots
  if (trimmed.includes('..')) {
    return {
      valid: false,
      errors: ['Email contains consecutive dots (..)'],
      warnings: [],
    };
  }

  // Local part length and validation
  const [localPart, domain] = trimmed.split('@');

  // Check for dots at start or end of local part
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return {
      valid: false,
      errors: ['Email local part cannot start or end with a dot'],
      warnings: [],
    };
  }

  if (localPart.length > 64) {
    return {
      valid: false,
      errors: ['Email local part exceeds maximum length (64 characters)'],
      warnings: [],
    };
  }

  // TLD validation: domain must have a dot, TLD must be 2+ alphabetic chars
  if (!domain?.includes('.')) {
    return {
      valid: false,
      errors: ['Invalid or missing top-level domain (TLD)'],
      warnings: [],
    };
  }
  const tld = domain.split('.').pop()?.toLowerCase();
  if (!tld || !VALID_TLD_PATTERN.test(tld)) {
    return {
      valid: false,
      errors: ['Invalid or missing top-level domain (TLD)'],
      warnings: [],
    };
  }

  // Disposable email check (warning, not error)
  if (isDisposableEmail(trimmed)) {
    warnings.push(
      'Disposable email address detected - account recovery may be limited'
    );
  }

  return {
    valid: true,
    errors: [],
    warnings,
    normalized: trimmed.toLowerCase(),
  };
}
