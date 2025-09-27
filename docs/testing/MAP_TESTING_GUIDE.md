# Map Components Testing Guide

## Overview

Testing map components with Leaflet presents unique challenges due to the library's deep integration with browser DOM APIs and its dynamic import requirements. This guide explains our testing strategy for map components.

## The Challenge

### Why Leaflet is Hard to Test

1. **Browser DOM Dependencies**: Leaflet directly manipulates the DOM and requires real browser APIs (Canvas, SVG, event handling)
2. **Dynamic Imports**: Components use `dynamic(() => import(...), { ssr: false })` to avoid SSR issues
3. **Complex State Management**: Map state (zoom, center, tiles) is managed internally by Leaflet
4. **Geolocation API**: Requires browser permissions and navigator.geolocation
5. **Asynchronous Operations**: Tile loading, animations, and user interactions are inherently async

### What Doesn't Work in Unit Tests

```javascript
// ❌ These fail in unit tests (jsdom environment):
- Leaflet map initialization
- Tile layer rendering
- Marker placement and clustering
- Map controls (zoom, pan)
- Popup/tooltip rendering
- Geolocation API calls
- Map event handling (click, drag, zoom)
```

## Our Testing Strategy

### 1. Unit Tests (Vitest) - Component Logic

**Location**: `/src/components/map/*/*.test.tsx`

**What We Test**:

- ✅ Component props validation
- ✅ Event handler callbacks (onClick, onLocationFound, etc.)
- ✅ Basic component rendering (component exists)
- ✅ State management (loading states, error handling)
- ✅ Accessibility attributes (ARIA labels, roles)
- ✅ Conditional rendering logic

**Example**:

```typescript
// MapContainer.test.tsx
it('should call onLocationFound when location is received', () => {
  const onLocationFound = vi.fn();
  render(<MapContainer onLocationFound={onLocationFound} />);
  // Mock geolocation and verify callback
});

it('should show location button when showUserLocation is true', () => {
  render(<MapContainer showUserLocation={true} />);
  expect(screen.getByRole('button', { name: /location/i })).toBeInTheDocument();
});
```

### 2. E2E Tests (Playwright) - Map Functionality

**Location**: `/e2e/map.spec.ts`

**What We Test**:

- ✅ Map rendering with actual tiles
- ✅ User interactions (click, drag, zoom)
- ✅ Marker placement and popups
- ✅ Geolocation permission flow
- ✅ Map controls functionality
- ✅ Responsive behavior
- ✅ Keyboard navigation
- ✅ Performance and loading states

**Example**:

```typescript
// map.spec.ts
test('should render map with OpenStreetMap tiles', async ({ page }) => {
  await page.goto('/map');
  await expect(page.locator('.leaflet-tile-container')).toBeVisible();
  await expect(page.locator('.leaflet-control-zoom')).toBeVisible();
});

test('should get user location after consent', async ({ page }) => {
  await mockGeolocation(page);
  await page.goto('/map');
  await page.getByRole('button', { name: /location/i }).click();
  await page.getByRole('button', { name: /accept/i }).click();
  await expect(
    page.locator('[data-testid="user-location-marker"]')
  ).toBeVisible();
});
```

## Test Organization

### Component Structure

```
src/components/map/
├── MapContainer/
│   ├── MapContainer.tsx              # Main component
│   ├── MapContainer.test.tsx         # Unit tests (props, callbacks)
│   ├── MapContainer.accessibility.test.tsx  # A11y tests
│   └── MapContainerInner.tsx         # Dynamic import component
├── LocationMarker/
│   ├── LocationMarker.tsx
│   ├── LocationMarker.test.tsx       # Unit tests
│   └── LocationMarker.accessibility.test.tsx
└── GeolocationConsent/
    ├── GeolocationConsent.tsx
    ├── GeolocationConsent.test.tsx   # Unit tests
    └── GeolocationConsent.accessibility.test.tsx
```

### E2E Test Coverage

