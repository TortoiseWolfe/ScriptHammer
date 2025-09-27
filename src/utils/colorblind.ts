/**
 * Colorblind type definitions and utility functions
 * Based on scientifically validated color vision deficiency types
 */

/**
 * Types of color vision deficiencies
 * Prevalence data from Machado et al. 2009
 */
export enum ColorblindType {
  /** Normal color vision */
  NONE = 'none',
  /** Red-blind (1% of males) - Missing L-cones */
  PROTANOPIA = 'protanopia',
  /** Red-weak (1% of males) - Anomalous L-cones */
  PROTANOMALY = 'protanomaly',
  /** Green-blind (1% of males) - Missing M-cones */
  DEUTERANOPIA = 'deuteranopia',
  /** Green-weak (5% of males) - Anomalous M-cones */
  DEUTERANOMALY = 'deuteranomaly',
  /** Blue-blind (0.001%) - Missing S-cones */
  TRITANOPIA = 'tritanopia',
  /** Blue-weak (0.01%) - Anomalous S-cones */
  TRITANOMALY = 'tritanomaly',
  /** Complete colorblind (0.003%) - No functioning cones */
  ACHROMATOPSIA = 'achromatopsia',
  /** Partial colorblind - Reduced cone function */
  ACHROMATOMALY = 'achromatomaly',
}

/**
 * Settings for colorblind mode
 */
export interface ColorblindSettings {
  /** Current colorblind mode */
  mode: ColorblindType;
  /** Whether pattern overlays are enabled */
  patternsEnabled: boolean;
  /** Simulation mode for testing */
  simulationMode?: boolean;
}

/**
 * Default colorblind settings
 */
export const DEFAULT_COLORBLIND_SETTINGS: ColorblindSettings = {
  mode: ColorblindType.NONE,
  patternsEnabled: false,
  simulationMode: false,
};

/**
 * Human-readable labels for colorblind correction modes
 */
export const COLORBLIND_LABELS: Record<ColorblindType, string> = {
  [ColorblindType.NONE]: 'No Correction',
  [ColorblindType.PROTANOPIA]: 'Red-Blind Assistance',
  [ColorblindType.PROTANOMALY]: 'Red-Weak Assistance',
  [ColorblindType.DEUTERANOPIA]: 'Green-Blind Assistance',
  [ColorblindType.DEUTERANOMALY]: 'Green-Weak Assistance',
  [ColorblindType.TRITANOPIA]: 'Blue-Blind Assistance',
  [ColorblindType.TRITANOMALY]: 'Blue-Weak Assistance',
  [ColorblindType.ACHROMATOPSIA]: 'Complete Colorblind Assistance',
  [ColorblindType.ACHROMATOMALY]: 'Partial Colorblind Assistance',
};

/**
 * Severity levels for colorblind types
 */
export enum ColorblindSeverity {
  NONE = 'none',
  ANOMALOUS = 'anomalous', // Weak variants
  DICHROMAT = 'dichromat', // Complete loss variants
  MONOCHROMAT = 'monochromat', // No color vision
}

/**
 * Get severity level for a colorblind type
 */
export function getColorblindSeverity(
  type: ColorblindType
): ColorblindSeverity {
  switch (type) {
    case ColorblindType.NONE:
      return ColorblindSeverity.NONE;
    case ColorblindType.PROTANOMALY:
    case ColorblindType.DEUTERANOMALY:
    case ColorblindType.TRITANOMALY:
    case ColorblindType.ACHROMATOMALY:
      return ColorblindSeverity.ANOMALOUS;
    case ColorblindType.PROTANOPIA:
    case ColorblindType.DEUTERANOPIA:
    case ColorblindType.TRITANOPIA:
      return ColorblindSeverity.DICHROMAT;
    case ColorblindType.ACHROMATOPSIA:
      return ColorblindSeverity.MONOCHROMAT;
    default:
      return ColorblindSeverity.NONE;
  }
}

/**
 * Storage key for persisting colorblind settings
 */
export const COLORBLIND_STORAGE_KEY = 'colorblind-settings';

/**
 * CSS filter references for each colorblind type
 */
export const COLORBLIND_FILTER_IDS: Record<ColorblindType, string> = {
  [ColorblindType.NONE]: 'none',
  [ColorblindType.PROTANOPIA]: 'url(#protanopia)',
  [ColorblindType.PROTANOMALY]: 'url(#protanomaly)',
  [ColorblindType.DEUTERANOPIA]: 'url(#deuteranopia)',
  [ColorblindType.DEUTERANOMALY]: 'url(#deuteranomaly)',
  [ColorblindType.TRITANOPIA]: 'url(#tritanopia)',
  [ColorblindType.TRITANOMALY]: 'url(#tritanomaly)',
  [ColorblindType.ACHROMATOPSIA]: 'url(#achromatopsia)',
  [ColorblindType.ACHROMATOMALY]: 'url(#achromatomaly)',
};
