import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

type PositionCallback = (position: GeolocationPosition) => void;
type PositionErrorCallback = (error: GeolocationPositionError) => void;

describe('useGeolocation', () => {
  let mockGeolocation: any;
  let mockPermissions: any;

  beforeEach(() => {
    // Mock geolocation API
    mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    // Mock permissions API
    mockPermissions = {
      query: vi.fn(),
    };

    // Apply mocks to navigator
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global.navigator, 'permissions', {
      value: mockPermissions,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset navigator mocks
    vi.unstubAllGlobals();
  });

  it('should initialize with default state', () => {
    mockPermissions.query.mockResolvedValue({ state: 'prompt' });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.position).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.permission).toBe('prompt');
    expect(result.current.isSupported).toBe(true);
  });

  it('should get current position when requested', async () => {
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: 51.505,
        longitude: -0.09,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({ latitude: 51.505, longitude: -0.09, accuracy: 10 }),
      } as GeolocationCoordinates,
      timestamp: Date.now(),
      toJSON: () => ({
        coords: { latitude: 51.505, longitude: -0.09, accuracy: 10 },
        timestamp: Date.now(),
      }),
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback) => {
        setTimeout(() => success(mockPosition), 0);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    await act(async () => {
      result.current.getCurrentPosition();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.position).toEqual(mockPosition);
      expect(result.current.loading).toBe(false);
      expect(result.current.permission).toBe('granted');
    });
  });

  it('should handle permission denied error', async () => {
    const mockError: GeolocationPositionError = {
      code: 1,
      message: 'User denied geolocation',
      PERMISSION_DENIED: 1 as const,
      POSITION_UNAVAILABLE: 2 as const,
      TIMEOUT: 3 as const,
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback, error: PositionErrorCallback) => {
        error(mockError);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'prompt' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
      expect(result.current.loading).toBe(false);
      expect(result.current.permission).toBe('denied');
    });
  });

  it('should handle position unavailable error', async () => {
    const mockError: GeolocationPositionError = {
      code: 2,
      message: 'Position unavailable',
      PERMISSION_DENIED: 1 as const,
      POSITION_UNAVAILABLE: 2 as const,
      TIMEOUT: 3 as const,
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback, error: PositionErrorCallback) => {
        error(mockError);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
      expect(result.current.loading).toBe(false);
      // Permission should remain granted as this is not a permission error
      expect(result.current.permission).toBe('granted');
    });
  });

  it('should handle timeout error', async () => {
    const mockError: GeolocationPositionError = {
      code: 3,
      message: 'Timeout',
      PERMISSION_DENIED: 1 as const,
      POSITION_UNAVAILABLE: 2 as const,
      TIMEOUT: 3 as const,
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback, error: PositionErrorCallback) => {
        error(mockError);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
      expect(result.current.loading).toBe(false);
      expect(result.current.permission).toBe('granted');
    });
  });

  it('should watch position when watch option is true', () => {
    const watchId = 123;
    mockGeolocation.watchPosition.mockReturnValue(watchId);
    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation({ watch: true }));

    act(() => {
      result.current.getCurrentPosition();
    });

    expect(mockGeolocation.watchPosition).toHaveBeenCalled();
  });

  it('should clear watch when clearWatch is called', () => {
    const watchId = 123;
    mockGeolocation.watchPosition.mockReturnValue(watchId);
    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation({ watch: true }));

    act(() => {
      result.current.getCurrentPosition();
    });

    act(() => {
      result.current.clearWatch();
    });

    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId);
  });

  it('should calculate distance from target correctly', () => {
    const mockPosition: GeolocationPosition = {
      coords: {
        latitude: 51.505,
        longitude: -0.09,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({ latitude: 51.505, longitude: -0.09, accuracy: 10 }),
      } as GeolocationCoordinates,
      timestamp: Date.now(),
      toJSON: () => ({
        coords: { latitude: 51.505, longitude: -0.09, accuracy: 10 },
        timestamp: Date.now(),
      }),
    };

    mockGeolocation.getCurrentPosition.mockImplementation(
      (success: PositionCallback) => {
        success(mockPosition);
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getCurrentPosition();
    });

    waitFor(() => {
      const distance = result.current.distanceFrom([51.51, -0.08]);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1000); // Should be less than 1km for nearby points
    });
  });

  it('should handle missing geolocation API', () => {
    // Save original geolocation
    const originalGeolocation = global.navigator.geolocation;

    // Completely remove geolocation from navigator
    delete (global.navigator as any).geolocation;

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.isSupported).toBe(false);

    act(() => {
      result.current.getCurrentPosition();
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain('not supported');

    // Restore original geolocation
    Object.defineProperty(global.navigator, 'geolocation', {
      value: originalGeolocation,
      writable: true,
      configurable: true,
    });
  });

  it('should handle missing permissions API gracefully', async () => {
    // Remove permissions from navigator
    Object.defineProperty(global.navigator, 'permissions', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    // Should still work, just without pre-checking permission
    expect(result.current.permission).toBe('prompt');
  });

  it('should update permission state when it changes', async () => {
    const mockPermissionStatus = {
      state: 'prompt',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockPermissions.query.mockResolvedValue(mockPermissionStatus);

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.permission).toBe('prompt');
    });

    // Simulate permission change
    act(() => {
      mockPermissionStatus.state = 'granted';
      const changeHandler =
        mockPermissionStatus.addEventListener.mock.calls[0][1];
      changeHandler();
    });

    await waitFor(() => {
      expect(result.current.permission).toBe('granted');
    });
  });

  it('should accept custom options', () => {
    type PositionOptions = {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    };
    mockGeolocation.getCurrentPosition.mockImplementation(
      (
        success: PositionCallback,
        error: PositionErrorCallback,
        options: PositionOptions
      ) => {
        expect(options).toEqual({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5000,
        });
      }
    );

    mockPermissions.query.mockResolvedValue({ state: 'granted' });

    const { result } = renderHook(() =>
      useGeolocation({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5000,
      })
    );

    act(() => {
      result.current.getCurrentPosition();
    });

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
  });
});
