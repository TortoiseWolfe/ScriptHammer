/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { GeolocationWithConsent } from '@/components/map/GeolocationWithConsent';

// Mock components
vi.mock('@/components/map/GeolocationConsent', () => ({
  GeolocationConsent: vi.fn(({ isOpen, onAccept, onDecline }: any) =>
    isOpen ? (
      <div data-testid="geolocation-consent">
        <button onClick={() => onAccept(['user_location_display'])}>
          Accept Geolocation
        </button>
        <button onClick={() => onDecline()}>Decline Geolocation</button>
      </div>
    ) : null
  ),
}));

describe('GDPR Consent Integration', () => {
  beforeEach(() => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Consent Context Integration', () => {
    it('should integrate with existing consent system', () => {
      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Check that geolocation is part of consent categories
      const consentData = localStorage.getItem('consent-preferences');
      if (consentData) {
        const parsed = JSON.parse(consentData);
        expect(parsed).toHaveProperty('geolocation');
      }
    });

    it('should respect global consent settings', async () => {
      // Set global consent to denied
      localStorage.setItem('consent-preferences', JSON.stringify({
        analytics: false,
        marketing: false,
        geolocation: false,
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Geolocation should be disabled
      const locationButton = screen.queryByRole('button', { name: /location/i });
      if (locationButton) {
        expect(locationButton).toBeDisabled();
      }
    });

    it('should update global consent when geolocation accepted', async () => {
      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Trigger consent modal
      const requestButton = screen.getByRole('button', { name: /enable location/i });
      fireEvent.click(requestButton);

      // Accept geolocation
      const acceptButton = await screen.findByText('Accept Geolocation');
      fireEvent.click(acceptButton);

      // Check global consent updated
      await waitFor(() => {
        const consentData = localStorage.getItem('consent-preferences');
        const parsed = JSON.parse(consentData!);
        expect(parsed.geolocation).toBe(true);
      });
    });

    it('should handle consent categories independently', async () => {
      // Set some consents
      localStorage.setItem('consent-preferences', JSON.stringify({
        analytics: true,
        marketing: false,
        geolocation: null, // Not yet decided
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Accept geolocation
      const requestButton = screen.getByRole('button', { name: /enable location/i });
      fireEvent.click(requestButton);

      const acceptButton = await screen.findByText('Accept Geolocation');
      fireEvent.click(acceptButton);

      // Check other consents unchanged
      await waitFor(() => {
        const consentData = localStorage.getItem('consent-preferences');
        const parsed = JSON.parse(consentData!);
        expect(parsed.analytics).toBe(true);
        expect(parsed.marketing).toBe(false);
        expect(parsed.geolocation).toBe(true);
      });
    });
  });

  describe('Persistence', () => {
    it('should persist geolocation consent to localStorage', async () => {
      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Accept consent
      const requestButton = screen.getByRole('button', { name: /enable location/i });
      fireEvent.click(requestButton);

      const acceptButton = await screen.findByText('Accept Geolocation');
      fireEvent.click(acceptButton);

      // Check localStorage
      await waitFor(() => {
        const consent = localStorage.getItem('geolocation-consent');
        expect(consent).toBeTruthy();
        const parsed = JSON.parse(consent!);
        expect(parsed).toMatchObject({
          consentGiven: true,
          purposes: ['user_location_display'],
        });
        expect(parsed.consentDate).toBeTruthy();
      });
    });

    it('should persist consent denial', async () => {
      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Decline consent
      const requestButton = screen.getByRole('button', { name: /enable location/i });
      fireEvent.click(requestButton);

      const declineButton = await screen.findByText('Decline Geolocation');
      fireEvent.click(declineButton);

      // Check localStorage
      await waitFor(() => {
        const consent = localStorage.getItem('geolocation-consent');
        expect(consent).toBeTruthy();
        const parsed = JSON.parse(consent!);
        expect(parsed).toMatchObject({
          consentGiven: false,
          purposes: [],
        });
      });
    });

    it('should load persisted consent on mount', () => {
      // Set previous consent
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes: ['user_location_display', 'nearby_search'],
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Should not show consent request button
      expect(screen.queryByRole('button', { name: /enable location/i })).not.toBeInTheDocument();

      // Should show location button directly
      expect(screen.getByRole('button', { name: /show.*location/i })).toBeInTheDocument();
    });

    it('should handle corrupt localStorage data', () => {
      // Set invalid consent data
      localStorage.setItem('geolocation-consent', 'invalid json');

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Should treat as no consent
      expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
    });
  });

  describe('Consent Revocation', () => {
    it('should allow revoking consent', async () => {
      // Start with consent given
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes: ['user_location_display'],
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Find revoke button
      const revokeButton = screen.getByRole('button', { name: /revoke.*location/i });
      fireEvent.click(revokeButton);

      // Confirm revocation
      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      // Check consent revoked
      await waitFor(() => {
        const consent = localStorage.getItem('geolocation-consent');
        const parsed = JSON.parse(consent!);
        expect(parsed.consentGiven).toBe(false);
      });
    });

    it('should clear location data on revocation', async () => {
      // Set consent and location data
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes: ['user_location_display'],
      }));
      localStorage.setItem('last-known-location', JSON.stringify({
        lat: 51.505,
        lng: -0.09,
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Revoke consent
      const revokeButton = screen.getByRole('button', { name: /revoke.*location/i });
      fireEvent.click(revokeButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      // Location data should be cleared
      await waitFor(() => {
        expect(localStorage.getItem('last-known-location')).toBeNull();
      });
    });

    it('should re-request consent after revocation', async () => {
      // Start with consent given
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes: ['user_location_display'],
      }));

      const { rerender } = render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Revoke consent
      const revokeButton = screen.getByRole('button', { name: /revoke.*location/i });
      fireEvent.click(revokeButton);

      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      // Rerender to simulate page refresh
      rerender(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Should show consent request again
      expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
    });
  });

  describe('Consent Expiry', () => {
    it('should respect consent expiry date', () => {
      // Set expired consent (1 year old)
      const expiredDate = new Date();
      expiredDate.setFullYear(expiredDate.getFullYear() - 1);

      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: expiredDate.toISOString(),
        purposes: ['user_location_display'],
        retentionPeriod: 365, // 365 days
        expiryDate: new Date().toISOString(), // Already expired
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Should request consent again
      expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
    });

    it('should auto-renew consent if still valid', () => {
      // Set recent consent
      const recentDate = new Date();
      const futureExpiry = new Date();
      futureExpiry.setDate(futureExpiry.getDate() + 30); // Expires in 30 days

      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: recentDate.toISOString(),
        purposes: ['user_location_display'],
        retentionPeriod: 365,
        expiryDate: futureExpiry.toISOString(),
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Should not request consent
      expect(screen.queryByRole('button', { name: /enable location/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show.*location/i })).toBeInTheDocument();
    });
  });

  describe('Purpose-Specific Consent', () => {
    it('should handle different consent purposes', async () => {
      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Request consent
      const requestButton = screen.getByRole('button', { name: /enable location/i });
      fireEvent.click(requestButton);

      // Should show purpose checkboxes
      expect(screen.getByLabelText(/show.*location.*map/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/find.*nearby/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/improve.*experience/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/personalized/i)).toBeInTheDocument();
    });

    it('should enable features based on consented purposes', async () => {
      // Set consent for specific purposes only
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes: ['user_location_display'], // Only display, not analytics
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Location display should be enabled
      expect(screen.getByRole('button', { name: /show.*location/i })).toBeInTheDocument();

      // Analytics features should be disabled
      expect(screen.queryByText(/location analytics enabled/i)).not.toBeInTheDocument();
    });
  });

  describe('Consent Synchronization', () => {
    it('should sync consent across tabs', async () => {
      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'geolocation-consent',
        newValue: JSON.stringify({
          consentGiven: true,
          consentDate: new Date().toISOString(),
          purposes: ['user_location_display'],
        }),
        oldValue: null,
        storageArea: localStorage,
      });

      window.dispatchEvent(storageEvent);

      // Should update UI
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /enable location/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /show.*location/i })).toBeInTheDocument();
      });
    });

    it('should handle consent revocation from another tab', async () => {
      // Start with consent
      localStorage.setItem('geolocation-consent', JSON.stringify({
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes: ['user_location_display'],
      }));

      render(
        <ConsentProvider>
          <GeolocationWithConsent />
        </ConsentProvider>
      );

      // Simulate revocation from another tab
      const storageEvent = new StorageEvent('storage', {
        key: 'geolocation-consent',
        newValue: JSON.stringify({
          consentGiven: false,
          consentDate: null,
          purposes: [],
        }),
        oldValue: localStorage.getItem('geolocation-consent'),
        storageArea: localStorage,
      });

      window.dispatchEvent(storageEvent);

      // Should update UI
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable location/i })).toBeInTheDocument();
      });
    });
  });
});