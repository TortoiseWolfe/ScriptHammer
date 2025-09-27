'use client';

import React from 'react';

export interface SpinningLogoProps {
  /** Content to spin - can be an icon, image, text, or any React node */
  children: React.ReactNode;
  /** Animation speed - predefined or custom duration in seconds */
  speed?: 'slow' | 'normal' | 'fast' | number;
  /** Size of the container */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Pause animation on hover */
  pauseOnHover?: boolean;
  /** Direction of rotation */
  direction?: 'clockwise' | 'counter-clockwise';
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Whether the spinner is currently active */
  isSpinning?: boolean;
}

const speedMap = {
  slow: 30,
  normal: 20,
  fast: 10,
};

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export const SpinningLogo: React.FC<SpinningLogoProps> = ({
  children,
  speed = 'slow',
  size,
  pauseOnHover = false,
  direction = 'clockwise',
  className,
  ariaLabel = 'Spinning logo',
  isSpinning = true,
}) => {
  const duration = typeof speed === 'number' ? speed : speedMap[speed];

  // If no size provided, use 100% to fill container
  const dimensions =
    size === undefined
      ? '100%'
      : typeof size === 'number'
        ? size
        : sizeMap[size];

  const spinAnimation = {
    animation: isSpinning
      ? `spin-${direction} ${duration}s linear infinite`
      : 'none',
  };

  const classes = [
    'inline-flex items-center justify-center',
    pauseOnHover && 'pause-on-hover',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      style={{
        ...spinAnimation,
        width: dimensions,
        height: dimensions,
        filter: 'drop-shadow(2px 2px 0px rgba(0, 0, 0, 0.3))',
      }}
      role="img"
      aria-label={ariaLabel}
      data-testid="spinning-logo"
    >
      {children}
    </div>
  );
};

SpinningLogo.displayName = 'SpinningLogo';
