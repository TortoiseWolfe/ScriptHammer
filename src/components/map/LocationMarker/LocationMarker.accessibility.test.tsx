import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LocationMarker } from './LocationMarker';

expect.extend(toHaveNoViolations);

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  Marker: ({ position, children }: any) => (
    <div
      data-testid="location-marker"
      data-position={JSON.stringify(position)}
      role="img"
      aria-label="Your location marker"
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => (
    <div role="tooltip" data-testid="marker-popup">
      {children}
    </div>
  ),
  Circle: ({ center, radius }: any) => (
    <div
      data-testid="accuracy-circle"
      data-center={JSON.stringify(center)}
      data-radius={radius}
      role="presentation"
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

describe('LocationMarker Accessibility', () => {
  const defaultProps = {
    position: [51.505, -0.09] as [number, number],
    accuracy: 10,
  };

  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<LocationMarker {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with accuracy circle', async () => {
    const { container } = render(
      <LocationMarker {...defaultProps} showAccuracy={true} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with custom popup', async () => {
    const { container } = render(
      <LocationMarker {...defaultProps} popup="Custom location text" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    const { container } = render(<LocationMarker {...defaultProps} />);

    const marker = container.querySelector('[data-testid="location-marker"]');
    expect(marker).toHaveAttribute('role', 'img');
    expect(marker).toHaveAttribute('aria-label', 'Your location marker');
  });

  it('should have accessible popup', () => {
    const { container } = render(
      <LocationMarker {...defaultProps} popup="You are here" />
    );

    const popup = container.querySelector('[data-testid="marker-popup"]');
    expect(popup).toHaveAttribute('role', 'tooltip');
  });

  it('should mark accuracy circle as presentational', () => {
    const { container } = render(
      <LocationMarker {...defaultProps} showAccuracy={true} />
    );

    const circle = container.querySelector('[data-testid="accuracy-circle"]');
    expect(circle).toHaveAttribute('role', 'presentation');
  });

  // Note: LocationMarker popup only accepts string content, not React nodes
});
