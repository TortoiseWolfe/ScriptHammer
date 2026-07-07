import React from 'react';
import Image from 'next/image';

export interface ScriptHammerLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export const ScriptHammerLogo: React.FC<ScriptHammerLogoProps> = ({
  className = 'w-full h-full',
  width = 400,
  height = 400,
}) => {
  return (
    <Image
      src="/scripthammer-logo.svg"
      alt="ScriptHammer Logo"
      width={width}
      height={height}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      priority
    />
  );
};

ScriptHammerLogo.displayName = 'ScriptHammerLogo';
