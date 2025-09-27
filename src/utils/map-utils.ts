import type { LatLngTuple } from 'leaflet';

/**
 * Default map configuration
 */
export const DEFAULT_MAP_CONFIG = {
  center: [51.505, -0.09] as LatLngTuple, // London
  zoom: 13,
  minZoom: 1,
  maxZoom: 18,
  height: '400px',
  width: '100%',
  showUserLocation: false,
  allowZoom: true,
  allowPan: true,
  scrollWheelZoom: false, // Better accessibility
  keyboardNavigation: true,
  zoomControl: true,
};

/**
 * Fix Leaflet icon paths for Next.js
 * This is needed because Leaflet's default icon paths are broken in webpack
 */
export async function fixLeafletIconPaths() {
  // Only run on client side
  if (typeof window === 'undefined') return;

  // Dynamically import Leaflet only on client side
  const L = (await import('leaflet')).default;

  // Delete the default icon to force re-initialization
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
    ._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
}

/**
 * Calculate distance between two points in meters
 * Uses Haversine formula
 */
export function calculateDistance(
  point1: LatLngTuple,
  point2: LatLngTuple
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1[0] * Math.PI) / 180;
  const φ2 = (point2[0] * Math.PI) / 180;
  const Δφ = ((point2[0] - point1[0]) * Math.PI) / 180;
  const Δλ = ((point2[1] - point1[1]) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validate latitude value
 */
export function isValidLatitude(lat: number): boolean {
  return !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 */
export function isValidLongitude(lng: number): boolean {
  return !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Validate LatLng tuple
 */
export function isValidLatLng(latlng: unknown): latlng is LatLngTuple {
  return (
    Array.isArray(latlng) &&
    latlng.length === 2 &&
    isValidLatitude(latlng[0]) &&
    isValidLongitude(latlng[1])
  );
}

/**
 * Validate zoom level
 */
export function isValidZoom(zoom: number, min = 1, max = 18): boolean {
  return !isNaN(zoom) && zoom >= min && zoom <= max && Number.isInteger(zoom);
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(
    4
  )}°${lngDir}`;
}

/**
 * Get user-friendly error message for geolocation errors
 */
export function getGeolocationErrorMessage(
  error: GeolocationPositionError
): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access was denied. Please enable location permissions in your browser settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Your location could not be determined. Please check your device settings.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return 'An unknown error occurred while getting your location.';
  }
}

/**
 * OpenStreetMap tile URL template
 */
export const OSM_TILE_URL =
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * OpenStreetMap attribution
 */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Map error codes
 */
export enum MapErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  TILE_LOAD_ERROR = 'TILE_LOAD_ERROR',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  LEAFLET_INIT_ERROR = 'LEAFLET_INIT_ERROR',
}

/**
 * Create a custom map error
 */
export function createMapError(
  code: MapErrorCode,
  message: string,
  details?: unknown
): Error {
  const error = new Error(message) as Error & {
    code: MapErrorCode;
    details?: unknown;
  };
  error.code = code;
  error.details = details;
  return error;
}
