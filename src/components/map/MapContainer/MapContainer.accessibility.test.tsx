import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MapContainer } from './MapContainer';

expect.extend(toHaveNoViolations);

// Mock dynamic import for MapContainerInner
vi.mock('./MapContainerInner', () => ({
  default: ({ children }: any) => (
    <div data-testid="map-container-inner">{children}</div>
  ),
}));

// Mock LocationButton
vi.mock('@/components/map/LocationButton', () => ({
  LocationButton: ({ onClick }: any) => (
    <button onClick={onClick} aria-label="Get location">
      Get location
    </button>
  ),
}));

describe('MapContainer Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<MapContainer />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA attributes', () => {
    render(<MapContainer testId="test-map" />);

    const container = screen.getByTestId('test-map');
    expect(container).toHaveAttribute('role', 'application');
    expect(container).toHaveAttribute('aria-label', 'Interactive map');
  });

  it('should have no violations with markers', async () => {
    const markers = [
      {
        id: '1',
        position: [51.505, -0.09] as [number, number],
        popup: 'Test Marker',
      },
    ];

    const { container } = render(<MapContainer markers={markers} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with location button', async () => {
    const { container } = render(<MapContainer showUserLocation={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain focus management', () => {
    render(<MapContainer showUserLocation={true} />);

    const locationButton = screen.getByRole('button', { name: /location/i });
    expect(locationButton).toBeInTheDocument();
    expect(locationButton).not.toHaveAttribute('tabindex', '-1');
  });

  it('should have accessible loading state', async () => {
    const { container } = render(<MapContainer showUserLocation={true} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
