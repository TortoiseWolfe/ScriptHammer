'use client';

import React, { useEffect } from 'react';
import { Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngTuple } from 'leaflet';
import { useEmbedThemeColor } from '@/hooks/useEmbedThemeColor';

export interface LocationMarkerProps {
  position: LatLngTuple;
  accuracy?: number;
  showAccuracy?: boolean;
  popup?: string;
  draggable?: boolean;
  onDragEnd?: (position: LatLngTuple) => void;
  testId?: string;
}

// Custom blue marker icon for user location
const userLocationIcon =
  typeof window !== 'undefined'
    ? L.divIcon({
        className: 'user-location-marker',
        html: `
    <div class="relative">
      <div class="absolute inset-0 bg-primary rounded-full animate-ping opacity-75"></div>
      <div class="relative bg-primary rounded-full w-4 h-4 border-2 border-white shadow-lg"></div>
    </div>
  `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
    : undefined;

export const LocationMarker: React.FC<LocationMarkerProps> = ({
  position,
  accuracy = 0,
  showAccuracy = true,
  popup,
  draggable = false,
  onDragEnd,
  testId = 'user-location-marker',
}) => {
  const map = useMap();

  // Accuracy circle tracks the active DaisyUI theme's primary color (issue #37),
  // matching the marker dot (which uses the `bg-primary` class). The hook
  // re-renders on theme switch so the circle recolors live.
  const { hexWithHash: themeColor } = useEmbedThemeColor('p');

  useEffect(() => {
    // Pan to user location when marker updates
    map.setView(position, map.getZoom());
  }, [position, map]);

  const handleDragEnd = (event: L.DragEndEvent) => {
    const marker = event.target;
    const newPosition = marker.getLatLng();
    if (onDragEnd) {
      onDragEnd([newPosition.lat, newPosition.lng]);
    }
  };

  return (
    <>
      {showAccuracy && accuracy > 0 && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{
            color: themeColor,
            fillColor: themeColor,
            fillOpacity: 0.2,
            weight: 1,
          }}
          data-testid="accuracy-circle"
        />
      )}

      <Marker
        position={position}
        draggable={draggable}
        icon={userLocationIcon}
        eventHandlers={{
          dragend: handleDragEnd,
        }}
      >
        {popup && (
          <Popup>
            <div data-testid={testId} data-position={JSON.stringify(position)}>
              {popup}
            </div>
          </Popup>
        )}
        {!popup && (
          <Popup>
            <div data-testid={testId} data-position={JSON.stringify(position)}>
              <strong>Your Location</strong>
              <br />
              Lat: {position[0].toFixed(4)}
              <br />
              Lng: {position[1].toFixed(4)}
              {accuracy > 0 && (
                <>
                  <br />
                  Accuracy: ±{accuracy.toFixed(0)}m
                </>
              )}
            </div>
          </Popup>
        )}
      </Marker>
    </>
  );
};
