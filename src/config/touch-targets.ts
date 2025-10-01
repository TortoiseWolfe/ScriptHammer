/**
 * Touch Target Standards
 * PRP-017: Mobile-First Design Overhaul
 *
 * Defines touch target size standards for mobile accessibility
 * Following WCAG 2.2 and Apple Human Interface Guidelines
 */

import type { TouchTarget, TouchTargetValidation } from '@/types/mobile-first';

/**
 * Touch target size standards
 *
 * WCAG 2.2 Level AA: Minimum 24×24px
 * WCAG 2.2 Level AAA: Minimum 44×44px (also Apple HIG standard)
 *
 * ScriptHammer targets AAA compliance (44×44px minimum)
 */
export const TOUCH_TARGET_STANDARDS: Record<'AA' | 'AAA', TouchTarget> = {
  AA: {
    minWidth: 24,
    minHeight: 24,
    minSpacing: 0,
    standard: 'WCAG 2.2 Level AA',
  },
  AAA: {
    minWidth: 44,
    minHeight: 44,
    minSpacing: 8,
    standard: 'WCAG 2.2 Level AAA / Apple HIG',
  },
};

/**
 * Default touch target standard for ScriptHammer
 */
export const DEFAULT_TOUCH_TARGET = TOUCH_TARGET_STANDARDS.AAA;

/**
 * Validate if element meets touch target requirements
 *
 * @param actualWidth - Current element width in pixels
 * @param actualHeight - Current element height in pixels
 * @param standard - Compliance level to validate against (default: AAA)
 * @returns Validation result with details
 *
 * @example
 * ```typescript
 * const result = validateTouchTarget(42, 42);
 * if (!result.isValid) {
 *   console.error('Touch target too small:', result.errors);
 * }
 * ```
 */
export function validateTouchTarget(
  actualWidth: number,
  actualHeight: number,
  standard: 'AA' | 'AAA' = 'AAA'
): TouchTargetValidation {
  const requirements = TOUCH_TARGET_STANDARDS[standard];
  const errors: string[] = [];

  if (actualWidth < requirements.minWidth) {
    errors.push(
      `Width ${actualWidth}px is less than minimum ${requirements.minWidth}px`
    );
  }

  if (actualHeight < requirements.minHeight) {
    errors.push(
      `Height ${actualHeight}px is less than minimum ${requirements.minHeight}px`
    );
  }

  return {
    isValid: errors.length === 0,
    actualWidth,
    actualHeight,
    requiredWidth: requirements.minWidth,
    requiredHeight: requirements.minHeight,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate touch target with tolerance (allows 1px variance for sub-pixel rendering)
 *
 * @param actualWidth - Current element width in pixels
 * @param actualHeight - Current element height in pixels
 * @param standard - Compliance level to validate against (default: AAA)
 * @param tolerance - Allowed variance in pixels (default: 1)
 * @returns Whether target meets requirements within tolerance
 */
export function validateTouchTargetWithTolerance(
  actualWidth: number,
  actualHeight: number,
  standard: 'AA' | 'AAA' = 'AAA',
  tolerance: number = 1
): boolean {
  const requirements = TOUCH_TARGET_STANDARDS[standard];

  const widthValid = actualWidth >= requirements.minWidth - tolerance;
  const heightValid = actualHeight >= requirements.minHeight - tolerance;

  return widthValid && heightValid;
}

/**
 * Get minimum touch target size for current standard
 */
export function getMinimumSize(standard: 'AA' | 'AAA' = 'AAA'): number {
  return TOUCH_TARGET_STANDARDS[standard].minWidth;
}

/**
 * Get minimum spacing between touch targets
 */
export function getMinimumSpacing(standard: 'AA' | 'AAA' = 'AAA'): number {
  return TOUCH_TARGET_STANDARDS[standard].minSpacing;
}

/**
 * Tailwind CSS classes for touch target sizing
 *
 * Apply these classes to ensure elements meet AAA standards:
 * - min-w-11 (44px width)
 * - min-h-11 (44px height)
 * - gap-2 or higher (8px+ spacing)
 */
export const TOUCH_TARGET_CLASSES = {
  /** Minimum width class for 44px */
  minWidth: 'min-w-11',
  /** Minimum height class for 44px */
  minHeight: 'min-h-11',
  /** Combined minimum size */
  minSize: 'min-w-11 min-h-11',
  /** Minimum spacing class for 8px */
  minSpacing: 'gap-2',
  /** Full touch-friendly button classes */
  button: 'min-w-11 min-h-11 gap-2',
} as const;

/**
 * Interactive element selectors for testing
 */
export const INTERACTIVE_ELEMENT_SELECTORS = [
  'button',
  'a[href]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '[role="button"]',
  '[role="link"]',
  'label',
  'select',
  'textarea',
] as const;

/**
 * Get CSS selector for all interactive elements
 */
export function getInteractiveElementSelector(): string {
  return INTERACTIVE_ELEMENT_SELECTORS.join(', ');
}
