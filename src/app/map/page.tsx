'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamicImport from 'next/dynamic';
import { useGeolocation } from '@/hooks/useGeolocation';
import { LocationButton } from '@/components/map/LocationButton';
import {
  GeolocationConsent,
  GeolocationPurpose,
} from '@/components/map/GeolocationConsent';
import type { LatLngTuple } from 'leaflet';
import { createLogger } from '@/lib/logger';

const logger = createLogger('app:map:page');

// Dynamic import for MapContainer to avoid SSR issues
const MapContainer = dynamicImport(
  () =>
    import('@/components/map/MapContainer').then((mod) => ({
      default: mod.MapContainer,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="bg-base-200 flex h-[600px] items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    ),
  }
);

export default function MapPage() {
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngTuple>([51.505, -0.09]); // Default to London

  const {
    position,
    permission,
    loading,
    error,
    accuracy,
    getCurrentPosition,
    isSupported,
  } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 30000,
  });

  // Check localStorage after mount
  useEffect(() => {
    const consent = localStorage.getItem('geolocation-consent');
    if (consent) {
      try {
        const parsed = JSON.parse(consent);
        if (parsed.consentGiven === true) {
          setHasConsent(true);
        }
      } catch {
        // Invalid consent data, keep as false
      }
    }
  }, []);

  const handleLocationRequest = useCallback(() => {
    if (!hasConsent) {
      setShowConsentModal(true);
    } else {
      getCurrentPosition();
    }
  }, [hasConsent, getCurrentPosition]);

  const handleConsentAccept = useCallback(
    (purposes: GeolocationPurpose[]) => {
      // Save consent to localStorage
      const consentData = {
        consentGiven: true,
        consentDate: new Date().toISOString(),
        purposes,
        expiryDate: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(), // 1 year
      };
      localStorage.setItem('geolocation-consent', JSON.stringify(consentData));

      setHasConsent(true);
      setShowConsentModal(false);

      // Request location after consent
      getCurrentPosition();
    },
    [getCurrentPosition]
  );

  const handleConsentDecline = useCallback(() => {
    // Save rejection to localStorage
    const consentData = {
      consentGiven: false,
      consentDate: new Date().toISOString(),
      purposes: [],
    };
    localStorage.setItem('geolocation-consent', JSON.stringify(consentData));

    setHasConsent(false);
    setShowConsentModal(false);
  }, []);

  const handleLocationFound = useCallback(
    (geolocationPosition: GeolocationPosition) => {
      const newLocation: LatLngTuple = [
        geolocationPosition.coords.latitude,
        geolocationPosition.coords.longitude,
      ];
      setUserLocation(newLocation);
      setMapCenter(newLocation);
    },
    []
  );

  const handleLocationError = useCallback(
    (geolocationError: GeolocationPositionError) => {
      logger.error('Location error', {
        code: geolocationError.code,
        message: geolocationError.message,
      });
    },
    []
  );

  // Update location when position changes
  React.useEffect(() => {
    if (position) {
      const newLocation: LatLngTuple = [
        position.coords.latitude,
        position.coords.longitude,
      ];
      setUserLocation(newLocation);
      setMapCenter(newLocation);
    }
  }, [position]);

  // Example markers for demo purposes
  const demoMarkers = [
    {
      id: 'marker1',
      position: [51.51, -0.1] as LatLngTuple,
      popup: 'Test Marker 1',
    },
    {
      id: 'marker2',
      position: [51.5, -0.08] as LatLngTuple,
      popup: 'Test Marker 2',
    },
  ];

  return (
    <main className="container mx-auto p-4">
      <header className="prose mb-6 max-w-none">
        <h1 className="!text-2xl font-bold sm:!text-4xl md:!text-5xl">
          Interactive Map
        </h1>
        <p>
          Explore the map and enable location services to see your current
          position.
          {!isSupported && (
            <span className="text-error ml-2">
              (Geolocation is not supported by your browser)
            </span>
          )}
        </p>
      </header>

      <section className="card bg-base-100 shadow-xl">
        <div className="card-body p-4">
          <div className="mb-4 flex flex-wrap gap-4">
            <LocationButton
              onClick={handleLocationRequest}
              loading={loading}
              disabled={!isSupported || permission === 'denied'}
              hasLocation={!!userLocation}
              permissionState={permission}
            />

            {error && (
              <div className="alert alert-error">
                <span>{error.message}</span>
              </div>
            )}

            {userLocation && (
              <div className="stats shadow">
                <div className="stat">
                  <div className="stat-title">Your Location</div>
                  <div className="stat-value text-lg">
                    {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                  </div>
                  {accuracy && (
                    <div className="stat-desc">
                      Accuracy: ±{accuracy.toFixed(0)}m
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <MapContainer
              center={mapCenter}
              zoom={13}
              height="600px"
              width="100%"
              showUserLocation={false} // We'll manage location manually
              markers={[
                ...demoMarkers,
                ...(userLocation
                  ? [
                      {
                        id: 'user-location',
                        position: userLocation,
                        popup: `You are here (Accuracy: ±${accuracy?.toFixed(0) || 0}m)`,
                      },
                    ]
                  : []),
              ]}
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
              testId="map-container"
            />
          </div>
        </div>
      </section>

      <GeolocationConsent
        isOpen={showConsentModal}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        onClose={() => setShowConsentModal(false)}
        title="Enable Location Services"
        description="We'd like to use your location to show you on the map and help you explore nearby places."
        privacyPolicyUrl="/privacy"
      />
    </main>
  );
}
