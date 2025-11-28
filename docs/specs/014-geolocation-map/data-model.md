# Data Model: Geolocation Map Feature

**Feature**: Interactive Map with Geolocation Support
**Date**: 2025-01-17
**Version**: 1.0.0

## Overview

Data structures and type definitions for the geolocation map feature. All models are client-side only with no backend persistence required.

## Core Entities

### 1. GeolocationState

**Purpose**: Manages user location data and permission state

```typescript
interface GeolocationState {
  // Location data
  position: GeolocationPosition | null;

  // Permission state
  permission: PermissionState; // 'granted' | 'denied' | 'prompt'

  // Loading states
  loading: boolean;

  // Error handling
  error: GeolocationPositionError | null;

  // Metadata
  lastUpdated: Date | null;
  accuracy: number | null; // meters
}
```

**Validation Rules**:

- `position` is null until location obtained
- `permission` defaults to 'prompt'
- `accuracy` must be positive number in meters
- `lastUpdated` set when position updates

**State Transitions**:

```
prompt → (user action) → granted → (location obtained) → has position
prompt → (user action) → denied → (error state)
granted → (user revokes) → denied
```

### 2. MapConfiguration

**Purpose**: Configures map display and behavior

```typescript
interface MapConfiguration {
  // View settings
  center: LatLngTuple; // [latitude, longitude]
  zoom: number; // 1-18
  minZoom?: number; // default: 1
  maxZoom?: number; // default: 18

  // Display options
  height: string; // CSS height value
  width?: string; // CSS width value, default: '100%'

  // Feature flags
  showUserLocation: boolean;
  allowZoom: boolean;
  allowPan: boolean;
  scrollWheelZoom: boolean;

  // Tile configuration
  tileUrl?: string; // OpenStreetMap by default
  attribution?: string;

  // Accessibility
  keyboardNavigation: boolean;
  zoomControl: boolean;
}
```

**Validation Rules**:

- `center` coordinates must be valid lat/lng ranges
- `zoom` must be between minZoom and maxZoom
- `height` must be valid CSS value
- `tileUrl` must be HTTPS URL

**Defaults**:

```typescript
const DEFAULT_CONFIG: MapConfiguration = {
  center: [51.505, -0.09], // London
  zoom: 13,
  minZoom: 1,
  maxZoom: 18,
  height: '400px',
  width: '100%',
  showUserLocation: false,
  allowZoom: true,
  allowPan: true,
  scrollWheelZoom: false, // Accessibility
  keyboardNavigation: true,
  zoomControl: true,
};
```

### 3. MarkerData

**Purpose**: Defines custom map markers

```typescript
interface MarkerData {
  // Identification
  id: string;

  // Position
  position: LatLngTuple;

  // Display
  title?: string;
  popup?: PopupContent;
  icon?: MarkerIcon;

  // Behavior
  draggable?: boolean;
  clickable?: boolean;

  // Metadata
  category?: string;
  data?: Record<string, unknown>;
}

interface PopupContent {
  content: string | ReactNode;
  maxWidth?: number;
  closeButton?: boolean;
  autoClose?: boolean;
}

interface MarkerIcon {
  iconUrl: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
  popupAnchor?: [number, number];
  shadowUrl?: string;
  shadowSize?: [number, number];
}
```

**Validation Rules**:

- `id` must be unique within marker set
- `position` must be valid coordinates
- Icon URLs must be HTTPS or data URLs
- Icon sizes must be positive integers

### 4. GeolocationConsent

**Purpose**: Extends GDPR consent for location permissions

```typescript
interface GeolocationConsent {
  // Consent state
  consentGiven: boolean;
  consentDate: Date | null;

  // Consent metadata
  consentMethod: 'explicit' | 'implicit' | null;
  consentVersion: string;

  // Purpose specification
  purposes: GeolocationPurpose[];

  // Retention
  retentionPeriod: number; // days
  expiryDate: Date | null;
}

enum GeolocationPurpose {
  USER_LOCATION_DISPLAY = 'user_location_display',
  NEARBY_SEARCH = 'nearby_search',
  LOCATION_ANALYTICS = 'location_analytics',
  PERSONALIZATION = 'personalization',
}
```

**Validation Rules**:

- Consent required before geolocation access
- `consentDate` set when consent given
- `expiryDate` calculated from consentDate + retentionPeriod
- At least one purpose must be specified

**Integration with ConsentContext**:

```typescript
// Extends existing consent categories
interface ConsentState {
  // ... existing consent categories
  geolocation: GeolocationConsent;
}
```

### 5. TileCache

**Purpose**: Manages offline tile caching

```typescript
interface TileCache {
  // Cache metadata
  version: string;
  lastUpdated: Date;

  // Size management
  currentSize: number; // bytes
  maxSize: number; // bytes
  tileCount: number;

  // Tile tracking
  cachedRegions: CachedRegion[];
}

interface CachedRegion {
  bounds: LatLngBounds;
  zoomLevels: number[];
  downloadDate: Date;
  tileCount: number;
  size: number; // bytes
}
```

