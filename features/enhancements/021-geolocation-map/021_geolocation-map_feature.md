# Feature: Geolocation Map

**Feature ID**: 021
**Category**: enhancements
**Source**: ScriptHammer_v_001/docs/specs/014-geolocation-map
**Status**: Ready for SpecKit

## Description

An interactive map component with geolocation features using Leaflet (open-source, no API keys required). Properly requests user permission, displays location, and provides a rich mapping experience with progressive enhancement.

## User Scenarios

### US-1: View Map Without Location (P1)

A user visits the map page and sees an interactive map centered on a default location, without requiring location permission.

**Acceptance Criteria**:

1. Given map page loads, when no permission requested, then map displays at default center
2. Given map displayed, when user interacts, then pan/zoom works correctly
3. Given map displayed, when viewing on mobile, then map is responsive

### US-2: Request Location Permission (P1)

A user clicks "Show my location" button and the browser requests geolocation permission.

**Acceptance Criteria**:

1. Given map displayed, when button clicked, then browser permission dialog appears
2. Given permission granted, when location obtained, then map centers on user
3. Given permission granted, when location shown, then marker appears at user location

### US-3: Handle Denied Permission (P2)

When location permission is denied, the map provides clear feedback and continues functioning.

**Acceptance Criteria**:

1. Given permission denied, when user sees UI, then button shows "Location blocked"
2. Given permission denied, when using map, then all other features work normally
3. Given permission previously denied, when button clicked, then user sees explanation

### US-4: Display Custom Markers (P3)

Developers can add custom markers with popups to the map.

**Acceptance Criteria**:

1. Given markers array passed, when map renders, then all markers displayed
2. Given marker with popup, when clicked, then popup content shows
3. Given multiple markers, when viewing, then all are visible at appropriate zoom

## Technical Architecture

### Components

- **Map**: Main map container with Leaflet
- **LocationButton**: Button to request/show location status
- **MapMarker**: Reusable marker component
- **useGeolocation**: Hook for geolocation state management

### Permission Handling

```typescript
type PermissionState = 'prompt' | 'granted' | 'denied';

// States:
// 'prompt' → Show "Show my location" button
// 'granted' → Show user marker, hide button
// 'denied' → Show "Location blocked" disabled button
```

### Default Fallback Location

When no user location is available, the map centers on the following default coordinates:

```typescript
const DEFAULT_LOCATION = {
  lat: 40.7128, // New York City latitude
  lng: -74.006, // New York City longitude
  zoom: 10, // City-level zoom
  name: 'New York City',
};

// For non-US deployments, configure via environment:
// NEXT_PUBLIC_MAP_DEFAULT_LAT=51.5074
// NEXT_PUBLIC_MAP_DEFAULT_LNG=-0.1278
// NEXT_PUBLIC_MAP_DEFAULT_ZOOM=10
```

**Fallback priority**:

1. User's granted geolocation
2. Environment variable coordinates (`NEXT_PUBLIC_MAP_DEFAULT_*`)
3. Hardcoded default (NYC: 40.7128, -74.0060)

## Requirements

### Functional

- FR-001: Map renders without geolocation permission
- FR-002: Permission request follows browser best practices
- FR-003: User location displayed when permitted
- FR-004: Clear fallback UI for denied permissions
- FR-005: Works offline with cached tiles (if previously loaded)
- FR-006: Responsive across all viewports
- FR-007: Keyboard navigation supported
- FR-008: Custom markers and popups work

### Non-Functional

- NFR-001: < 100KB bundle size impact (code split)
- NFR-002: Dynamic import with SSR disabled
- NFR-003: Lazy load map when scrolled into view
- NFR-004: No API keys required (OpenStreetMap tiles)

### Key Files

- **Map/Map.tsx**: Main component with react-leaflet
- **useGeolocation.ts**: Hook for permission and position
- **LocationButton**: Status-aware location button

### Dependencies

```bash
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet
```

### Out of Scope

- Route planning/directions
- Geocoding/address search
- Real-time location tracking
- Custom map tiles hosting
- 3D map views

## Success Criteria

- SC-001: Map renders on all viewports without location permission
- SC-002: Permission request triggers correctly
- SC-003: User location displays accurately when granted
- SC-004: Denied permission shows clear, non-blocking message
- SC-005: Custom markers display with popups
- SC-006: Bundle size impact < 100KB
- SC-007: No SSR errors with dynamic import
