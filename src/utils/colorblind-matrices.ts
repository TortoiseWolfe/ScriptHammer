/**
 * Colorblind correction matrices (Daltonization)
 * These matrices enhance color contrast for users with color vision deficiencies
 * Based on daltonization algorithms that shift problematic colors to distinguishable ranges
 */

import { ColorblindType } from './colorblind';

/**
 * Color transformation matrix type
 * 4x5 matrix for RGBA color transformation
 */
export type ColorMatrix = [
  [number, number, number, number, number], // R' = aR + bG + cB + dA + e
  [number, number, number, number, number], // G' = fR + gG + hB + iA + j
  [number, number, number, number, number], // B' = kR + lG + mB + nA + o
  [number, number, number, number, number], // A' = pR + qG + rB + sA + t
];

/**
 * Flatten a ColorMatrix to SVG filter format
 */
export function matrixToSVGString(matrix: ColorMatrix): string {
  return matrix.map((row) => row.join(' ')).join(' ');
}

/**
 * Daltonization color correction matrices
 * These enhance color distinction for users with color vision deficiencies
 * Rather than simulating colorblindness, these matrices help colorblind users
 * distinguish colors better by shifting problem colors to more visible ranges
 */
export const COLORBLIND_MATRICES: Record<ColorblindType, ColorMatrix> = {
  // Normal vision - identity matrix (no correction needed)
  [ColorblindType.NONE]: [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
  ],

  // Protanopia - Red-blind correction
  // Shifts red information to blue channel for better distinction
  [ColorblindType.PROTANOPIA]: [
    [0, 1.05, 0, 0, 0], // R channel: Use green information
    [0, 1, 0, 0, 0], // G channel: Keep green
    [0.5, 0, 0.5, 0, 0], // B channel: Mix red into blue for distinction
    [0, 0, 0, 1, 0],
  ],

  // Protanomaly - Red-weak correction
  // Enhances red-green separation
  [ColorblindType.PROTANOMALY]: [
    [0.5, 0.5, 0, 0, 0], // R channel: Boost red from green
    [0, 1.2, 0, 0, 0], // G channel: Enhance green
    [0.2, 0, 0.8, 0, 0], // B channel: Add red info to blue
    [0, 0, 0, 1, 0],
  ],

  // Deuteranopia - Green-blind correction
  // Shifts green information to red and blue channels
  [ColorblindType.DEUTERANOPIA]: [
    [1, 0, 0, 0, 0], // R channel: Keep red
    [0.5, 0, 0.5, 0, 0], // G channel: Use red and blue info
    [0, 0.5, 0.5, 0, 0], // B channel: Mix green into blue
    [0, 0, 0, 1, 0],
  ],

  // Deuteranomaly - Green-weak correction
  // Enhances red-green separation
  [ColorblindType.DEUTERANOMALY]: [
    [1.2, 0, 0, 0, 0], // R channel: Enhance red
    [0.2, 0.8, 0, 0, 0], // G channel: Reduce green, add red
    [0, 0.2, 0.8, 0, 0], // B channel: Add green info to blue
    [0, 0, 0, 1, 0],
  ],

  // Tritanopia - Blue-blind correction
  // Shifts blue information to red and green channels
  [ColorblindType.TRITANOPIA]: [
    [1, 0, 0.3, 0, 0], // R channel: Add blue info to red
    [0, 1, 0.3, 0, 0], // G channel: Add blue info to green
    [0, 0, 0.4, 0, 0], // B channel: Reduce blue intensity
    [0, 0, 0, 1, 0],
  ],

  // Tritanomaly - Blue-weak correction
  // Enhances blue-yellow separation
  [ColorblindType.TRITANOMALY]: [
    [1, 0, 0.2, 0, 0], // R channel: Slight blue shift
    [0, 1, 0.2, 0, 0], // G channel: Slight blue shift
    [0, 0, 1.4, 0, 0], // B channel: Enhance blue
    [0, 0, 0, 1, 0],
  ],

  // Achromatopsia - Complete color blindness
  // Enhance contrast using edge detection-like filter
  [ColorblindType.ACHROMATOPSIA]: [
    [0.299, 0.587, 0.114, 0, 0.1], // Add slight brightness boost
    [0.299, 0.587, 0.114, 0, 0.1],
    [0.299, 0.587, 0.114, 0, 0.1],
    [0, 0, 0, 1, 0],
  ],

  // Achromatomaly - Partial color blindness
  // Enhance remaining color perception
  [ColorblindType.ACHROMATOMALY]: [
    [1.2, -0.1, -0.1, 0, 0], // Boost color channels
    [-0.1, 1.2, -0.1, 0, 0],
    [-0.1, -0.1, 1.2, 0, 0],
    [0, 0, 0, 1, 0],
  ],
};

/**
 * Get a formatted SVG filter string for a colorblind type
 */
export function getColorblindMatrixString(type: ColorblindType): string {
  const matrix = COLORBLIND_MATRICES[type];
  return matrixToSVGString(matrix);
}

/**
 * Validate that a matrix is properly formed
 */
export function isValidColorMatrix(matrix: ColorMatrix): boolean {
  if (!Array.isArray(matrix) || matrix.length !== 4) {
    return false;
  }

  for (const row of matrix) {
    if (!Array.isArray(row) || row.length !== 5) {
      return false;
    }
    for (const value of row) {
      if (typeof value !== 'number' || isNaN(value)) {
        return false;
      }
    }
  }

  // Alpha channel should be preserved (fourth row should be [0, 0, 0, 1, 0])
  const alphaRow = matrix[3];
  return (
    alphaRow[0] === 0 &&
    alphaRow[1] === 0 &&
    alphaRow[2] === 0 &&
    alphaRow[3] === 1 &&
    alphaRow[4] === 0
  );
}

/**
 * Performance metrics for filter application
 */
export interface FilterPerformance {
  type: ColorblindType;
  applicationTime: number; // milliseconds
  timestamp: number;
}

/**
 * Measure filter application performance
 */
export function measureFilterPerformance(
  type: ColorblindType,
  applyFn: () => void
): FilterPerformance {
  const start = performance.now();
  applyFn();
  const end = performance.now();

  return {
    type,
    applicationTime: end - start,
    timestamp: Date.now(),
  };
}