**Validation Rules**:

- `maxSize` default: 50MB
- Automatic cleanup when size exceeded
- LRU eviction policy for tiles
- Regions tracked for bulk operations

## Type Definitions

### Coordinate Types

```typescript
type Latitude = number; // -90 to 90
type Longitude = number; // -180 to 180
type LatLngTuple = [Latitude, Longitude];

interface LatLngBounds {
  north: Latitude;
  south: Latitude;
  east: Longitude;
  west: Longitude;
}
```

### Permission Types

```typescript
type PermissionState = 'granted' | 'denied' | 'prompt';

interface PermissionStatus {
  state: PermissionState;
  onchange: ((this: PermissionStatus, ev: Event) => any) | null;
}
```

### Error Types

```typescript
interface MapError {
  code: MapErrorCode;
  message: string;
  details?: unknown;
}

enum MapErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  TILE_LOAD_ERROR = 'TILE_LOAD_ERROR',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  LEAFLET_INIT_ERROR = 'LEAFLET_INIT_ERROR',
}
```

## Hook Interfaces

### useGeolocation Hook

```typescript
interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  // Actions
  getCurrentPosition: () => void;
  clearWatch: () => void;

  // Utilities
  isSupported: boolean;
  distanceFrom: (target: LatLngTuple) => number | null;
}
```

### useMapConfiguration Hook

```typescript
interface UseMapConfigurationReturn {
  config: MapConfiguration;
  updateConfig: (partial: Partial<MapConfiguration>) => void;
  resetConfig: () => void;
  saveConfig: () => void;
  loadConfig: () => void;
}
```

## Component Props Interfaces

### MapContainer Props

```typescript
interface MapContainerProps {
  // Configuration
  config?: Partial<MapConfiguration>;

  // Markers
  markers?: MarkerData[];
  userMarker?: Partial<MarkerData>;

  // Events
  onMapReady?: (map: L.Map) => void;
  onLocationFound?: (position: GeolocationPosition) => void;
  onLocationError?: (error: GeolocationPositionError) => void;
  onMarkerClick?: (marker: MarkerData) => void;

  // Children
  children?: ReactNode;

  // Styling
  className?: string;
  style?: CSSProperties;
}
```

### LocationButton Props

```typescript
interface LocationButtonProps {
  // State
  permission: PermissionState;
  loading?: boolean;

  // Actions
  onClick: () => void;

  // Display
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;

  // Accessibility
  ariaLabel?: string;

  // Styling
  className?: string;
}
```

### GeolocationConsentModal Props

```typescript
interface GeolocationConsentModalProps {
  // State
  isOpen: boolean;

  // Actions
  onAccept: (purposes: GeolocationPurpose[]) => void;
  onDecline: () => void;
  onClose: () => void;

  // Configuration
  purposes?: GeolocationPurpose[];
  required?: boolean;

  // Content
  title?: string;
  description?: string;
  privacyPolicyUrl?: string;
}
```

## Storage Schemas

### LocalStorage

```typescript
interface MapLocalStorage {
  // User preferences
  'map-config': MapConfiguration;
  'map-consent': GeolocationConsent;
  'map-last-location': LatLngTuple | null;

  // Cache metadata
  'map-cache-version': string;
  'map-cache-size': number;
}
```

### IndexedDB Schema

```typescript
interface MapIndexedDB {
  // Offline tiles store
  tiles: {
    key: string; // "z-x-y" format
    value: {
      url: string;
      blob: Blob;
      timestamp: number;
      size: number;
    };
  };

  // Cached regions store
  regions: {
    key: string; // region ID
    value: CachedRegion;
  };
}
```

## Validation Utilities

```typescript
// Coordinate validation
function isValidLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90;
}

function isValidLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180;
}

function isValidLatLng(latlng: unknown): latlng is LatLngTuple {
  return (
    Array.isArray(latlng) &&
    latlng.length === 2 &&
    isValidLatitude(latlng[0]) &&
    isValidLongitude(latlng[1])
  );
}

// Zoom validation
function isValidZoom(zoom: number, min = 1, max = 18): boolean {
  return zoom >= min && zoom <= max && Number.isInteger(zoom);
}

// Permission validation
function isValidPermissionState(state: unknown): state is PermissionState {
  return ['granted', 'denied', 'prompt'].includes(state as string);
}
```

## Migration Notes

### Integration with Existing Models

1. **ConsentContext Extension**:
   - Add geolocation to consent categories
   - Update consent storage schema
   - Maintain backward compatibility

2. **Theme Integration**:
   - Map components respect current theme
   - Custom marker icons for each theme
   - High contrast mode support

3. **PWA Integration**:
   - Tiles cached by existing service worker
   - Offline queue for location updates
   - Background sync for tile prefetch

---

_Data model version 1.0.0 - Subject to updates during implementation_
