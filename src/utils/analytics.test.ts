import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GtagFunction } from '@/types/analytics.types';

// Type for window with gtag properties
interface WindowWithGtag {
  gtag?: GtagFunction;
  dataLayer?: unknown[];
}

// Type for gtag calls in dataLayer
type GtagCall = [string, ...unknown[]];

describe('Analytics Utilities', () => {
  beforeEach(() => {
    // Reset window.gtag and dataLayer - use Reflect.deleteProperty for strict mode
    const windowWithGtag = window as unknown as WindowWithGtag;

    // Make properties configurable so they can be deleted
    if ('gtag' in windowWithGtag) {
      Object.defineProperty(windowWithGtag, 'gtag', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(windowWithGtag, 'gtag');
    }
    if ('dataLayer' in windowWithGtag) {
      Object.defineProperty(windowWithGtag, 'dataLayer', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(windowWithGtag, 'dataLayer');
    }

    vi.clearAllMocks();

    // Set environment variable
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123456';
  });

  afterEach(() => {
    // Clean up - use Reflect.deleteProperty for strict mode
    const windowWithGtag = window as unknown as WindowWithGtag;

    // Make properties configurable so they can be deleted
    if ('gtag' in windowWithGtag) {
      Object.defineProperty(windowWithGtag, 'gtag', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(windowWithGtag, 'gtag');
    }
    if ('dataLayer' in windowWithGtag) {
      Object.defineProperty(windowWithGtag, 'dataLayer', {
        value: undefined,
        configurable: true,
      });
      Reflect.deleteProperty(windowWithGtag, 'dataLayer');
    }

    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

    // Clear module cache to ensure fresh import
    vi.resetModules();
  });

  describe('initializeGA', () => {
    it('should add gtag function to window', async () => {
      const { initializeGA } = await import('./analytics');

      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();

      initializeGA();

      expect(window.gtag).toBeDefined();
      expect(typeof window.gtag).toBe('function');
      expect(window.dataLayer).toBeDefined();
      expect(Array.isArray(window.dataLayer)).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const { initializeGA } = await import('./analytics');

      initializeGA();
      const firstDataLayer = window.dataLayer;

      initializeGA();
      expect(window.dataLayer).toBe(firstDataLayer);
    });
  });

  describe('updateGAConsent', () => {
    it('should update consent to granted when true', async () => {
      const { initializeGA, updateGAConsent } = await import('./analytics');

      initializeGA();
      updateGAConsent(true);

      const consentUpdate = window.dataLayer?.find(
        (call): call is GtagCall =>
          Array.isArray(call) && call[0] === 'consent' && call[1] === 'update'
      );

      expect(consentUpdate).toBeDefined();
      expect(consentUpdate?.[2]).toEqual({
        analytics_storage: 'granted',
      });
    });

    it('should update consent to denied when false', async () => {
      const { initializeGA, updateGAConsent } = await import('./analytics');

      initializeGA();
      updateGAConsent(false);

      const consentUpdate = window.dataLayer?.find(
        (call): call is GtagCall =>
          Array.isArray(call) && call[0] === 'consent' && call[1] === 'update'
      );

      expect(consentUpdate).toBeDefined();
      expect(consentUpdate?.[2]).toEqual({
        analytics_storage: 'denied',
      });
    });
  });

  describe('trackEvent', () => {
    it('should send event with all parameters', async () => {
      const { initializeGA, trackEvent } = await import('./analytics');

      initializeGA();
      trackEvent('click', 'UI', 'button', 1);

      const eventCall = window.dataLayer?.find(
        (call): call is GtagCall =>
          Array.isArray(call) && call[0] === 'event' && call[1] === 'click'
      );

      expect(eventCall).toBeDefined();
      expect(eventCall?.[2]).toEqual({
        event_category: 'UI',
        event_label: 'button',
        value: 1,
      });
    });

    it('should not track event if gtag is not initialized', async () => {
      const { trackEvent } = await import('./analytics');

      const initialLength = window.dataLayer?.length || 0;
      trackEvent('click', 'UI');
      expect(window.dataLayer?.length || 0).toBe(initialLength);
    });
  });

  describe('isAnalyticsEnabled', () => {
    it('should return true when gtag exists and measurement ID is set', async () => {
      const { initializeGA, isAnalyticsEnabled } = await import('./analytics');

      initializeGA();
      expect(isAnalyticsEnabled()).toBe(true);
    });

    it('should return false when gtag is not defined', async () => {
      const { isAnalyticsEnabled } = await import('./analytics');

      expect(isAnalyticsEnabled()).toBe(false);
    });

    it('should return false when measurement ID is not set', async () => {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      vi.resetModules(); // Clear module cache

      const { isAnalyticsEnabled } = await import('./analytics');
      expect(isAnalyticsEnabled()).toBe(false);
    });
  });
});
