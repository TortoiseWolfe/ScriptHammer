/**
 * The consent gate on ad attribution.
 *
 * This is the file that decides whether a visitor who declined marketing cookies has an
 * advertising identifier held about them. FR-024a's recorded reasoning is that keeping
 * attribution for someone who declined "reads as routing around a stated preference" — so the
 * tests that matter here are the ones asserting that NOTHING is captured or returned without
 * consent, not the happy path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  captureOppref,
  readOppref,
  clearOppref,
  isValidOppref,
} from './ad-attribution';

const KEY = 'sh:ads:oppref';

function setUrl(href: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  });
}

describe('ad-attribution consent gate', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setUrl('https://scripthammer.com/?oppref=CLICK123');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('captures nothing when marketing consent is DENIED', () => {
    expect(captureOppref(false)).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('returns nothing when consent is denied, even if a value was stored earlier', () => {
    // Consent can be withdrawn after a value was captured. Withholding it on read means a
    // withdrawal takes effect immediately, without depending on clearOppref having run.
    captureOppref(true);
    expect(readOppref(true)).toBe('CLICK123');
    expect(readOppref(false)).toBeNull();
  });

  it('captures from the URL when consent is granted', () => {
    expect(captureOppref(true)).toBe('CLICK123');
    expect(window.sessionStorage.getItem(KEY)).toBe('CLICK123');
  });

  it('a later page without the parameter does not erase what was captured', () => {
    captureOppref(true);
    setUrl('https://scripthammer.com/checkout/?sku=prd-office-hours');
    // The buyer navigates on. The click that paid for them is still the same click.
    expect(captureOppref(true)).toBe('CLICK123');
  });

  it('clearOppref forgets the value', () => {
    captureOppref(true);
    clearOppref();
    expect(readOppref(true)).toBeNull();
  });

  it('survives sessionStorage throwing, which some privacy modes do', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    // Still returns the value for THIS page, so a conversion without a navigation still counts.
    expect(captureOppref(true)).toBe('CLICK123');
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readOppref(true)).toBeNull();
  });

  it('CONTROL: the gate can both allow and refuse, so the assertions above are not vacuous', () => {
    expect(captureOppref(true)).not.toBeNull();
    window.sessionStorage.clear();
    expect(captureOppref(false)).toBeNull();
  });
});

describe('isValidOppref', () => {
  it('accepts an opaque URL-safe token', () => {
    expect(isValidOppref('AbC-123_x.y~z')).toBe(true);
  });

  it('refuses anything that is not one', () => {
    // An unbounded query parameter must not become an unbounded write: create-order caps
    // serialised metadata at 1KB, and this is the first place that can enforce it.
    expect(isValidOppref('')).toBe(false);
    expect(isValidOppref(null)).toBe(false);
    expect(isValidOppref(undefined)).toBe(false);
    expect(isValidOppref('has space')).toBe(false);
    expect(isValidOppref('<script>')).toBe(false);
    expect(isValidOppref('a'.repeat(513))).toBe(false);
  });

  it('accepts exactly at the length limit, and refuses one past it', () => {
    expect(isValidOppref('a'.repeat(512))).toBe(true);
    expect(isValidOppref('a'.repeat(513))).toBe(false);
  });
});
