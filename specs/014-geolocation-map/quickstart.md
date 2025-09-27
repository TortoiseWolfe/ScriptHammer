# Quickstart: Geolocation Map Feature

**Feature**: Interactive Map with Geolocation Support
**Time to Complete**: 15 minutes
**Prerequisites**: Node.js 18+, pnpm, Docker (optional)

## Quick Setup

### 1. Install Dependencies (2 min)

```bash
# Using Docker (recommended)
docker compose exec scripthammer pnpm add leaflet react-leaflet @types/leaflet

# Or directly
pnpm add leaflet react-leaflet @types/leaflet
```

### 2. Run Development Server (1 min)

```bash
# With Docker
docker compose up
docker compose exec scripthammer pnpm dev

# Or directly
pnpm dev
```

### 3. Test the Map (2 min)

Navigate to: http://localhost:3000/map

You should see:

- Interactive map centered on London
- Location button in top-right corner
- Zoom controls on the left
- Attribution in bottom-right

### 4. Test Geolocation (3 min)

1. Click the "Show my location" button
2. Browser will prompt for location permission
3. **Accept** to see your location marker
4. **Deny** to see "Location blocked" state

## Test Scenarios

### Scenario 1: First-Time User (Permission Prompt)

**Setup**: Clear site permissions in browser

**Steps**:

1. Visit `/map` page
2. Click "Show my location" button
3. See consent modal (if GDPR enabled)
4. Accept consent
5. See browser permission prompt
6. Grant permission

**Expected**:

- ✅ Consent modal appears first
- ✅ Browser prompts for permission
- ✅ Map centers on user location
- ✅ Blue marker shows position
- ✅ Accuracy circle visible

**Verification**:

```javascript
// In browser console
navigator.permissions
  .query({ name: 'geolocation' })
  .then((p) => console.log(p.state));
// Should output: "granted"
```

### Scenario 2: Permission Denied

**Setup**: Set location permission to "blocked" in browser

**Steps**:

1. Visit `/map` page
2. Click "Show my location" button
3. Observe button state change

**Expected**:

- ✅ Button shows "Location blocked"
- ✅ Button is disabled
- ✅ Map still functional
- ✅ No error messages in console

**Verification**:

```javascript
// Button should be disabled
document.querySelector('[aria-label="Get current location"]').disabled;
// Should return: true
```

### Scenario 3: Offline Map Usage

**Setup**: Enable offline mode in DevTools

**Steps**:

1. Load map page while online
2. Pan and zoom to cache tiles
3. Go offline (DevTools → Network → Offline)
4. Refresh page
5. Navigate cached area

**Expected**:

- ✅ Cached tiles display
- ✅ Non-cached areas show gray
- ✅ Controls remain functional
- ✅ Location works if previously granted

### Scenario 4: Custom Markers

**Setup**: Add test markers to map

**Test Code**:

```tsx
const markers = [
  {
    id: '1',
    position: [51.505, -0.09],
    popup: 'Big Ben',
  },
  {
    id: '2',
    position: [51.508, -0.128],
    popup: 'Trafalgar Square',
  },
];

<MapContainer markers={markers} />;
```

**Expected**:

- ✅ Both markers visible
- ✅ Popups appear on click
- ✅ Map bounds adjust to show all

### Scenario 5: Mobile Responsive

**Setup**: Open DevTools device emulator

**Steps**:

1. Select iPhone 12 Pro
2. Load map page
3. Test touch gestures
4. Test location button

**Expected**:

- ✅ Map fills viewport
- ✅ Touch pan/zoom works
- ✅ Controls scale appropriately
- ✅ Location button accessible

### Scenario 6: Accessibility

**Setup**: Enable screen reader or use keyboard only

**Steps**:

1. Tab through page elements
2. Use arrow keys to pan map
3. Use +/- keys to zoom
4. Enter on location button

**Expected**:

- ✅ All controls keyboard accessible
- ✅ Focus indicators visible
- ✅ ARIA labels read correctly
- ✅ Location status announced

## Quick Test Commands

### Run All Tests

```bash
# Unit tests
pnpm test src/components/map

# Integration tests
pnpm test:integration geolocation

# E2E tests
pnpm test:e2e map.spec.ts

# Accessibility
pnpm test:a11y /map
```

### Check Bundle Size

```bash
# Analyze bundle
pnpm build
pnpm analyze

# Check map impact
# Should be < 100KB additional
```

### Performance Check

```bash
# Run Lighthouse
npx lighthouse http://localhost:3000/map --view

# Key metrics:
# - LCP < 2.5s
# - FID < 100ms
# - CLS < 0.1
```

## Common Issues & Solutions

### Issue: Map doesn't load

**Solution**: Check browser console for CSP errors. Update headers:

```javascript
// next.config.ts
{
  'img-src': "'self' https://*.tile.openstreetmap.org",
  'connect-src': "'self' https://*.tile.openstreetmap.org"
}
```

### Issue: "Window is not defined" error

**Solution**: Ensure using dynamic import:

```tsx
const Map = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
});
```

### Issue: Markers missing icons

**Solution**: Configure Leaflet icon paths:

```tsx
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';

L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon.src,
  // ... other options
});
```

### Issue: Location permission not working

**Solution**: Check HTTPS (required for geolocation):

```bash
# For local testing with HTTPS
pnpm dev --experimental-https
```

## Verification Checklist

Before considering complete:

- [ ] Map loads without errors
- [ ] Location permission flow works
- [ ] Markers display correctly
- [ ] Offline caching functional
- [ ] Mobile responsive
- [ ] Keyboard navigable
- [ ] Tests passing
- [ ] Bundle size < 100KB impact
- [ ] No console errors
- [ ] Lighthouse score > 90

## Advanced Testing

### Test Consent Flow

```javascript
// Clear consent
localStorage.removeItem('consent-preferences');

// Trigger consent modal
// Should appear before location request
```

### Test Error States

```javascript
// Mock location error
navigator.geolocation.getCurrentPosition = (s, e) => {
  e({ code: 1, message: 'Permission denied' });
};
```

### Test Performance

```javascript
// Measure map render time
performance.mark('map-start');
// ... map loads
performance.mark('map-end');
performance.measure('map-load', 'map-start', 'map-end');
console.log(performance.getEntriesByName('map-load'));
```

## Next Steps

1. **Customize map style**: Update tile URL for different styles
2. **Add more features**: Search, routing, clustering
3. **Enhance offline**: Prefetch regions, download maps
4. **Analytics**: Track map usage, popular areas
5. **Optimization**: Lazy load markers, virtual scrolling

## Support

- **Documentation**: `/docs/features/geolocation-map.md`
- **Storybook**: `pnpm storybook` → Map Components
- **Examples**: `/app/map/page.tsx`
- **Tests**: `/src/components/map/**/*.test.tsx`

---

_Last updated: 2025-01-17 | Version: 1.0.0_
