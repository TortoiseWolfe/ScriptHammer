import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaymentConsent } from '@/hooks/usePaymentConsent';

describe('usePaymentConsent', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize with no consent', () => {
    const { result } = renderHook(() => usePaymentConsent());
    expect(result.current.hasConsent).toBe(false);
  });

  it('should grant consent when accepted', () => {
    const { result } = renderHook(() => usePaymentConsent());

    act(() => {
      result.current.grantConsent();
    });

    expect(result.current.hasConsent).toBe(true);
  });

  it('should revoke consent', () => {
    const { result } = renderHook(() => usePaymentConsent());

    act(() => {
      result.current.grantConsent();
    });

    expect(result.current.hasConsent).toBe(true);

    act(() => {
      result.current.revokeConsent();
    });

    expect(result.current.hasConsent).toBe(false);
  });

  it('should persist consent in localStorage', () => {
    const { result } = renderHook(() => usePaymentConsent());

    act(() => {
      result.current.grantConsent();
    });

    // Unmount and remount hook
    const { result: result2 } = renderHook(() => usePaymentConsent());
    expect(result2.current.hasConsent).toBe(true);
  });

  it('should provide requestConsent callback', () => {
    const onRequest = vi.fn();
    const { result } = renderHook(() => usePaymentConsent(onRequest));

    act(() => {
      result.current.requestConsent();
    });

    expect(onRequest).toHaveBeenCalled();
  });
});
