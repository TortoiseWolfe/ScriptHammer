import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ConsentProvider, useConsent } from '@/contexts/ConsentContext';
import React from 'react';

// Type for gtag calls in dataLayer
type GtagCall = [string, ...unknown[]];

describe('Analytics and Consent Integration', () => {
  beforeEach(() => {
    // Clean window object - use Reflect.deleteProperty for strict mode
    const win = window as Window & { gtag?: unknown; dataLayer?: unknown };

    // Make properties configurable so they can be deleted
    if ('gtag' in win) {
      Object.defineProperty(win, 'gtag', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(win, 'gtag');
    }
    if ('dataLayer' in win) {
      Object.defineProperty(win, 'dataLayer', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(win, 'dataLayer');
    }

    vi.clearAllMocks();

    // Set measurement ID
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123456';

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up - use Reflect.deleteProperty for strict mode
    const win = window as Window & { gtag?: unknown; dataLayer?: unknown };

    // Make properties configurable so they can be deleted
    if ('gtag' in win) {
      Object.defineProperty(win, 'gtag', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(win, 'gtag');
    }
    if ('dataLayer' in win) {
      Object.defineProperty(win, 'dataLayer', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(win, 'dataLayer');
    }

    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    vi.resetModules();
    localStorage.clear();
  });

  describe('Analytics respects consent', () => {
    it('should not initialize GA when analytics consent is denied', async () => {
      // Set consent to denied in localStorage
      localStorage.setItem(
        'cookie-consent',
        JSON.stringify({
          necessary: true,
          functional: false,
          analytics: false,
          marketing: false,
        })
      );

      // Import analytics module
      const { isAnalyticsEnabled } = await import('@/utils/analytics');

      // Render consent provider
      const { result } = renderHook(() => useConsent(), {
        wrapper: ({ children }) => (
          <ConsentProvider>{children}</ConsentProvider>
        ),
      });

      // Check consent state
      expect(result.current.consent.analytics).toBe(false);

      // GA should not be enabled when consent is false
      expect(isAnalyticsEnabled()).toBe(false);
    });

    it('should initialize GA when analytics consent is granted', async () => {
      // Import analytics module
      const { initializeGA, isAnalyticsEnabled, updateGAConsent } =
        await import('@/utils/analytics');

      // Initialize GA directly
      initializeGA();

      // Update consent to granted
      updateGAConsent(true);

      // GA should be enabled
      expect(isAnalyticsEnabled()).toBe(true);
      expect(window.gtag).toBeDefined();
      expect(window.dataLayer).toBeDefined();

      // Check that consent was updated to granted
      const consentUpdate = window.dataLayer?.find(
        (call): call is GtagCall =>
          Array.isArray(call) && call[0] === 'consent' && call[1] === 'update'
      );

      expect(consentUpdate).toBeDefined();
      expect(consentUpdate?.[2]).toEqual({
        analytics_storage: 'granted',
      });
    });

    it('should handle consent updates', async () => {
      const { initializeGA, updateGAConsent } = await import(
        '@/utils/analytics'
      );

      // Initialize GA with default consent (denied)
      initializeGA();

      // First update to denied
      updateGAConsent(false);

      // Then update to granted
      updateGAConsent(true);

      // Check that both consent updates were sent
      const consentUpdates = window.dataLayer?.filter(
        (call): call is GtagCall =>
          Array.isArray(call) && call[0] === 'consent' && call[1] === 'update'
      );

      expect(consentUpdates).toBeDefined();
      expect(consentUpdates?.length).toBeGreaterThanOrEqual(2);

      // Check the last update is granted
      const lastUpdate = consentUpdates?.[consentUpdates.length - 1];
      expect(lastUpdate?.[2]).toEqual({
        analytics_storage: 'granted',
      });
    });
  });

  describe('CSP and Security', () => {
    it('should initialize with privacy-first defaults', async () => {
      const { initializeGA } = await import('@/utils/analytics');

      initializeGA();

      // Check default consent is denied
      const defaultConsent = window.dataLayer?.find(
        (call): call is GtagCall =>
          Array.isArray(call) && call[0] === 'consent' && call[1] === 'default'
      );

      expect(defaultConsent).toBeDefined();
      expect(defaultConsent?.[2]).toEqual({
        analytics_storage: 'denied',
        ad_storage: 'denied',
      });
    });

    it('should handle missing measurement ID', async () => {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      vi.resetModules();

      const { initializeGA, isAnalyticsEnabled } = await import(
        '@/utils/analytics'
      );

      // Should not throw
      expect(() => initializeGA()).not.toThrow();

      // Should not be enabled
      expect(isAnalyticsEnabled()).toBe(false);
      expect(window.gtag).toBeUndefined();
    });

    it('should handle ad blocker scenarios gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Simulate blocked script
      Object.defineProperty(window, 'gtag', {
        get() {
          throw new Error('Blocked by ad blocker');
        },
        set() {}, // Add setter to allow cleanup
        configurable: true,
      });

      const { isAnalyticsEnabled } = await import('@/utils/analytics');

      // Should not throw
      expect(() => isAnalyticsEnabled()).not.toThrow();

      // Clean up - use Reflect.deleteProperty for strict mode
      const win = window as Window & { gtag?: unknown };
      Object.defineProperty(win, 'gtag', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(win, 'gtag');
      consoleSpy.mockRestore();
    });
  });

  describe('Event Tracking with Consent', () => {
    it('should track events when consent is granted', async () => {
      const { initializeGA, updateGAConsent, trackEvent } = await import(
        '@/utils/analytics'
      );

      // Initialize and grant consent
      initializeGA();
      updateGAConsent(true);

      // Track an event
      trackEvent('test_event', 'Test Category', 'Test Label', 42);

      // Check event was tracked
      const eventCall = window.dataLayer?.find(
        (call): call is GtagCall =>
          Array.isArray(call) && call[0] === 'event' && call[1] === 'test_event'
      );

      expect(eventCall).toBeDefined();
      expect(eventCall?.[2]).toEqual({
        event_category: 'Test Category',
        event_label: 'Test Label',
        value: 42,
      });
    });

    it('should not track events without initialization', async () => {
      const { trackEvent } = await import('@/utils/analytics');

      // Try to track without initialization
      trackEvent('test_event', 'Test Category');

      // Should not create dataLayer
      expect(window.dataLayer).toBeUndefined();
    });
  });
});
