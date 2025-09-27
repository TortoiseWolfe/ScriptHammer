import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MapContainer } from './MapContainer';
import type { MapContainerProps } from './MapContainer';

// Define mockMap before using it in mocks
const mockMap = {
  on: vi.fn(),
  off: vi.fn(),
  locate: vi.fn(),
  getZoom: vi.fn(() => 13),
  panTo: vi.fn(),
  setView: vi.fn(),
  getCenter: vi.fn(() => ({ lat: 51.505, lng: -0.09 })),
};

// Mock dynamic import for MapContainerInner
vi.mock('next/dynamic', () => ({
  default: () => {
    // For MapContainerInner, return a component that calls onMapReady
    return ({ children, onMapReady, ...props }: any) => {
      // Call onMapReady with a mock map on mount
      React.useEffect(() => {
        if (onMapReady) {
          onMapReady(mockMap);
        }
      }, [onMapReady]);

      return (
        <div data-testid="map-container-inner" {...props}>
          {children}
        </div>
      );
    };
  },
}));

// Mock Leaflet and react-leaflet
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => ({
      addLayer: vi.fn(),
      remove: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getZoom: vi.fn(() => 13),
      getCenter: vi.fn(() => ({ lat: 51.505, lng: -0.09 })),
    })),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
    })),
    marker: vi.fn(() => ({
      addTo: vi.fn(),
      bindPopup: vi.fn(),
      setLatLng: vi.fn(),
      remove: vi.fn(),
    })),
    circle: vi.fn(() => ({
      addTo: vi.fn(),
      setLatLng: vi.fn(),
      setRadius: vi.fn(),
      remove: vi.fn(),
    })),
    Icon: {
      Default: {
        mergeOptions: vi.fn(),
        prototype: {},
      },
    },
  },
}));

// Mock LocationButton
vi.mock('@/components/map/LocationButton', () => ({
  LocationButton: ({ onClick }: any) => (
    <button onClick={onClick} aria-label="Get location">
      Get location
    </button>
  ),
}));

// Mock MapContainerInner dynamic import
vi.mock('./MapContainerInner', () => ({
  default: ({ children }: any) => (
    <div data-testid="map-container-inner">{children}</div>
  ),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: ({ url, attribution }: any) => (
    <div
      data-testid="tile-layer"
      data-url={url}
      data-attribution={attribution}
    />
  ),
  Marker: ({ position, children }: any) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  useMap: () => mockMap,
}));

describe('MapContainer', () => {
  const defaultProps: MapContainerProps = {
    config: {
      center: [51.505, -0.09],
      zoom: 13,
      height: '400px',
      showUserLocation: false,
      allowZoom: true,
      allowPan: true,
      scrollWheelZoom: false,
      keyboardNavigation: true,
      zoomControl: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render map container with correct dimensions', () => {
    render(<MapContainer {...defaultProps} />);

    const container = screen.getByTestId('map-container');
    expect(container).toBeInTheDocument();
    // Style is applied to the container itself, not parent
    expect(container).toHaveStyle({ height: '400px' });
  });

  it('should render with default configuration when no config provided', () => {
    render(<MapContainer />);

    const container = screen.getByTestId('map-container');
    expect(container).toBeInTheDocument();
  });

  // Tile layer rendering is tested in E2E tests
  // See: e2e/map.spec.ts - 'should load map page successfully'

  // Marker rendering is tested in E2E tests
  // See: e2e/map.spec.ts - 'should display custom markers'

  // Popup rendering is tested in E2E tests
  // See: e2e/map.spec.ts - 'should show marker popups on click'

  it('should show location button when showUserLocation is true', () => {
    const propsWithLocation = {
      ...defaultProps,
      config: {
        ...defaultProps.config!,
        showUserLocation: true,
      },
    };

    render(<MapContainer {...propsWithLocation} showUserLocation={true} />);

    const locationButton = screen.getByRole('button', {
      name: /get location/i,
    });
    expect(locationButton).toBeInTheDocument();
  });

  it('should not show location button when showUserLocation is false', () => {
    render(<MapContainer {...defaultProps} />);

    const locationButton = screen.queryByRole('button', { name: /location/i });
    expect(locationButton).not.toBeInTheDocument();
  });

  // Map initialization callbacks are tested in E2E tests
  // See: e2e/map.spec.ts - Map uses window.leafletMap for testing

  it('should call onLocationFound when location is found', async () => {
    const onLocationFound = vi.fn();
    const mockPosition = {
      coords: {
        latitude: 51.505,
        longitude: -0.09,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };

    // Mock geolocation API
    const mockGetCurrentPosition = vi.fn((success) => {
      setTimeout(() => success(mockPosition), 0);
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: mockGetCurrentPosition,
      },
      writable: true,
      configurable: true,
    });

    const propsWithLocation = {
      ...defaultProps,
      showUserLocation: true,
      onLocationFound,
    };

    render(<MapContainer {...propsWithLocation} />);

    const locationButton = screen.getByRole('button', {
      name: /get location/i,
    });
    fireEvent.click(locationButton);

    // Wait for the geolocation to be called
    await waitFor(() => {
      expect(mockGetCurrentPosition).toHaveBeenCalled();
    });

    // Wait for the callback
    await waitFor(() => {
      expect(onLocationFound).toHaveBeenCalledWith(mockPosition);
    });
  });

  it('should call onLocationError when location fails', async () => {
    const onLocationError = vi.fn();
    const mockError = {
      code: 1,
      message: 'User denied Geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    // Mock geolocation API with error
    const mockGetCurrentPosition = vi.fn((success, error) => {
      setTimeout(() => error(mockError), 0);
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: mockGetCurrentPosition,
      },
      writable: true,
      configurable: true,
    });

    const propsWithLocation = {
      ...defaultProps,
      showUserLocation: true,
      onLocationError,
    };

    render(<MapContainer {...propsWithLocation} />);

    const locationButton = screen.getByRole('button', {
      name: /get location/i,
    });
    fireEvent.click(locationButton);

    // Wait for the geolocation to be called
    await waitFor(() => {
      expect(mockGetCurrentPosition).toHaveBeenCalled();
    });

    // Wait for the error callback
    await waitFor(() => {
      expect(onLocationError).toHaveBeenCalledWith(mockError);
    });
  });

  // onMarkerClick prop doesn't exist - removed test

  it('should apply custom className', () => {
    const className = 'custom-map-class';

    render(<MapContainer {...defaultProps} className={className} />);

    const container = screen.getByTestId('map-container');
    expect(container).toHaveClass(className);
  });

  it('should apply custom styles', () => {
    const style = { border: '2px solid red' };

    render(<MapContainer {...defaultProps} style={style} />);

    const container = screen.getByTestId('map-container');
    expect(container).toHaveStyle(style);
  });

  // Map configuration is tested in E2E tests
  // See: e2e/map.spec.ts - 'should handle map zoom controls'

  // Zoom control configuration is tested in E2E tests
  // See: e2e/map.spec.ts - 'should handle map zoom controls'

  // Keyboard navigation is tested in E2E tests
  // See: e2e/map.spec.ts - 'should handle keyboard navigation'

  // User location marker is tested in E2E tests
  // See: e2e/map.spec.ts - 'should get user location after accepting consent'

  // Accuracy circle is tested in E2E tests
  // See: e2e/map.spec.ts - 'should display accuracy circle when available'

  // Tile URL configuration is tested in E2E tests

  // Custom attribution is tested in E2E tests
});