```
e2e/map.spec.ts
├── Map rendering tests
├── Location permission tests
├── Marker interaction tests
├── Map control tests
├── Keyboard navigation tests
├── Responsive behavior tests
├── Offline functionality tests
└── Accessibility tests
```

## Running Tests

### Unit Tests

```bash
# Run all map component unit tests
docker compose exec scripthammer pnpm test src/components/map

# Run specific component tests
docker compose exec scripthammer pnpm test MapContainer.test

# Run with coverage
docker compose exec scripthammer pnpm test:coverage src/components/map
```

### E2E Tests

```bash
# Run map E2E tests (requires dev server on port 3000)
docker compose exec scripthammer pnpm exec playwright test e2e/map.spec.ts

# Run with UI mode for debugging
docker compose exec scripthammer pnpm exec playwright test e2e/map.spec.ts --ui

# Run specific test
docker compose exec scripthammer pnpm exec playwright test e2e/map.spec.ts -g "should render map"
```

## Common Patterns

### Mocking in Unit Tests

```typescript
// Mock dynamic imports
vi.mock('./MapContainerInner', () => ({
  default: ({ children }) => <div>{children}</div>
}));

// Mock react-leaflet (won't actually render map)
vi.mock('react-leaflet', () => ({
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 13 })
}));

// Mock geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn((success) => {
      success({ coords: { latitude: 51.5, longitude: -0.09 } });
    })
  }
});
```

### E2E Test Helpers

```typescript
// Mock geolocation in Playwright
async function mockGeolocation(page: Page, lat = 51.505, lng = -0.09) {
  await page.addInitScript(
    ({ lat, lng }) => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: { latitude: lat, longitude: lng, accuracy: 10 },
          timestamp: Date.now(),
        });
      };
    },
    { lat, lng }
  );
}

// Wait for map to load
async function waitForMap(page: Page) {
  await page.locator('.leaflet-container').waitFor();
  await page.locator('.leaflet-tile-loaded').first().waitFor();
}
```

## Known Limitations

### Unit Test Limitations

1. **Cannot test actual map rendering** - Leaflet requires real DOM
2. **Cannot verify tile loading** - Network requests need real browser
3. **Cannot test map interactions** - Drag, zoom, pan need real events
4. **Mock limitations** - Mocked components don't behave like real Leaflet

### E2E Test Considerations

1. **Network dependency** - Tests need internet for OSM tiles
2. **Performance** - E2E tests are slower than unit tests
3. **Flakiness** - Async operations may need proper waits
4. **Environment** - Need proper browser permissions for geolocation

## Best Practices

### Do's

- ✅ Test component props and callbacks in unit tests
- ✅ Test map functionality in E2E tests
- ✅ Use proper wait strategies in E2E tests
- ✅ Mock geolocation for consistent results
- ✅ Test accessibility in both unit and E2E tests

### Don'ts

- ❌ Don't try to test Leaflet internals in unit tests
- ❌ Don't mock complex Leaflet behavior
- ❌ Don't skip E2E tests for critical map features
- ❌ Don't test implementation details
- ❌ Don't rely on specific tile URLs in tests

## Debugging Tips

### Unit Test Issues

```bash
# Run with verbose output
DEBUG=* pnpm test MapContainer.test

# Check what's being rendered
const { debug } = render(<MapContainer />);
debug(); // Prints DOM structure
```

### E2E Test Issues

```bash
# Run with headed browser
pnpm exec playwright test --headed

# Use debug mode
pnpm exec playwright test --debug

# Take screenshots on failure
await page.screenshot({ path: 'map-error.png' });
```

## Migration Path

If you need to test something that's currently in unit tests but requires a real map:

1. Comment out or remove the failing unit test
2. Add a comment: `// Tested in E2E: e2e/map.spec.ts`
3. Write corresponding E2E test
4. Verify E2E test covers the functionality

## References

- [Leaflet Documentation](https://leafletjs.com/)
- [React-Leaflet Documentation](https://react-leaflet.js.org/)
- [Playwright Documentation](https://playwright.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
