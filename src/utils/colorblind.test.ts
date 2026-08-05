import { describe, it, expect } from 'vitest';
import {
  ColorblindType,
  ColorblindSeverity,
  COLORBLIND_LABELS,
  COLORBLIND_FILTER_IDS,
  COLORBLIND_STORAGE_KEY,
  DEFAULT_COLORBLIND_SETTINGS,
  getColorblindSeverity,
} from './colorblind';

/**
 * `colorblind.ts` had no test (#537).
 *
 * Three of its four exports are `Record<ColorblindType, …>` lookup tables, and
 * TypeScript already refuses a Record that misses a key — so a test that only
 * checks "protanopia maps to something" proves nothing the compiler didn't.
 *
 * What the compiler CANNOT see is the two runtime couplings:
 *
 *   1. `COLORBLIND_FILTER_IDS[t]` must name an SVG filter that `ColorblindFilters`
 *      actually renders. That component emits `<filter id={type}>` — the id IS
 *      the enum's string value — so renaming an enum value silently breaks the
 *      filter reference with no type error anywhere.
 *   2. `getColorblindSeverity` has a `default:` arm returning NONE, which means a
 *      newly added type gets silently classified as "normal vision" instead of
 *      failing to compile.
 *
 * Both are asserted by iterating the enum rather than by listing cases, so
 * adding a type turns these red instead of leaving a hole.
 */

const ALL_TYPES = Object.values(ColorblindType);

describe('ColorblindType', () => {
  it('covers the nine documented deficiencies', () => {
    // A floor, not an equality: adding a type should not fail here, it should
    // fail in the exhaustiveness tests below where the gap actually matters.
    expect(ALL_TYPES.length).toBeGreaterThanOrEqual(9);
    expect(ALL_TYPES).toContain(ColorblindType.NONE);
  });

  it('uses its own lowercase name as its value, which the SVG filter ids rely on', () => {
    for (const type of ALL_TYPES) {
      expect(type).toMatch(/^[a-z]+$/);
    }
  });
});

describe('getColorblindSeverity', () => {
  it('classifies every type without falling through to the default arm', () => {
    // The `default: return NONE` arm is the hazard: a new type would be
    // reported as normal vision. Only NONE may map to NONE.
    for (const type of ALL_TYPES) {
      const severity = getColorblindSeverity(type);
      expect(Object.values(ColorblindSeverity)).toContain(severity);
      if (type !== ColorblindType.NONE) {
        expect(severity).not.toBe(ColorblindSeverity.NONE);
      }
    }
  });

  it.each([
    [ColorblindType.NONE, ColorblindSeverity.NONE],
    [ColorblindType.PROTANOMALY, ColorblindSeverity.ANOMALOUS],
    [ColorblindType.DEUTERANOMALY, ColorblindSeverity.ANOMALOUS],
    [ColorblindType.TRITANOMALY, ColorblindSeverity.ANOMALOUS],
    [ColorblindType.ACHROMATOMALY, ColorblindSeverity.ANOMALOUS],
    [ColorblindType.PROTANOPIA, ColorblindSeverity.DICHROMAT],
    [ColorblindType.DEUTERANOPIA, ColorblindSeverity.DICHROMAT],
    [ColorblindType.TRITANOPIA, ColorblindSeverity.DICHROMAT],
    [ColorblindType.ACHROMATOPSIA, ColorblindSeverity.MONOCHROMAT],
  ])('maps %s to %s', (type, expected) => {
    expect(getColorblindSeverity(type)).toBe(expected);
  });

  it('follows the -anomaly/-anopia naming convention it encodes', () => {
    // The severity split is not arbitrary: "-anomaly" is a weakened cone,
    // "-anopia" is a missing one. Deriving the expectation from the NAME means
    // a type added to the wrong `case` group fails here even though every
    // individual mapping above still passes.
    for (const type of ALL_TYPES) {
      if (type.endsWith('anomaly')) {
        expect(getColorblindSeverity(type)).toBe(ColorblindSeverity.ANOMALOUS);
      } else if (type.endsWith('anopia')) {
        expect(getColorblindSeverity(type)).toBe(ColorblindSeverity.DICHROMAT);
      }
    }
  });
});

describe('COLORBLIND_FILTER_IDS', () => {
  it('references each filter by the enum value ColorblindFilters renders as its id', () => {
    // ColorblindFilters.tsx: `<filter key={type} id={type}>`. So the contract
    // is exactly `url(#<enum value>)` — this is the assertion that catches an
    // enum rename, which TypeScript cannot.
    for (const type of ALL_TYPES) {
      if (type === ColorblindType.NONE) continue;
      expect(COLORBLIND_FILTER_IDS[type]).toBe(`url(#${type})`);
    }
  });

  it('gives NONE the CSS keyword rather than a filter reference', () => {
    // useColorblindMode assigns this straight into `style.filter`, where the
    // literal string `none` is what clears a filter. A `url(#none)` here would
    // point at a filter that is deliberately never rendered, and the page would
    // stay filtered.
    expect(COLORBLIND_FILTER_IDS[ColorblindType.NONE]).toBe('none');
  });

  it('is never empty, since the hook falls back to none and would mask a blank', () => {
    for (const type of ALL_TYPES) {
      expect(COLORBLIND_FILTER_IDS[type]).toBeTruthy();
    }
  });
});

describe('COLORBLIND_LABELS', () => {
  it('gives every type a distinct, human-readable label', () => {
    const labels = ALL_TYPES.map((t) => COLORBLIND_LABELS[t]);
    for (const label of labels) {
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/^[a-z]+$/); // not the raw enum value
    }
    // ColorblindToggle renders these as the accessible description of the
    // current mode; two identical labels would make two modes indistinguishable
    // to a screen reader.
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('defaults and storage', () => {
  it('defaults to no correction and no patterns', () => {
    expect(DEFAULT_COLORBLIND_SETTINGS).toEqual({
      mode: ColorblindType.NONE,
      patternsEnabled: false,
      simulationMode: false,
    });
  });

  it('pins the storage key, because changing it silently discards saved settings', () => {
    expect(COLORBLIND_STORAGE_KEY).toBe('colorblind-settings');
  });
});
