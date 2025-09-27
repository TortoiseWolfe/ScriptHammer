'use client';

import React from 'react';
import styles from './AnimatedLogo.module.css';

export interface AnimatedLogoProps {
  text?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  animationSpeed?: 'slow' | 'normal' | 'fast';
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
  '2xl': 'text-6xl',
  '3xl': 'text-7xl',
};

const speedMultipliers = {
  slow: 1.5,
  normal: 1,
  fast: 0.7,
};

export const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  text = 'ScriptHammer',
  className = '',
  size = 'xl',
  animationSpeed = 'normal',
}) => {
  const letters = text.split('');
  const speedMultiplier = speedMultipliers[animationSpeed];

  return (
    <span
      className={`${styles.animatedLogo} ${sizeClasses[size]} ${className} text-primary inline-flex cursor-pointer font-bold`}
      style={{
        filter: 'drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.8))',
      }}
    >
      {letters.map((letter, index) => (
        <span
          key={index}
          className={styles.letter}
          style={{
            animationDelay: `${index * 0.05 * speedMultiplier}s`,
            animationDuration: `${0.6 * speedMultiplier}s`,
          }}
        >
          {letter}
        </span>
      ))}
    </span>
  );
};

AnimatedLogo.displayName = 'AnimatedLogo';
