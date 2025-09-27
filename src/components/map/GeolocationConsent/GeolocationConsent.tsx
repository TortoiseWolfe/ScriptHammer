'use client';

import React, { useState } from 'react';

export enum GeolocationPurpose {
  USER_LOCATION_DISPLAY = 'user_location_display',
  NEARBY_SEARCH = 'nearby_search',
  LOCATION_ANALYTICS = 'location_analytics',
  PERSONALIZATION = 'personalization',
}

export interface GeolocationConsentProps {
  isOpen: boolean;
  onAccept: (purposes: GeolocationPurpose[]) => void;
  onDecline: () => void;
  onClose?: () => void;
  title?: string;
  description?: string;
  purposes?: GeolocationPurpose[];
  required?: boolean;
  privacyPolicyUrl?: string;
  testId?: string;
}

const purposeLabels: Record<GeolocationPurpose, string> = {
  [GeolocationPurpose.USER_LOCATION_DISPLAY]: 'Show your location on the map',
  [GeolocationPurpose.NEARBY_SEARCH]: 'Find nearby places and services',
  [GeolocationPurpose.LOCATION_ANALYTICS]:
    'Improve your experience with location analytics',
  [GeolocationPurpose.PERSONALIZATION]:
    'Provide personalized content based on your location',
};

export const GeolocationConsent: React.FC<GeolocationConsentProps> = ({
  isOpen,
  onAccept,
  onDecline,
  onClose,
  title = 'Location Access',
  description = 'This app would like to use your location to provide a better experience.',
  purposes = [
    GeolocationPurpose.USER_LOCATION_DISPLAY,
    GeolocationPurpose.NEARBY_SEARCH,
    GeolocationPurpose.LOCATION_ANALYTICS,
    GeolocationPurpose.PERSONALIZATION,
  ],
  required = false,
  privacyPolicyUrl,
  testId = 'geolocation-consent',
}) => {
  const [selectedPurposes, setSelectedPurposes] =
    useState<GeolocationPurpose[]>(purposes);

  if (!isOpen) return null;

  const handlePurposeToggle = (purpose: GeolocationPurpose) => {
    setSelectedPurposes((prev) =>
      prev.includes(purpose)
        ? prev.filter((p) => p !== purpose)
        : [...prev, purpose]
    );
  };

  const handleAccept = () => {
    onAccept(selectedPurposes);
  };

  const handleClose = () => {
    if (!required && onClose) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !required) {
      handleClose();
    }
  };

  return (
    <div className="modal modal-open" data-testid={testId}>
      <div
        className="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-description"
        onKeyDown={handleKeyDown}
      >
        {!required && (
          <button
            className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}

        <h3 id="consent-title" className="text-lg font-bold">
          {title}
        </h3>

        <p id="consent-description" className="py-4">
          {description}
        </p>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">
              We would like to use your location to:
            </span>
          </label>

          {purposes.map((purpose) => (
            <label key={purpose} className="label cursor-pointer">
              <span className="label-text">{purposeLabels[purpose]}</span>
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={selectedPurposes.includes(purpose)}
                onChange={() => handlePurposeToggle(purpose)}
                tabIndex={0}
              />
            </label>
          ))}
        </div>

        {privacyPolicyUrl && (
          <p className="text-base-content/70 mt-4 text-sm">
            By accepting, you agree to our{' '}
            <a
              href={privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary"
            >
              Privacy Policy
            </a>
          </p>
        )}

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={onDecline}
            disabled={required}
          >
            Decline
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAccept}
            disabled={selectedPurposes.length === 0}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
