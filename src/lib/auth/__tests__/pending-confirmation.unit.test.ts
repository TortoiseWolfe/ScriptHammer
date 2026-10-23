import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setPendingConfirmationEmail,
  getPendingConfirmationEmail,
  clearPendingConfirmationEmail,
} from '../pending-confirmation';

describe('pending confirmation address (#1352)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('is null when nothing was carried', () => {
    expect(getPendingConfirmationEmail()).toBeNull();
  });

  it('round-trips the address, trimmed', () => {
    setPendingConfirmationEmail('  someone@example.com ');
    expect(getPendingConfirmationEmail()).toBe('someone@example.com');
  });

  it('lives in sessionStorage only, never localStorage', () => {
    setPendingConfirmationEmail('someone@example.com');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(1);
  });

  it('clears', () => {
    setPendingConfirmationEmail('someone@example.com');
    clearPendingConfirmationEmail();
    expect(getPendingConfirmationEmail()).toBeNull();
  });

  it('survives storage that throws, on every method', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => setPendingConfirmationEmail('a@example.com')).not.toThrow();
    expect(getPendingConfirmationEmail()).toBeNull();
    expect(() => clearPendingConfirmationEmail()).not.toThrow();
  });
});
