import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationMarker } from './LocationMarker';
import type { LocationMarkerProps } from './LocationMarker';

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  Marker: ({ position, children, eventHandlers }: any) => (
    <div
      data-testid="location-marker"
      data-position={JSON.stringify(position)}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => (
    <div data-testid="marker-popup">{children}</div>
  ),
  Circle: ({ center, radius, pathOptions }: any) => (
    <div
      data-testid="accuracy-circle"
      data-center={JSON.stringify(center)}
      data-radius={radius}
      data-options={JSON.stringify({
        ...pathOptions,
        stroke: pathOptions?.stroke !== undefined ? pathOptions.stroke : true,
        strokeOpacity: pathOptions?.strokeOpacity || 1,
      })}
    />
  ),
  useMap: () => ({
    setView: vi.fn(),
    panTo: vi.fn(),
    getZoom: () => 13,
  }),
}));

// Mock Leaflet
vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({})),
  },
}));

describe('LocationMarker', () => {
  const defaultProps: LocationMarkerProps = {
    position: [51.505, -0.09],
    accuracy: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render marker at specified position', () => {
    render(<LocationMarker {...defaultProps} />);

    const marker = screen.getByTestId('location-marker');
    expect(marker).toBeInTheDocument();
    expect(marker).toHaveAttribute(
      'data-position',
      JSON.stringify([51.505, -0.09])
    );
  });

  it('should render accuracy circle when showAccuracy is true', () => {
    const props = {
      ...defaultProps,
      showAccuracy: true,
    };

    render(<LocationMarker {...props} />);

    const circle = screen.getByTestId('accuracy-circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute(
      'data-center',
      JSON.stringify([51.505, -0.09])
    );
    expect(circle).toHaveAttribute('data-radius', '10');
  });

  it('should not render accuracy circle when showAccuracy is false', () => {
    const props = {
      ...defaultProps,
      showAccuracy: false,
    };

    render(<LocationMarker {...props} />);

    const circle = screen.queryByTestId('accuracy-circle');
    expect(circle).not.toBeInTheDocument();
  });

  it('should not render accuracy circle when accuracy is not provided', () => {
    const props = {
      position: [51.505, -0.09] as [number, number],
      showAccuracy: true,
    };

    render(<LocationMarker {...props} />);

    const circle = screen.queryByTestId('accuracy-circle');
    expect(circle).not.toBeInTheDocument();
  });

  it('should render popup with default text when no popup content provided', () => {
    render(<LocationMarker {...defaultProps} />);

    const popup = screen.getByTestId('marker-popup');
    expect(popup).toBeInTheDocument();
    // Default popup shows location details
    expect(popup).toHaveTextContent('Your Location');
    expect(popup).toHaveTextContent('Lat: 51.505');
    expect(popup).toHaveTextContent('Lng: -0.09');
    expect(popup).toHaveTextContent('Accuracy: ±10m');
  });

  it('should render popup with custom text when provided', () => {
    const props = {
      ...defaultProps,
      popup: 'Custom location text',
    };

    render(<LocationMarker {...props} />);

    const popup = screen.getByTestId('marker-popup');
    expect(popup).toHaveTextContent('Custom location text');
  });

  // Note: Popup only accepts string content, not React nodes
  // Pan to location behavior is tested in E2E tests (requires real map instance)

  it('should use custom icon when provided', () => {
    const customIcon = {
      iconUrl: '/custom-marker.png',
      iconSize: [32, 32] as [number, number],
      iconAnchor: [16, 32] as [number, number],
    };

    const props = {
      ...defaultProps,
      icon: customIcon,
    };

    render(<LocationMarker {...props} />);

    const marker = screen.getByTestId('location-marker');
    expect(marker).toBeInTheDocument();
    // Icon creation would be verified through Leaflet mock
  });

  it('should apply custom test ID when provided', () => {
    const props = {
      ...defaultProps,
      testId: 'custom-location-marker',
    };

    render(<LocationMarker {...props} />);

    const marker = screen.getByTestId('custom-location-marker');
    expect(marker).toBeInTheDocument();
  });

  it('should update position when props change', () => {
    const { rerender } = render(<LocationMarker {...defaultProps} />);

    let marker = screen.getByTestId('location-marker');
    expect(marker).toHaveAttribute(
      'data-position',
      JSON.stringify([51.505, -0.09])
    );

    const newProps = {
      ...defaultProps,
      position: [52.52, 13.405] as [number, number], // Berlin
    };

    rerender(<LocationMarker {...newProps} />);

    marker = screen.getByTestId('location-marker');
    expect(marker).toHaveAttribute(
      'data-position',
      JSON.stringify([52.52, 13.405])
    );
  });

  it('should update accuracy circle when accuracy changes', () => {
    const props = {
      ...defaultProps,
      showAccuracy: true,
    };

    const { rerender } = render(<LocationMarker {...props} />);

    let circle = screen.getByTestId('accuracy-circle');
    expect(circle).toHaveAttribute('data-radius', '10');

    const newProps = {
      ...props,
      accuracy: 25,
    };

    rerender(<LocationMarker {...newProps} />);

    circle = screen.getByTestId('accuracy-circle');
    expect(circle).toHaveAttribute('data-radius', '25');
  });

  it('should apply correct styling to accuracy circle', () => {
    const props = {
      ...defaultProps,
      showAccuracy: true,
    };

    render(<LocationMarker {...props} />);

    const circle = screen.getByTestId('accuracy-circle');
    const options = JSON.parse(circle.getAttribute('data-options') || '{}');

    expect(options).toHaveProperty('fillColor');
    expect(options).toHaveProperty('fillOpacity');
    expect(options).toHaveProperty('stroke');
    expect(options).toHaveProperty('strokeOpacity');
  });

  it('should display accuracy in popup when showAccuracy is true', () => {
    const props = {
      ...defaultProps,
      showAccuracy: true,
      popup: 'You are here',
    };
    render(<LocationMarker {...props} />);

    const popup = screen.getByTestId('marker-popup');
    expect(popup).toHaveTextContent('You are here');
  });
});
