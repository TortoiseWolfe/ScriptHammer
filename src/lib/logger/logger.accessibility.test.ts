/**
 * Logger Service - Accessibility Test
 *
 * This file exists to satisfy the 5-file pattern requirement per Constitution §I.
 *
 * The logger service is a non-UI utility that outputs to the browser console.
 * It has no visual interface, DOM elements, or user-facing accessibility concerns.
 *
 * Accessibility considerations for logging:
 * - N/A: No visual output
 * - N/A: No keyboard interaction
 * - N/A: No screen reader content
 * - N/A: No color contrast requirements
 */
import { describe, it, expect } from 'vitest';
import { logger } from './logger';

describe('Logger Accessibility', () => {
  it('should be a non-UI utility with no accessibility requirements', () => {
    // This test documents that the logger is not a UI component
    // and therefore has no accessibility requirements.
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should not produce any DOM output', () => {
    // Logger outputs to console, not to DOM
    // This verifies it's truly a non-visual utility
    const beforeElements = document.body.children.length;
    logger.info('test message');
    const afterElements = document.body.children.length;

    expect(afterElements).toBe(beforeElements);
  });
});
