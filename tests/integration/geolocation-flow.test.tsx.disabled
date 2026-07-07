/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeolocationFlow } from '@/app/map/GeolocationFlow';

// Mock the entire geolocation flow components
vi.mock('@/components/map/MapContainer', () => ({
  MapContainer: vi.fn(({ onLocationFound, onLocationError, showUserLocation }: any) => (
    <div data-testid="map-container">
      {showUserLocation && (
        <button
          data-testid="mock-location-button"
          onClick={() => {
            // Simulate location request
            if (window.navigator.geolocation) {
              window.navigator.geolocation.getCurrentPosition(
                (position) => onLocationFound?.(position),
                (error) => onLocationError?.(error)
              );
            }
          }}
        >
          Get Location
        </button>
      )}
    </div>
  )),
}));

vi.mock('@/components/map/GeolocationConsent', () => ({
  GeolocationConsent: vi.fn(({ isOpen, onAccept, onDecline }: any) =>
    isOpen ? (
      <div data-testid="consent-modal">
        <button onClick={() => onAccept(['user_location_display'])}>Accept</button>
        <button onClick={() => onDecline()}>Decline</button>
      </div>
    ) : null
  ),
}));

describe('Geolocation Permission Flow Integration', () => {
  let mockGeolocation: any;
  let mockPermissions: any;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Mock geolocation API
    mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    // Mock permissions API
    mockPermissions = {
      query: vi.fn(),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global.navigator, 'permissions', {
      value: mockPermissions,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('First-time User Flow', () => {
    it('should show consent modal before requesting location', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'prompt' });

      render(<GeolocationFlow />);

      // Click location button
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      // Should show consent modal
      await waitFor(() => {
        expect(screen.getByTestId('consent-modal')).toBeInTheDocument();
      });
    });

    it('should request location after accepting consent', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'prompt' });
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 51.505,
            longitude: -0.09,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
      });

      render(<GeolocationFlow />);

      // Click location button
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      // Accept consent
      const acceptButton = await screen.findByText('Accept');
      fireEvent.click(acceptButton);

      // Should call geolocation
      await waitFor(() => {
        expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
      });
    });

    it('should not request location after declining consent', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'prompt' });

      render(<GeolocationFlow />);

      // Click location button
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      // Decline consent
      const declineButton = await screen.findByText('Decline');
      fireEvent.click(declineButton);

      // Should not call geolocation
      expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('should save consent decision to localStorage', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'prompt' });

      render(<GeolocationFlow />);

      // Click location button
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      // Accept consent
      const acceptButton = await screen.findByText('Accept');
      fireEvent.click(acceptButton);

      // Check localStorage
      await waitFor(() => {
        const consent = localStorage.getItem('geolocation-consent');
        expect(consent).toBeTruthy();
        const parsed = JSON.parse(consent!);
        expect(parsed.consentGiven).toBe(true);
      });
    });
  });

  describe('Returning User Flow', () => {
    it('should not show consent modal if already consented', async () => {
      // Set previous consent
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes: ['user_location_display'],
      }));

      mockPermissions.query.mockResolvedValue({ state: 'prompt' });
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 51.505,
            longitude: -0.09,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
      });

      render(<GeolocationFlow />);

      // Click location button
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      // Should not show consent modal
      expect(screen.queryByTestId('consent-modal')).not.toBeInTheDocument();

      // Should request location directly
      await waitFor(() => {
        expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
      });
    });

    it('should show consent modal if consent was revoked', async () => {
      // Set revoked consent
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: false,
        consentDate: null,
        purposes: [],
      }));

      mockPermissions.query.mockResolvedValue({ state: 'prompt' });

      render(<GeolocationFlow />);

      // Click location button
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      // Should show consent modal again
      await waitFor(() => {
        expect(screen.getByTestId('consent-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Permission State Transitions', () => {
    it('should handle prompt -> granted transition', async () => {
      const permissionStatus = {
        state: 'prompt',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      mockPermissions.query.mockResolvedValue(permissionStatus);
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        // Simulate permission granted
        permissionStatus.state = 'granted';
        success({
          coords: {
            latitude: 51.505,
            longitude: -0.09,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
      });

      render(<GeolocationFlow />);

      // Initial state should be prompt
      expect(screen.getByTestId('mock-location-button')).toBeInTheDocument();

      // Click location button and accept consent
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      const acceptButton = await screen.findByText('Accept');
      fireEvent.click(acceptButton);

      // Permission should be granted
      await waitFor(() => {
        expect(permissionStatus.state).toBe('granted');
      });
    });

    it('should handle prompt -> denied transition', async () => {
      const permissionStatus = {
        state: 'prompt',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      mockPermissions.query.mockResolvedValue(permissionStatus);
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        // Simulate permission denied
        permissionStatus.state = 'denied';
        error({
          code: 1,
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      render(<GeolocationFlow />);

      // Click location button and accept consent
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      const acceptButton = await screen.findByText('Accept');
      fireEvent.click(acceptButton);

      // Permission should be denied
      await waitFor(() => {
        expect(permissionStatus.state).toBe('denied');
      });
    });

    it('should handle granted -> denied transition (revoked)', async () => {
      const permissionStatus = {
        state: 'granted',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      mockPermissions.query.mockResolvedValue(permissionStatus);

      render(<GeolocationFlow />);

      // Simulate permission revocation
      act(() => {
        permissionStatus.state = 'denied';
        const changeHandler = permissionStatus.addEventListener.mock.calls[0]?.[1];
        if (changeHandler) changeHandler();
      });

      await waitFor(() => {
        expect(screen.getByTestId('mock-location-button')).toHaveAttribute('disabled');
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from timeout error', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' });

      let attemptCount = 0;
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt times out
          error({
            code: 3,
            message: 'Timeout',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        } else {
          // Second attempt succeeds
          success({
            coords: {
              latitude: 51.505,
              longitude: -0.09,
              accuracy: 10,
            },
            timestamp: Date.now(),
          });
        }
      });

      render(<GeolocationFlow />);

      // First attempt
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/timeout/i)).toBeInTheDocument();
      });

      // Retry
      fireEvent.click(locationButton);

      // Should succeed
      await waitFor(() => {
        expect(screen.queryByText(/timeout/i)).not.toBeInTheDocument();
      });
    });

    it('should handle position unavailable error', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' });
      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({
          code: 2,
          message: 'Position unavailable',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      });

      render(<GeolocationFlow />);

      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      await waitFor(() => {
        expect(screen.getByText(/position unavailable/i)).toBeInTheDocument();
      });
    });

    it('should handle missing geolocation API', () => {
      // Remove geolocation
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      render(<GeolocationFlow />);

      expect(screen.getByText(/geolocation not supported/i)).toBeInTheDocument();
      expect(screen.queryByTestId('mock-location-button')).not.toBeInTheDocument();
    });
  });

  describe('State Persistence', () => {
    it('should persist last known location', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' });
      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 51.505,
            longitude: -0.09,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
      });

      const { unmount } = render(<GeolocationFlow />);

      // Get location
      const locationButton = screen.getByTestId('mock-location-button');
      fireEvent.click(locationButton);

      await waitFor(() => {
        const lastLocation = localStorage.getItem('last-known-location');
        expect(lastLocation).toBeTruthy();
      });

      // Unmount and remount
      unmount();
      render(<GeolocationFlow />);

      // Should show last location
      expect(screen.getByText(/last known location/i)).toBeInTheDocument();
    });
  });
});

// Make TypeScript happy with missing implementation
const { act } = await import('@testing-library/react');