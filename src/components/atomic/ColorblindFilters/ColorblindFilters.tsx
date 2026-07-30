'use client';

import React from 'react';
import { useColorblindMode } from '@/hooks/useColorblindMode';
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
  // APPLYING the saved mode belongs here, not in a UI control (#378).
  //
  // This hook's mount effect reads localStorage and writes
  // `document.documentElement.style.filter`. It used to run only because the nav
  // always mounted `ColorblindToggle` — `hidden lg:block` is CSS, so the
  // component was still mounted at every width. Folding the controls into the
  // `Display ▾` popover, whose children render only while it is OPEN, meant the
  // effect stopped running on page load: a user's saved colour-vision correction
  // silently stopped being applied until they opened a menu.
  //
  // This component is always mounted (layout.tsx) and already IS the
  // representative of the colourblind system — it renders the SVG filter defs
  // the mode refers to. Applying the mode next to defining the filters keeps the
  // feature alive without a UI control having to exist.
  //
  // Safe to have two instances: the hook derives everything from localStorage and
  // writes the same value idempotently.
  //
  // Caught by tests/e2e/colorblind-fixed.spec.ts, which polls for the filter to
  // be applied on a plain page load. Its own docstring explains why it cannot be
  // a unit test.
  useColorblindMode();

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
