# Product Requirements Prompt (PRP)

**Feature Name**: Geolocation Map  
**Priority**: P2 (Constitutional Enhancement)  
**Sprint**: Sprint 3  
**Status**: 📥 Inbox  
**Created**: 2025-09-13  
**Author**: AI Assistant (from SpecKit analysis)

---

## 1. Product Requirements

### What We're Building

An interactive map component with geolocation features that requests user permission properly, displays their location, and provides a rich mapping experience. This will use Leaflet for a lightweight, open-source solution without API key requirements.

### Why We're Building It

- Constitutional requirement (Section 6, Phase 4: Geolocation Map)
- Demonstrates proper permission handling patterns
- Useful for location-based features
- Progressive enhancement example
- No vendor lock-in with open-source solution

### Success Criteria

- [ ] Map renders without geolocation permission
- [ ] Permission request follows best practices
- [ ] User location displayed when permitted
- [ ] Fallback for denied permissions
- [ ] Works offline with cached tiles
- [ ] Responsive across all viewports
- [ ] Keyboard navigation supported
- [ ] Custom markers and popups work
- [ ] < 100KB bundle size impact

### Out of Scope

- Route planning/directions
- Geocoding/address search
- Real-time location tracking
- Custom map tiles hosting
- 3D map views

---

## 2. Context & Codebase Intelligence

### Existing Patterns to Follow

#### Permission Handling Pattern

```typescript
// Similar to PWA install prompt
const [showPrompt, setShowPrompt] = useState(false);
const [permission, setPermission] = useState<PermissionState>('prompt');

// Check permission status
navigator.permissions
  .query({ name: 'geolocation' })
  .then((result) => setPermission(result.state));
```

#### Component Structure

```typescript
// Follow atomic design pattern
// src/components/atomic/Map.tsx
export interface MapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  showUserLocation?: boolean;
}
```

#### Lazy Loading Pattern

```typescript
// Dynamic import for code splitting
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div>Loading map...</div>
});
```

### Dependencies & Libraries

```bash
# Leaflet for mapping
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet

# No API keys required!
```

### File Structure

```
src/
├── components/
│   ├── map/
│   │   ├── Map/
│   │   │   ├── index.tsx
│   │   │   ├── Map.tsx
│   │   │   ├── Map.test.tsx
│   │   │   └── Map.stories.tsx
│   │   ├── LocationButton/
│   │   │   ├── index.tsx
│   │   │   └── LocationButton.tsx
│   │   └── MapMarker/
│   │       └── MapMarker.tsx
├── hooks/
│   └── useGeolocation.ts
└── utils/
    └── geolocation.ts
```

---

## 3. Technical Specifications

### Geolocation Hook

```typescript
// src/hooks/useGeolocation.ts
import { useState, useEffect, useCallback } from 'react';

interface GeolocationState {
  loading: boolean;
  error: GeolocationPositionError | null;
  position: GeolocationPosition | null;
  permission: PermissionState;
}

export function useGeolocation(options?: PositionOptions) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    position: null,
    permission: 'prompt',
  });

  // Check permission status
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setState((prev) => ({ ...prev, permission: result.state }));
        result.addEventListener('change', () => {
          setState((prev) => ({ ...prev, permission: result.state }));
        });
      });
    }
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: new Error('Geolocation not supported') as any,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          loading: false,
          error: null,
          position,
          permission: 'granted',
        });
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error,
          permission: error.code === 1 ? 'denied' : prev.permission,
        }));
      },
      options || {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }, [options]);

  return {
    ...state,
    getCurrentPosition,
  };
}
```

### Map Component

```typescript
// src/components/map/Map/Map.tsx
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useGeolocation } from '@/hooks/useGeolocation';
import LocationButton from '../LocationButton';

// Fix Leaflet icon issue in Next.js
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;
  showUserLocation?: boolean;
  markers?: Array<{
    position: [number, number];
    popup?: string;
  }>;
}

function LocationMarker() {
  const { position, permission } = useGeolocation();
  const map = useMap();

  useEffect(() => {
    if (position) {
      const { latitude, longitude } = position.coords;
      map.flyTo([latitude, longitude], 15);
    }
  }, [position, map]);

  if (!position || permission !== 'granted') return null;

  const { latitude, longitude } = position.coords;

  return (
    <Marker position={[latitude, longitude]}>
      <Popup>You are here!</Popup>
    </Marker>
  );
}

export default function Map({
  center = [51.505, -0.09], // Default to London
  zoom = 13,
  height = '400px',
  showUserLocation = true,
  markers = []
}: MapProps) {
  const { getCurrentPosition, permission } = useGeolocation();

  return (
    <div className="relative" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full rounded-lg"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showUserLocation && <LocationMarker />}

        {markers.map((marker, index) => (
          <Marker key={index} position={marker.position}>
            {marker.popup && <Popup>{marker.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>

      {showUserLocation && permission !== 'granted' && (
        <LocationButton
          onClick={getCurrentPosition}
          permission={permission}
          className="absolute top-4 right-4 z-[1000]"
        />
      )}
    </div>
  );
}
```

