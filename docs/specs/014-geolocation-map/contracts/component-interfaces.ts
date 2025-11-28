/**
 * Component Contracts for Geolocation Map Feature
 * These interfaces define the public API contracts for all map components
 */

import { CSSProperties, ReactNode } from 'react';
import { LatLngTuple } from 'leaflet';

// ============================================================================
// Type Definitions
// ============================================================================

export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface GeolocationPosition {
  coords: GeolocationCoordinates;
  timestamp: number;
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export interface GeolocationPositionError {
  code: number;
  message: string;
  PERMISSION_DENIED: number;
  POSITION_UNAVAILABLE: number;
  TIMEOUT: number;
}

// ============================================================================
// Component Props Contracts
// ============================================================================

/**
 * MapContainer Component Contract
 * Main map component that renders the interactive map
 */
export interface MapContainerProps {
  /**
   * Map configuration options
   */
  config?: Partial<MapConfiguration>;

  /**
   * Array of markers to display on the map
   */
  markers?: MarkerData[];

  /**
   * Configuration for user location marker
   */
  userMarker?: Partial<MarkerData>;

  /**
   * Whether to show user location features
   * @default false
   */
  showUserLocation?: boolean;

  /**
   * Callback when map instance is ready
   */
  onMapReady?: (map: L.Map) => void;

  /**
   * Callback when user location is found
   */
  onLocationFound?: (position: GeolocationPosition) => void;

  /**
   * Callback when location error occurs
   */
  onLocationError?: (error: GeolocationPositionError) => void;

  /**
   * Callback when marker is clicked
   */
  onMarkerClick?: (marker: MarkerData) => void;

  /**
   * Child components to render within map
   */
  children?: ReactNode;

  /**
   * CSS class name for styling
   */
  className?: string;

  /**
   * Inline styles
   */
  style?: CSSProperties;

  /**
   * Test ID for testing
   */
  testId?: string;
}

/**
 * LocationButton Component Contract
 * Button to request user's current location
 */
export interface LocationButtonProps {
  /**
   * Current permission state
   */
  permission: PermissionState;

  /**
   * Whether location is being fetched
   */
  loading?: boolean;

  /**
   * Click handler for location request
   */
  onClick: () => void;

  /**
   * Button variant
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';

  /**
   * Button size
   * @default 'md'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /**
   * Whether to show text label
   * @default true
   */
  showLabel?: boolean;

  /**
   * Custom aria-label for accessibility
   */
  ariaLabel?: string;

  /**
   * CSS class name
   */
  className?: string;

  /**
   * Whether button is disabled
   */
  disabled?: boolean;

  /**
   * Test ID for testing
   */
  testId?: string;
}

/**
 * LocationMarker Component Contract
 * Marker showing user's current location
 */
export interface LocationMarkerProps {
  /**
   * User's position coordinates
   */
  position: LatLngTuple;

  /**
   * Accuracy radius in meters
   */
  accuracy?: number;

  /**
   * Whether to show accuracy circle
   * @default true
   */
  showAccuracy?: boolean;

  /**
   * Popup content for marker
   */
  popup?: string | ReactNode;

  /**
   * Whether to auto-pan map to location
   * @default true
   */
  autoPan?: boolean;

  /**
   * Zoom level when auto-panning
   * @default 15
   */
  autoPanZoom?: number;

  /**
   * Custom icon configuration
   */
  icon?: MarkerIcon;

  /**
   * Test ID for testing
   */
  testId?: string;
}

/**
 * GeolocationConsent Component Contract
 * Modal for requesting geolocation consent
 */
export interface GeolocationConsentProps {
  /**
   * Whether modal is open
   */
  isOpen: boolean;

  /**
   * Handler for consent acceptance
   */
  onAccept: (purposes: GeolocationPurpose[]) => void;

  /**
   * Handler for consent decline
   */
  onDecline: () => void;

  /**
   * Handler for modal close
   */
  onClose: () => void;

  /**
   * Available purposes for selection
   */
  purposes?: GeolocationPurpose[];

  /**
   * Whether consent is required to proceed
   * @default false
   */
  required?: boolean;

  /**
   * Modal title
   * @default 'Location Access'
   */
  title?: string;

  /**
   * Modal description text
   */
  description?: string;

  /**
   * Privacy policy URL
   */
  privacyPolicyUrl?: string;

  /**
   * Test ID for testing
   */
  testId?: string;
}

// ============================================================================
// Data Contracts
// ============================================================================

/**
 * Map Configuration Contract
 */
export interface MapConfiguration {
  center: LatLngTuple;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  height: string;
  width?: string;
  showUserLocation: boolean;
  allowZoom: boolean;
  allowPan: boolean;
  scrollWheelZoom: boolean;
  tileUrl?: string;
  attribution?: string;
  keyboardNavigation: boolean;
  zoomControl: boolean;
}

/**
 * Marker Data Contract
 */
export interface MarkerData {
  id: string;
  position: LatLngTuple;
  title?: string;
  popup?: PopupContent;
  icon?: MarkerIcon;
  draggable?: boolean;
  clickable?: boolean;
  category?: string;
  data?: Record<string, unknown>;
}

/**
 * Popup Content Contract
 */
export interface PopupContent {
  content: string | ReactNode;
  maxWidth?: number;
  closeButton?: boolean;
  autoClose?: boolean;
}

/**
 * Marker Icon Contract
 */
export interface MarkerIcon {
  iconUrl: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
  popupAnchor?: [number, number];
  shadowUrl?: string;
  shadowSize?: [number, number];
}

/**
 * Geolocation Purpose Enum
 */
export enum GeolocationPurpose {
  USER_LOCATION_DISPLAY = 'user_location_display',
  NEARBY_SEARCH = 'nearby_search',
  LOCATION_ANALYTICS = 'location_analytics',
  PERSONALIZATION = 'personalization',
}

// ============================================================================
// Hook Contracts
// ============================================================================

/**
 * useGeolocation Hook Contract
 */
export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

export interface UseGeolocationReturn {
  position: GeolocationPosition | null;
  permission: PermissionState;
  loading: boolean;
  error: GeolocationPositionError | null;
  lastUpdated: Date | null;
  accuracy: number | null;
  getCurrentPosition: () => void;
  clearWatch: () => void;
  isSupported: boolean;
  distanceFrom: (target: LatLngTuple) => number | null;
}

/**
 * useMapConfiguration Hook Contract
 */
export interface UseMapConfigurationReturn {
  config: MapConfiguration;
  updateConfig: (partial: Partial<MapConfiguration>) => void;
  resetConfig: () => void;
  saveConfig: () => void;
  loadConfig: () => void;
}

// ============================================================================
// Test Contracts
// ============================================================================

/**
 * Contract for component testing utilities
 */
export interface MapTestUtils {
  /**
   * Mock geolocation for testing
   */
  mockGeolocation(position: Partial<GeolocationCoordinates>): void;

  /**
   * Mock permission state
   */
  mockPermission(state: PermissionState): void;

  /**
   * Trigger location error
   */
  triggerLocationError(code: number): void;

  /**
   * Wait for map to be ready
   */
  waitForMap(): Promise<L.Map>;

  /**
   * Get marker by ID
   */
  getMarkerById(id: string): L.Marker | null;

  /**
   * Simulate marker click
   */
  clickMarker(id: string): void;

  /**
   * Check if location is visible
   */
  isLocationVisible(lat: number, lng: number): boolean;
}
