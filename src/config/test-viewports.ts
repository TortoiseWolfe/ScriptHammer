/**
 * Test Viewport Configuration
 * PRP-017: Mobile-First Design Overhaul
 *
 * Defines viewport configurations for Playwright mobile testing
 * Based on real device specifications and common test scenarios
 */

import type { TestViewport } from '@/types/mobile-first';

/**
 * Test viewport configurations for mobile UX testing
 *
 * Includes:
 * - Common mobile devices (iPhone SE, iPhone 12, iPhone 14 Pro Max)
 * - Orientation variants (portrait and landscape)
 * - Extreme cases (minimum width 320px)
 * - Tablet sizes (iPad Mini)
 *
 * Usage in Playwright tests:
 * ```typescript
 * import { TEST_VIEWPORTS } from '@/config/test-viewports';
 *
 * for (const viewport of TEST_VIEWPORTS.filter(v => v.category === 'mobile')) {
 *   test(`renders on ${viewport.name}`, async ({ page }) => {
 *     await page.setViewportSize({ width: viewport.width, height: viewport.height });
 *     // test assertions
 *   });
 * }
 * ```
 */
export const TEST_VIEWPORTS: TestViewport[] = [
  // ========================================================================
  // Mobile Devices - Portrait
  // ========================================================================
  {
    name: 'iPhone SE',
    category: 'mobile',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'iPhone 12',
    category: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'iPhone 13',
    category: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'iPhone 14',
    category: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'iPhone 14 Pro Max',
    category: 'mobile',
    width: 428,
    height: 926,
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  },

  // ========================================================================
  // Mobile Devices - Landscape
  // ========================================================================
  {
    name: 'iPhone 12 Landscape',
    category: 'mobile',
    width: 844,
    height: 390,
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'iPhone 14 Pro Max Landscape',
    category: 'mobile',
    width: 926,
    height: 428,
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  },

  // ========================================================================
  // Extreme Cases
  // ========================================================================
  {
    name: 'Narrow Mobile (320px)',
    category: 'mobile',
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15',
  },

  // ========================================================================
  // Tablet Devices
  // ========================================================================
  {
    name: 'iPad Mini Portrait',
    category: 'tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: false,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
  {
    name: 'iPad Mini Landscape',
    category: 'tablet',
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: false,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
  },
];

/**
 * Get viewport configuration by name
 */
export function getViewport(name: string): TestViewport | undefined {
  return TEST_VIEWPORTS.find(
    (viewport) => viewport.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all viewports for a specific category
 */
export function getViewportsByCategory(
  category: 'mobile' | 'tablet' | 'desktop'
): TestViewport[] {
  return TEST_VIEWPORTS.filter((viewport) => viewport.category === category);
}

/**
 * Get mobile portrait viewports only
 */
export function getMobilePortraitViewports(): TestViewport[] {
  return TEST_VIEWPORTS.filter(
    (v) => v.category === 'mobile' && v.width < v.height
  );
}

/**
 * Get mobile landscape viewports only
 */
export function getMobileLandscapeViewports(): TestViewport[] {
  return TEST_VIEWPORTS.filter(
    (v) => v.category === 'mobile' && v.width > v.height
  );
}

/**
 * Critical mobile widths for horizontal scroll testing
 */
export const CRITICAL_MOBILE_WIDTHS = [320, 375, 390, 428] as const;

/**
 * Standard test pages for mobile UX validation
 */
export const TEST_PAGES = [
  '/',
  '/blog',
  '/blog/countdown-timer-react-tutorial',
] as const;
