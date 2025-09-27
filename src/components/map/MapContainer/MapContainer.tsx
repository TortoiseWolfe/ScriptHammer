'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap, LatLngTuple } from 'leaflet';
import { fixLeafletIconPaths, DEFAULT_MAP_CONFIG } from '@/utils/map-utils';
import { LocationButton } from '@/components/map/LocationButton';
import 'leaflet/dist/leaflet.css';

export interface MapContainerProps {
  center?: LatLngTuple;
  zoom?: number;
  height?: string;
  width?: string;
  showUserLocation?: boolean;
  markers?: Array<{
    position: LatLngTuple;
    popup?: string;
    id: string;
  }>;
  onLocationFound?: (position: GeolocationPosition) => void;
  onLocationError?: (error: GeolocationPositionError) => void;
  onMapReady?: (map: LeafletMap) => void;
  className?: string;
  testId?: string;
  style?: React.CSSProperties;
  config?: {
    center?: LatLngTuple;
    zoom?: number;
    height?: string;
    showUserLocation?: boolean;
    allowZoom?: boolean;
    allowPan?: boolean;
    scrollWheelZoom?: boolean;
    keyboardNavigation?: boolean;
    zoomControl?: boolean;
    tileUrl?: string;
    attribution?: string;
  };
  children?: React.ReactNode;
}

const MapContainerInner = dynamic(() => import('./MapContainerInner'), {
  ssr: false,
  loading: () => (
    <div className="bg-base-200 flex h-full items-center justify-center">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  ),
});

export const MapContainer: React.FC<MapContainerProps> = ({
  center = DEFAULT_MAP_CONFIG.center,
  zoom = DEFAULT_MAP_CONFIG.zoom,
  height = DEFAULT_MAP_CONFIG.height,
  width = DEFAULT_MAP_CONFIG.width,
  showUserLocation = false,
  markers = [],
  onLocationFound,
  onLocationError,
  onMapReady,
  className = '',
  testId = 'map-container',
  style,
  config,
  children,
}) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    fixLeafletIconPaths();
  }, []);

  const handleMapReady = useCallback(
    (map: LeafletMap) => {
      mapRef.current = map;
      // Expose map instance to window for testing
      if (typeof window !== 'undefined') {
        (window as Window & { leafletMap?: LeafletMap }).leafletMap = map;
      }
      if (onMapReady) {
        onMapReady(map);
      }
    },
    [onMapReady]
  );

  const handleLocationClick = useCallback(() => {
    if (!mapRef.current) return;

    setLocationLoading(true);

    if (!navigator.geolocation) {
      setLocationLoading(false);
      if (onLocationError) {
        const error: GeolocationPositionError = {
          code: 2,
          message: 'Geolocation is not supported by this browser',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        };
        onLocationError(error);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLoading(false);
        if (onLocationFound) {
          onLocationFound(position);
        }
        // Pan map to user location
        if (mapRef.current) {
          mapRef.current.setView(
            [position.coords.latitude, position.coords.longitude],
            16
          );
        }
      },
      (error) => {
        setLocationLoading(false);
        if (onLocationError) {
          onLocationError(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [onLocationFound, onLocationError]);

  return (
    <div
      data-testid={testId}
      className={`relative ${className}`}
      style={{ height: config?.height || height, width, ...style }}
      role="application"
      aria-label="Interactive map"
    >
      <MapContainerInner
        center={config?.center || center}
        zoom={config?.zoom || zoom}
        showUserLocation={config?.showUserLocation || showUserLocation}
        markers={markers}
        onLocationFound={onLocationFound}
        onLocationError={onLocationError}
        onMapReady={handleMapReady}
        tileUrl={config?.tileUrl}
        attribution={config?.attribution}
        scrollWheelZoom={config?.scrollWheelZoom}
        zoomControl={config?.zoomControl}
        keyboardNavigation={config?.keyboardNavigation}
      >
        {children}
      </MapContainerInner>
      {showUserLocation && (
        <LocationButton
          onClick={handleLocationClick}
          loading={locationLoading}
          className="absolute top-4 right-4 z-[1000]"
        />
      )}
    </div>
  );
};
