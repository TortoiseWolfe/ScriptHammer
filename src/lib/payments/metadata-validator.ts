/**
 * Metadata Validator
 * Prevents prototype pollution and resource exhaustion attacks
 * REQ-SEC-005: Metadata validation with size and nesting limits
 */

// Dangerous keys that could lead to prototype pollution
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

// Maximum metadata size in bytes
const MAX_METADATA_SIZE = 1024; // 1KB

// Maximum nesting depth
const MAX_NESTING_DEPTH = 2;

/**
 * Check if metadata contains dangerous keys
 */
function hasDangerousKeys(obj: unknown, depth = 0): string | null {
  if (depth > MAX_NESTING_DEPTH) {
    return 'nesting exceeds 2 levels';
  }

  if (obj === null || typeof obj !== 'object') {
    return null;
  }

  const keys = Object.keys(obj);

  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) {
      return `dangerous key "${key}" detected`;
    }

    // Check nested objects
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'object' && value !== null) {
      const nestedError = hasDangerousKeys(value, depth + 1);
      if (nestedError) {
        return nestedError;
      }
    }
  }

  return null;
}

/**
 * Check if arrays exceed size limit
 */
function checkArrayLimits(obj: unknown, depth = 0): string | null {
  if (depth > MAX_NESTING_DEPTH) {
    return null; // Already caught by nesting check
  }

  if (obj === null || typeof obj !== 'object') {
    return null;
  }

  if (Array.isArray(obj)) {
    if (obj.length > 100) {
      return 'array exceeds 100 items';
    }
    // Check nested arrays
    for (const item of obj) {
      const error = checkArrayLimits(item, depth + 1);
      if (error) return error;
    }
  } else {
    // Check object values for arrays
    for (const value of Object.values(obj)) {
      const error = checkArrayLimits(value, depth + 1);
      if (error) return error;
    }
  }

  return null;
}

/**
 * Check nesting depth of object
 */
function getNestingDepth(obj: unknown, currentDepth = 0): number {
  if (obj === null || typeof obj !== 'object') {
    return currentDepth;
  }

  let maxDepth = currentDepth;

  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      const depth = getNestingDepth(value, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return maxDepth;
}

/**
 * Check for circular references
 */
function hasCircularReferences(obj: unknown): boolean {
  try {
    JSON.stringify(obj);
    return false;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('circular')) {
      return true;
    }
    return false;
  }
}

/**
 * Sanitize metadata by removing dangerous keys
 */
function sanitizeMetadata(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip dangerous keys
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check for prototype pollution at all levels (recursively)
 */
function checkPrototypePollution(obj: unknown, depth = 0): string | null {
  if (depth > MAX_NESTING_DEPTH) {
    return null; // Already caught by nesting check
  }

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return null;
  }

  // Allow built-in types (Date, RegExp, etc.) which have their own prototypes
  if (obj instanceof Date || obj instanceof RegExp) {
    return null;
  }

  // Check if this object's prototype was polluted
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) {
    return 'dangerous key "__proto__" detected - prototype pollution attempt';
  }

  // Recursively check nested objects (but not Date/RegExp values)
  for (const value of Object.values(obj)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !(value instanceof Date) &&
      !(value instanceof RegExp)
    ) {
      const error = checkPrototypePollution(value, depth + 1);
      if (error) return error;
    }
  }

  return null;
}

/**
 * Validate metadata with security checks (throws on error)
 * REQ-SEC-005: Prevents prototype pollution, circular references, and resource exhaustion
 */
export function validateMetadata(metadata: unknown): void {
  // Must be an object
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Metadata must be a plain object');
  }

  // Check for prototype pollution at all levels (catches { __proto__: {} } attempts)
  const pollutionError = checkPrototypePollution(metadata);
  if (pollutionError) {
    throw new Error(pollutionError);
  }

  // Check for circular references
  if (hasCircularReferences(metadata)) {
    throw new Error('Metadata cannot contain circular references');
  }

  // Check for dangerous keys (prototype pollution)
  const dangerousKeyError = hasDangerousKeys(metadata);
  if (dangerousKeyError) {
    throw new Error(dangerousKeyError);
  }

  // Check nesting depth
  const nestingDepth = getNestingDepth(metadata);
  if (nestingDepth > MAX_NESTING_DEPTH) {
    throw new Error(`Metadata nesting exceeds ${MAX_NESTING_DEPTH} levels`);
  }

  // Check array limits
  const arrayError = checkArrayLimits(metadata);
  if (arrayError) {
    throw new Error(arrayError);
  }

  // Check size limit (after other checks to fail fast)
  const serialized = JSON.stringify(metadata);
  if (serialized.length > MAX_METADATA_SIZE) {
    throw new Error(`Metadata exceeds 1kb limit`);
  }
}

/**
 * Validate and sanitize metadata (throws on error)
 * Returns sanitized metadata with dangerous keys removed
 */
export function validateAndSanitizeMetadata(
  metadata: unknown
): Record<string, unknown> {
  // Validate first (throws on error)
  validateMetadata(metadata);

  // Sanitize and return
  return sanitizeMetadata(metadata as Record<string, unknown>);
}
