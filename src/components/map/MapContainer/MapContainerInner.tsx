import React, { useEffect } from 'react';
import {
  MapContainer as LeafletMapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import type { Map as LeafletMap, LatLngTuple } from 'leaflet';
import L from 'leaflet';
import {
  OSM_TILE_URL,
  OSM_ATTRIBUTION,
  DEFAULT_MAP_CONFIG,
} from '@/utils/map-utils';

interface MapContainerInnerProps {
  center: LatLngTuple;
  zoom: number;
  showUserLocation?: boolean;
  markers?: Array<{
    position: LatLngTuple;
    popup?: string;
    id: string;
  }>;
  onLocationFound?: (position: GeolocationPosition) => void;
  onLocationError?: (error: GeolocationPositionError) => void;
  onMapReady?: (map: LeafletMap) => void;
  tileUrl?: string;
  attribution?: string;
  scrollWheelZoom?: boolean;
  zoomControl?: boolean;
  keyboardNavigation?: boolean;
  children?: React.ReactNode;
}

// Component to handle center updates after map is rendered
const MapCenterUpdater: React.FC<{ center: LatLngTuple }> = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [map, center]);

  return null;
};

const MapEventHandler: React.FC<{
  onMapReady?: (map: LeafletMap) => void;
  showUserLocation?: boolean;
  onLocationFound?: (position: GeolocationPosition) => void;
  onLocationError?: (error: GeolocationPositionError) => void;
}> = ({ onMapReady, showUserLocation, onLocationFound, onLocationError }) => {
  const map = useMap();

  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }

    if (showUserLocation && navigator.geolocation) {
      map.locate({ setView: true, maxZoom: 16 });
    }

    const handleLocationFound = (e: L.LocationEvent) => {
      if (onLocationFound) {
        const position: GeolocationPosition = {
          coords: {
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
            accuracy: e.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({
              latitude: e.latlng.lat,
              longitude: e.latlng.lng,
              accuracy: e.accuracy,
            }),
          } as GeolocationCoordinates,
          timestamp: Date.now(),
          toJSON: () => ({
            coords: {
              latitude: e.latlng.lat,
              longitude: e.latlng.lng,
              accuracy: e.accuracy,
            },
            timestamp: Date.now(),
          }),
        };
        onLocationFound(position);
      }
    };

    const handleLocationError = (e: L.ErrorEvent) => {
      if (onLocationError) {
        let code = 0;
        const message = e.message;

        if (message.includes('denied')) {
          code = 1; // PERMISSION_DENIED
        } else if (message.includes('unavailable')) {
          code = 2; // POSITION_UNAVAILABLE
        } else if (message.includes('timeout')) {
          code = 3; // TIMEOUT
        }

        const error: GeolocationPositionError = {
          code,
          message,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        };
        onLocationError(error);
      }
    };

    map.on('locationfound', handleLocationFound);
    map.on('locationerror', handleLocationError);

    return () => {
      map.off('locationfound', handleLocationFound);
      map.off('locationerror', handleLocationError);
    };
  }, [map, onMapReady, showUserLocation, onLocationFound, onLocationError]);

  return null;
};

const MapContainerInner: React.FC<MapContainerInnerProps> = ({
  center,
  zoom,
  showUserLocation = false,
  markers = [],
  onLocationFound,
  onLocationError,
  onMapReady,
  tileUrl = OSM_TILE_URL,
  attribution = OSM_ATTRIBUTION,
  scrollWheelZoom = DEFAULT_MAP_CONFIG.scrollWheelZoom,
  zoomControl = DEFAULT_MAP_CONFIG.zoomControl,
  keyboardNavigation = DEFAULT_MAP_CONFIG.keyboardNavigation,
  children,
}) => {
  return (
    <LeafletMapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={scrollWheelZoom}
      className="h-full w-full"
      zoomControl={zoomControl}
      keyboard={keyboardNavigation}
    >
      <TileLayer attribution={attribution} url={tileUrl} />

      <MapEventHandler
        onMapReady={onMapReady}
        showUserLocation={showUserLocation}
        onLocationFound={onLocationFound}
        onLocationError={onLocationError}
      />

      <MapCenterUpdater center={center} />

      {markers.map((marker) => (
        <Marker key={marker.id} position={marker.position}>
          {marker.popup && <Popup>{marker.popup}</Popup>}
        </Marker>
      ))}

      {children}
    </LeafletMapContainer>
  );
};

export default MapContainerInner;
