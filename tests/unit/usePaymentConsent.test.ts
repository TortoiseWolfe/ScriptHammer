/**
 * usePaymentConsent Hook Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaymentConsent } from '@/hooks/usePaymentConsent';

describe('usePaymentConsent', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return initial state with no consent', () => {
    const { result } = renderHook(() => usePaymentConsent());

    expect(result.current.hasConsent).toBe(false);
    expect(result.current.showModal).toBe(true);
    expect(result.current.consentDate).toBeNull();
  });

  it('should grant consent and update state', () => {
    const { result } = renderHook(() => usePaymentConsent());

    act(() => {
      result.current.grantConsent();
    });

    expect(result.current.hasConsent).toBe(true);
    expect(result.current.showModal).toBe(false);
    expect(result.current.consentDate).toBeTruthy();
    expect(localStorage.getItem('payment_consent')).toBe('granted');
  });

  it('should decline consent and update state', () => {
    const { result } = renderHook(() => usePaymentConsent());

    act(() => {
      result.current.declineConsent();
    });

    expect(result.current.hasConsent).toBe(false);
    expect(result.current.showModal).toBe(false);
    expect(localStorage.getItem('payment_consent')).toBe('declined');
  });

  it('should reset consent and show modal again', () => {
    const { result } = renderHook(() => usePaymentConsent());

    // First grant consent
    act(() => {
      result.current.grantConsent();
    });

    expect(result.current.hasConsent).toBe(true);
    expect(result.current.showModal).toBe(false);

    // Then reset
    act(() => {
      result.current.resetConsent();
    });

    expect(result.current.hasConsent).toBe(false);
    expect(result.current.showModal).toBe(true);
    expect(result.current.consentDate).toBeNull();
    expect(localStorage.getItem('payment_consent')).toBeNull();
  });

  it('should load existing consent from localStorage', () => {
    const consentDate = new Date().toISOString();
    localStorage.setItem('payment_consent', 'granted');
    localStorage.setItem('payment_consent_date', consentDate);

    const { result } = renderHook(() => usePaymentConsent());

    expect(result.current.hasConsent).toBe(true);
    expect(result.current.showModal).toBe(false);
    expect(result.current.consentDate).toBe(consentDate);
  });

  it('should show modal if previous consent was declined', () => {
    localStorage.setItem('payment_consent', 'declined');

    const { result } = renderHook(() => usePaymentConsent());

    expect(result.current.hasConsent).toBe(false);
    expect(result.current.showModal).toBe(true);
  });

  it('should persist consent date when granting', () => {
    const { result } = renderHook(() => usePaymentConsent());

    const beforeGrant = Date.now();

    act(() => {
      result.current.grantConsent();
    });

    const afterGrant = Date.now();

    const storedDate = localStorage.getItem('payment_consent_date');
    expect(storedDate).toBeTruthy();

    if (storedDate) {
      const timestamp = new Date(storedDate).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeGrant);
      expect(timestamp).toBeLessThanOrEqual(afterGrant);
    }
  });

  it('should not store consent date when declining', () => {
    const { result } = renderHook(() => usePaymentConsent());

    act(() => {
      result.current.declineConsent();
    });

    expect(localStorage.getItem('payment_consent_date')).toBeNull();
  });

  it('should clear both consent and date when resetting', () => {
    const { result } = renderHook(() => usePaymentConsent());

    // First grant consent
    act(() => {
      result.current.grantConsent();
    });

    expect(localStorage.getItem('payment_consent')).toBe('granted');
    expect(localStorage.getItem('payment_consent_date')).toBeTruthy();

    // Then reset
    act(() => {
      result.current.resetConsent();
    });

    expect(localStorage.getItem('payment_consent')).toBeNull();
    expect(localStorage.getItem('payment_consent_date')).toBeNull();
  });
});
