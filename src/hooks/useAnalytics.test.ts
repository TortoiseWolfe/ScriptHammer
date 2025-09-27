import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnalytics } from './useAnalytics';
import * as analytics from '@/utils/analytics';
import { useConsent } from '@/contexts/ConsentContext';
import React from 'react';
import { createMockConsentAllRejected } from '@/test-utils/consent-mocks';

// Mock the analytics utilities
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
  trackError: vi.fn(),
}));

// Mock the ConsentContext
vi.mock('@/contexts/ConsentContext', () => ({
  ConsentProvider: ({ children }: { children: React.ReactNode }) => children,
  useConsent: vi.fn(() => ({
    consent: {
      necessary: true,
      functional: false,
      analytics: true,
      marketing: false,
    },
  })),
}));

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all tracking functions', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(result.current).toHaveProperty('trackEvent');
    expect(result.current).toHaveProperty('trackThemeChange');
    expect(result.current).toHaveProperty('trackFormSubmit');
    expect(result.current).toHaveProperty('trackPWAInstall');
    expect(result.current).toHaveProperty('trackError');
    expect(result.current).toHaveProperty('trackSearch');
    expect(result.current).toHaveProperty('trackClick');
  });

  describe('when analytics consent is granted', () => {
    it('should track theme changes', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackThemeChange('dark', 'light');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'theme_change',
        'UI',
        'dark',
        undefined,
        { previous_theme: 'light' }
      );
    });

    it('should track form submissions', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackFormSubmit('contact_form', true);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'form_submit',
        'Forms',
        'contact_form',
        undefined,
        { success: true }
      );
    });

    it('should track PWA install events', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackPWAInstall('accepted', 'iOS');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'pwa_install',
        'PWA',
        'accepted',
        undefined,
        { platform: 'iOS' }
      );
    });

    it('should track errors', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackError('Network error', true);

      expect(analytics.trackError).toHaveBeenCalledWith('Network error', true);
    });

    it('should track search queries', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackSearch('test query');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'search',
        'Site Search',
        'test query'
      );
    });

    it('should track clicks', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackClick('header_logo', 'Navigation');

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'click',
        'Navigation',
        'header_logo'
      );
    });

    it('should track custom events', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackEvent('custom_action', 'Custom', 'label', 42);

      expect(analytics.trackEvent).toHaveBeenCalledWith(
        'custom_action',
        'Custom',
        'label',
        42
      );
    });
  });

  describe('when analytics consent is denied', () => {
    beforeEach(() => {
      // Mock consent as denied
      vi.mocked(useConsent).mockReturnValue(createMockConsentAllRejected());
    });

    it('should not track theme changes', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackThemeChange('dark');

      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });

    it('should not track form submissions', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackFormSubmit('contact_form');

      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });

    it('should not track PWA install events', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackPWAInstall('dismissed');

      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });

    it('should not track errors', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackError('Error message');

      expect(analytics.trackError).not.toHaveBeenCalled();
    });

    it('should not track search queries', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackSearch('query');

      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });

    it('should not track clicks', () => {
      const { result } = renderHook(() => useAnalytics());

      result.current.trackClick('button', 'UI');

      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });
  });
});
