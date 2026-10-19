/**
 * getStorageErrorMessage is pure, but its sibling validation.test.ts is excluded
 * from the vitest run (vitest.config.ts: createImageBitmap needs a real
 * browser), so a test added there would never execute. Network-failure
 * mapping lives here, where it does.
 */
import { describe, it, expect } from 'vitest';
import { getStorageErrorMessage } from '../validation';

describe('getStorageErrorMessage - network failures', () => {
  it("maps Chromium's 'Failed to fetch' to the network message", () => {
    const message = getStorageErrorMessage(new TypeError('Failed to fetch'));

    expect(message).toMatch(/^Network error/);
  });

  it("maps WebKit's 'Load failed' to the network message", () => {
    const message = getStorageErrorMessage(new TypeError('Load failed'));

    expect(message).toMatch(/^Network error/);
  });
});
