'use client';

import React from 'react';
import { ColorblindType } from '@/utils/colorblind';
import {
  COLORBLIND_MATRICES,
  matrixToSVGString,
} from '@/utils/colorblind-matrices';

export interface ColorblindFiltersProps {
  className?: string;
}

export const ColorblindFilters: React.FC<ColorblindFiltersProps> = ({
  className = '',
}) => {
  // Define all filter types except NONE
  const filterTypes = [
    ColorblindType.PROTANOPIA,
    ColorblindType.PROTANOMALY,
    ColorblindType.DEUTERANOPIA,
    ColorblindType.DEUTERANOMALY,
    ColorblindType.TRITANOPIA,
    ColorblindType.TRITANOMALY,
    ColorblindType.ACHROMATOPSIA,
    ColorblindType.ACHROMATOMALY,
  ];

  return (
    <svg className={`hidden ${className}`} aria-hidden="true">
      <defs>
        {filterTypes.map((type) => (
          <filter key={type} id={type}>
            <feColorMatrix
              type="matrix"
              values={matrixToSVGString(COLORBLIND_MATRICES[type])}
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
};
