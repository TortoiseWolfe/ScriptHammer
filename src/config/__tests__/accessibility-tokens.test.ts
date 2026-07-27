import { describe, it, expect } from 'vitest';
import {
  CONSENT_STORAGE_KEY,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  FONT_SCALE_FACTORS,
} from '../accessibility-tokens';
import { StorageKey } from '../../utils/consent-types';

describe('accessibility tokens (#388)', () => {
  it('duplicates the consent storage key faithfully', () => {
    // AccessibilityScript is a stringified inline <script> and cannot import
    // the enum, so the key is duplicated. If the enum moves, this fails here
    // rather than the pre-paint script silently reading a missing key and
    // falling back to sessionStorage for every user.
    expect(CONSENT_STORAGE_KEY).toBe(StorageKey.CONSENT);
  });

  it('has no scale factor of 1, so the CSS default must match medium', () => {
    // globals.css `--font-scale-factor` is set to FONT_SCALE_FACTORS.medium.
    // If a setting were ever added that maps to 1, that reasoning changes.
    expect(Object.values(FONT_SCALE_FACTORS)).not.toContain(1);
    expect(FONT_SCALE_FACTORS[DEFAULT_ACCESSIBILITY_SETTINGS.fontSize]).toBe(
      1.5
    );
  });

  it('orders the scale factors monotonically', () => {
    const { small, medium, large } = FONT_SCALE_FACTORS;
    const xLarge = FONT_SCALE_FACTORS['x-large'];
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
    expect(large).toBeLessThan(xLarge);
  });
});
