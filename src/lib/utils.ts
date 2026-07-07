/**
 * Utility functions for common operations
 */

/**
 * Concatenate class names, filtering out falsy values.
 * Simple alternative to clsx/classnames when full functionality isn't needed.
 *
 * @example
 * cn('base-class', condition && 'conditional-class', className)
 * // Returns: "base-class conditional-class custom-class"
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
