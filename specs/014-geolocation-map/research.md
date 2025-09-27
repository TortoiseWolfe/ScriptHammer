# Research Findings: Geolocation Map Feature

**Feature**: Interactive Map with Geolocation Support
**Date**: 2025-01-17
**Branch**: `014-geolocation-map`

## Executive Summary

Research conducted to resolve technical decisions for implementing an interactive map component with geolocation support in a Next.js PWA application. Focus on open-source solutions, privacy-first approach, and offline capabilities.

## Research Areas

### 1. Mapping Library Selection

**Decision**: Leaflet with React-Leaflet wrapper

**Rationale**:

- Open-source with no vendor lock-in
- No API keys required with OpenStreetMap
- Mature ecosystem (10+ years)
- 40KB gzipped bundle size
- Extensive plugin ecosystem

**Alternatives Considered**:

- **Google Maps**: Requires API key, usage limits, privacy concerns, 50KB+ bundle
- **Mapbox GL JS**: Requires account, usage-based pricing, 200KB+ bundle
- **OpenLayers**: More complex API, 150KB+ bundle, overkill for simple maps
- **Here Maps**: Requires API key, less community support

**Supporting Evidence**:

- Leaflet powers maps for major sites (GitHub, Flickr, Etsy)
- 40k+ GitHub stars, active maintenance
- React-Leaflet provides idiomatic React integration

### 2. React Integration Approach

**Decision**: React-Leaflet official wrapper

**Rationale**:

- Declarative React components
- Proper lifecycle management
- TypeScript support out of the box
- Handles React 18+ features correctly
- Active maintenance (v4.2.1 current)

**Alternatives Considered**:

- **Vanilla Leaflet**: Manual React integration, imperative API, lifecycle issues
- **Custom wrapper**: Maintenance burden, reinventing the wheel
- **@react-leaflet/core**: Lower level, more complexity

**Implementation Notes**:

```tsx
// Declarative API example
<MapContainer center={[51.505, -0.09]} zoom={13}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  <Marker position={[51.505, -0.09]}>
    <Popup>A pretty popup</Popup>
  </Marker>
</MapContainer>
```

### 3. SSR Compatibility (Next.js)

**Decision**: Dynamic imports with `ssr: false`

**Rationale**:

- Leaflet requires `window` and `document`
- Clean separation of concerns
- Preserves SSG/ISR benefits for rest of page
- Standard Next.js pattern

**Alternatives Considered**:

- **Conditional rendering**: Complex, still requires dynamic import
- **Server-side rendering library**: None exist for Leaflet
- **Static image fallback**: Poor UX, defeats interactivity purpose

**Implementation Pattern**:

```tsx
const Map = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});
```

### 4. Permission Handling Strategy

**Decision**: Permissions API with graceful fallback

**Rationale**:

- Check permission state before requesting
- Better UX with clear intent
- Avoids permission fatigue
- Progressive enhancement

**Alternatives Considered**:

- **Direct geolocation request**: Abrupt, no pre-check
- **Browser storage of preference**: Not tied to actual permission
- **Skip permissions**: Map works without location

**Implementation Flow**:

```typescript
1. Check Permissions API support
2. Query geolocation permission state
3. Show appropriate UI based on state
4. Request only on user action
5. Handle denial gracefully
```

### 5. Offline Tile Caching

**Decision**: Service Worker with Cache API

**Rationale**:

- Integrates with existing PWA setup (PRP-011)
- Standard web platform feature
- Automatic cache management
- Network-first strategy for tiles

**Alternatives Considered**:

- **IndexedDB**: Complex for binary data, size limits
- **Local tile server**: Requires pre-downloading, large storage
- **No offline support**: Poor PWA experience

**Caching Strategy**:

```javascript
// Service Worker pseudo-code
const TILE_CACHE = 'map-tiles-v1';
const TILE_URLS = /tile\.openstreetmap\.org/;

// Cache tiles on fetch
self.addEventListener('fetch', (event) => {
  if (TILE_URLS.test(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            // Cache successful tile requests
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(TILE_CACHE)
                .then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
      )
    );
  }
});
```

### 6. GDPR Compliance Integration

**Decision**: Extend existing consent context (PRP-007)