### Location Button

```typescript
// src/components/map/LocationButton/LocationButton.tsx
import { MapPin, MapPinOff, Loader2 } from 'lucide-react';

interface LocationButtonProps {
  onClick: () => void;
  permission: PermissionState;
  loading?: boolean;
  className?: string;
}

export default function LocationButton({
  onClick,
  permission,
  loading,
  className
}: LocationButtonProps) {
  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Getting location...</span>
        </>
      );
    }

    if (permission === 'denied') {
      return (
        <>
          <MapPinOff className="w-4 h-4" />
          <span>Location blocked</span>
        </>
      );
    }

    return (
      <>
        <MapPin className="w-4 h-4" />
        <span>Show my location</span>
      </>
    );
  };

  return (
    <button
      onClick={onClick}
      disabled={permission === 'denied' || loading}
      className={`btn btn-primary btn-sm gap-2 ${className}`}
      aria-label="Get current location"
    >
      {getButtonContent()}
    </button>
  );
}
```

### Usage Example

```typescript
// app/map/page.tsx
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/map/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-base-200 rounded-lg">
      <span className="loading loading-spinner loading-lg"></span>
    </div>
  )
});

export default function MapPage() {
  const markers = [
    {
      position: [51.505, -0.09] as [number, number],
      popup: 'Welcome to London!'
    }
  ];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Interactive Map</h1>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Find Your Location</h2>
          <p>Click the location button to center the map on your position.</p>
        </div>

        <Map
          height="500px"
          showUserLocation={true}
          markers={markers}
        />
      </div>
    </div>
  );
}
```

### Performance Optimization

```typescript
// Lazy load map only when visible
import { useInView } from 'react-intersection-observer';

function LazyMap() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1
  });

  return (
    <div ref={ref} className="min-h-[400px]">
      {inView && <Map />}
    </div>
  );
}
```

---

## 4. Implementation Runbook

### Step 1: Install Dependencies

```bash
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet

# For lazy loading
pnpm add react-intersection-observer
```

### Step 2: Create Geolocation Hook

```bash
touch src/hooks/useGeolocation.ts
# Implement hook (see Technical Specs)
```

### Step 3: Build Map Components

```bash
mkdir -p src/components/map/Map
mkdir -p src/components/map/LocationButton

# Create component files
touch src/components/map/Map/{index.tsx,Map.tsx,Map.test.tsx,Map.stories.tsx}
touch src/components/map/LocationButton/{index.tsx,LocationButton.tsx}
```

### Step 4: Fix Leaflet CSS

```css
/* globals.css - Fix Leaflet container */
.leaflet-container {
  height: 100%;
  width: 100%;
  z-index: 0;
}
```

### Step 5: Create Map Page

```bash
mkdir -p app/map
touch app/map/page.tsx
```

### Step 6: Testing

- [ ] Map loads without location permission
- [ ] Permission request works
- [ ] Location marker appears
- [ ] Denied permission handled
- [ ] Custom markers work
- [ ] Responsive design
- [ ] Keyboard navigation

---

## 5. Validation Loops

### Pre-Implementation Checks

- [ ] Leaflet library evaluated
- [ ] Permission API understood
- [ ] Dynamic import configured
- [ ] Icon assets available

### During Implementation

- [ ] No SSR errors
- [ ] Permission flow smooth
- [ ] Map tiles loading
- [ ] Markers rendering

### Post-Implementation

- [ ] All browsers tested
- [ ] Mobile responsive
- [ ] Offline mode works
- [ ] Performance acceptable

---

## 6. Risk Mitigation

### Potential Risks

1. **Risk**: Leaflet SSR issues in Next.js
   **Mitigation**: Use dynamic import with ssr: false

2. **Risk**: Location permission denied
   **Mitigation**: Map works without location, clear messaging

3. **Risk**: Map tiles blocked by CSP
   **Mitigation**: Update CSP headers for OpenStreetMap

4. **Risk**: Large bundle size
   **Mitigation**: Code split, lazy load, tree shake unused features

---

## 7. References

### Internal Documentation

- Constitution: `/docs/constitution.md` (Section 6, Phase 4)
- Component Pattern: `/src/components/atomic/`
- Permission Handling: PWA install pattern
- Dynamic Import: Multiple components use this

### External Resources

- [React Leaflet Docs](https://react-leaflet.js.org/)
- [Leaflet Documentation](https://leafletjs.com/)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Permissions API](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)

---

## PRP Workflow Status

### Review Checklist (Inbox → Outbox)

- [ ] Product requirements clear and complete
- [ ] Technical approach validated
- [ ] Resources available
- [ ] No blocking dependencies
- [ ] Approved by: [PENDING]

### Processing Status (Outbox → Processed)

- [ ] Specification generated
- [ ] Plan created
- [ ] Tasks broken down
- [ ] Implementation started
- [ ] Completed on: [PENDING]

---

<!--
PRP for Geolocation Map
Generated from SpecKit constitution analysis
Interactive map with proper permission handling
-->
