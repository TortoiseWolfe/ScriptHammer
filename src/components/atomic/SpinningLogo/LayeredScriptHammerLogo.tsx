'use client';

import React from 'react';
import Image from 'next/image';
import { SpinningLogo } from './SpinningLogo';
import { detectedConfig } from '@/config/project-detected';

export interface LayeredScriptHammerLogoProps {
  className?: string;
  size?: number;
  speed?: 'slow' | 'normal' | 'fast' | number;
  pauseOnHover?: boolean;
}

export const LayeredScriptHammerLogo: React.FC<
  LayeredScriptHammerLogoProps
> = ({ className = '', speed = 'slow', pauseOnHover = true }) => {
  return (
    <div
      className={`relative ${className}`}
      style={{
        width: '100%',
        height: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      {/* Rotating gear ring with hammer */}
      <SpinningLogo speed={speed} pauseOnHover={pauseOnHover}>
        <Image
          src={`${detectedConfig.basePath}/scripthammer-logo.svg`}
          alt="Gear Ring"
          width={400}
          height={400}
          className="absolute inset-0 h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 0.7))',
          }}
          priority
        />
      </SpinningLogo>

      {/* Static printing mallet - positioned down and right between script tags */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '56%',
          left: '44%',
          transform: 'translate(calc(-50% + 2px), -50%)',
          width: '45%',
          height: '45%',
          opacity: 0.9,
        }}
      >
        <Image
          src={`${detectedConfig.basePath}/printing-mallet.svg`}
          alt="Printing Mallet"
          width={400}
          height={400}
          className="h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.8))',
          }}
          priority
        />
      </div>

      {/* Static script tags on top */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '40%',
          height: '40%',
        }}
      >
        <Image
          src={`${detectedConfig.basePath}/script-tags.svg`}
          alt="Script Tags"
          width={400}
          height={400}
          className="h-full w-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.8))',
          }}
          priority
        />
      </div>
    </div>
  );
};

LayeredScriptHammerLogo.displayName = 'LayeredScriptHammerLogo';
