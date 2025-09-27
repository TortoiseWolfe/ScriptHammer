import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateDistance } from '@/utils/map-utils';
import type { LatLngTuple } from 'leaflet';

export interface GeolocationState {
  position: GeolocationPosition | null;
  permission: PermissionState;
  loading: boolean;
  error: GeolocationPositionError | null;
  lastUpdated: Date | null;
  accuracy: number | null;
}

export interface UseGeolocationOptions extends PositionOptions {
  watch?: boolean;
}

export interface UseGeolocationReturn extends GeolocationState {
  getCurrentPosition: () => void;
  clearWatch: () => void;
  isSupported: boolean;
  distanceFrom: (target: LatLngTuple) => number | null;
}

/**
 * Hook for managing geolocation state and permissions
 */
export function useGeolocation(
  options?: UseGeolocationOptions
): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    permission: 'prompt',
    loading: false,
    error: null,
    lastUpdated: null,
    accuracy: null,
  });

  const watchId = useRef<number | null>(null);
  const isSupported =
    typeof navigator !== 'undefined' && 'geolocation' in navigator;

  // Check permission status
  useEffect(() => {
    if (!isSupported) return;

    if ('permissions' in navigator && navigator.permissions) {
      try {
        const permissionsQuery = navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });

        if (permissionsQuery && typeof permissionsQuery.then === 'function') {
          permissionsQuery
            .then((permissionStatus) => {
              setState((prev) => ({
                ...prev,
                permission: permissionStatus.state,
              }));

              // Listen for permission changes
              const handleChange = () => {
                setState((prev) => ({
                  ...prev,
                  permission: permissionStatus.state,
                }));
              };

              permissionStatus.addEventListener('change', handleChange);
              return () => {
                permissionStatus.removeEventListener('change', handleChange);
              };
            })
            .catch(() => {
              // Permissions API not supported or failed, continue with default
            });
        }
      } catch {
        // Permissions API not available, continue without it
      }
    }
  }, [isSupported]);

  // Handle success
  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      position,
      permission: 'granted',
      loading: false,
      error: null,
      lastUpdated: new Date(),
      accuracy: position.coords.accuracy,
    });
  }, []);

  // Handle error
  const handleError = useCallback((error: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      loading: false,
      error,
      lastUpdated: new Date(),
      // Only update permission if it's a permission denied error
      permission:
        error.code === error.PERMISSION_DENIED ? 'denied' : prev.permission,
    }));
  }, []);

  // Get current position
  const getCurrentPosition = useCallback(() => {
    if (!isSupported) {
      setState((prev) => ({
        ...prev,
        error: {
          code: 0,
          message: 'Geolocation is not supported by this browser',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options?.enableHighAccuracy ?? true,
      timeout: options?.timeout ?? 5000,
      maximumAge: options?.maximumAge ?? 0,
    };

    if (options?.watch) {
      // Clear existing watch if any
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }

      watchId.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        geoOptions
      );
    } else {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        geoOptions
      );
    }
  }, [isSupported, options, handleSuccess, handleError]);

  // Clear watch
  const clearWatch = useCallback(() => {
    if (watchId.current !== null && isSupported) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, [isSupported]);

  // Calculate distance from a target point
  const distanceFrom = useCallback(
    (target: LatLngTuple): number | null => {
      if (!state.position) return null;

      const currentPos: LatLngTuple = [
        state.position.coords.latitude,
        state.position.coords.longitude,
      ];

      return calculateDistance(currentPos, target);
    },
    [state.position]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null && isSupported) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [isSupported]);

  return {
    ...state,
    getCurrentPosition,
    clearWatch,
    isSupported,
    distanceFrom,
  };
}