**Rationale**:

- Consistent consent management
- Single source of truth
- Already implemented and tested
- Follows established patterns

**Alternatives Considered**:

- **Separate geolocation consent**: Fragmented UX
- **Implicit consent**: Not GDPR compliant
- **No consent required claim**: Geolocation is personal data

**Integration Points**:

- Add `geolocation` to consent categories
- Check consent before showing location button
- Store consent with other preferences
- Honor consent revocation

### 7. Accessibility Approach

**Decision**: Full keyboard navigation + ARIA labels

**Rationale**:

- WCAG AA compliance requirement
- Leaflet has basic a11y support
- Custom controls need enhancement
- Screen reader announcements for updates

**Alternatives Considered**:

- **Rely on Leaflet defaults**: Insufficient for WCAG AA
- **Alternative text-only view**: Maintains two implementations
- **Skip accessibility**: Not acceptable for production

**Implementation Requirements**:

- Keyboard shortcuts for zoom/pan
- Focus management for popups
- ARIA live regions for location updates
- High contrast mode support
- Alternative text for markers

### 8. Performance Optimization

**Decision**: Lazy loading with intersection observer

**Rationale**:

- Map often below fold
- Reduces initial bundle
- Progressive enhancement
- Better Core Web Vitals

**Alternatives Considered**:

- **Always load**: Unnecessary for all users
- **Route-based splitting**: Map might be on homepage
- **Manual lazy load**: Poor UX

**Implementation**:

```tsx
const LazyMap = () => {
  const { ref, inView } = useIntersectionObserver({
    triggerOnce: true,
    rootMargin: '100px',
  });

  return (
    <div ref={ref} style={{ minHeight: 400 }}>
      {inView ? <Map /> : <MapPlaceholder />}
    </div>
  );
};
```

## Technical Constraints

### Bundle Size Analysis

- Leaflet: 42KB gzipped
- React-Leaflet: 8KB gzipped
- Custom code: ~10KB estimated
- **Total**: ~60KB (well under 100KB target)

### Browser Support

- All modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- Permissions API: 95% global support
- Service Workers: 97% global support
- Graceful degradation for older browsers

### Performance Metrics

- Time to Interactive: < 2s with lazy loading
- First Map Tile: < 500ms on 3G
- Pan/Zoom: 60fps on mid-range devices
- Memory usage: < 50MB for typical session

## Security Considerations

### Content Security Policy

Update required for OpenStreetMap tiles:

```
img-src 'self' https://*.tile.openstreetmap.org;
connect-src 'self' https://*.tile.openstreetmap.org;
```

### Privacy

- No location data sent to external services
- Tile requests don't include location data
- Consent required before geolocation access
- Clear data deletion path

## Implementation Risks

### Identified Risks

1. **Leaflet CSS conflicts**: Mitigate with scoped styles
2. **Large tile cache**: Implement cache size limits
3. **Permission API browser differences**: Feature detection + fallbacks
4. **Marker icon path issues**: Configure webpack properly

## Recommendations

### Immediate Actions

1. Install dependencies: `leaflet react-leaflet @types/leaflet`
2. Configure Next.js for dynamic imports
3. Update CSP headers for tile servers
4. Extend consent context for geolocation

### Best Practices

1. Always use dynamic imports for map components
2. Implement proper loading states
3. Test permission flows in multiple browsers
4. Monitor tile cache size
5. Provide non-map alternatives for critical features

## References

### Documentation

- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [React-Leaflet Guide](https://react-leaflet.js.org/)
- [OpenStreetMap Tile Usage](https://operations.osmfoundation.org/policies/tiles/)
- [Permissions API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)
- [Geolocation API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)

### Code Examples

- [Next.js Dynamic Import](https://nextjs.org/docs/pages/building-your-application/optimizing/lazy-loading)
- [React-Leaflet Examples](https://react-leaflet.js.org/docs/example-popup-marker/)
- [Service Worker Caching](https://developer.chrome.com/docs/workbox/caching-strategies-overview/)

### Performance Resources

- [Web.dev Lazy Loading](https://web.dev/lazy-loading/)
- [Leaflet Performance Tips](https://leafletjs.com/examples/performance/)

---

_Research completed: 2025-01-17_
