'use client';

import React from 'react';

export interface LocationButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  hasLocation?: boolean;
  permissionState?: PermissionState;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
}

export const LocationButton: React.FC<LocationButtonProps> = ({
  onClick,
  loading = false,
  disabled = false,
  hasLocation = false,
  permissionState = 'prompt',
  className = '',
  variant = 'primary',
  size = 'md',
  testId = 'location-button',
}) => {
  const isDisabled = disabled || permissionState === 'denied';

  const getButtonText = () => {
    if (loading) return 'Getting location...';
    if (permissionState === 'denied') return 'Location blocked';
    if (hasLocation) return 'Update location';
    return 'Get my location';
  };

  const getIcon = () => {
    if (loading)
      return <span className="loading loading-spinner loading-sm"></span>;
    if (permissionState === 'denied') return '🚫';
    if (hasLocation) return '📍';
    return '📍';
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'btn-secondary';
      case 'ghost':
        return 'btn-ghost';
      default:
        return 'btn-primary';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'btn-sm';
      case 'lg':
        return 'btn-lg';
      default:
        return 'btn-md';
    }
  };

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={isDisabled}
      className={`btn ${getVariantClasses()} ${getSizeClasses()} gap-2 ${className}`}
      aria-label={getButtonText()}
      aria-busy={loading}
    >
      {getIcon()}
      <span>{getButtonText()}</span>
    </button>
  );
};
