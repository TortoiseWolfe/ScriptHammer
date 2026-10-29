import { describe, it, expect } from 'vitest';
import { bookingNotes } from '@/lib/leads/booking-source';

describe('bookingNotes', () => {
  it('tags a booking that came from the band page', () => {
    expect(bookingNotes('band')).toBe('Band booking');
  });

  it('ignores a missing or unknown source', () => {
    expect(bookingNotes(undefined)).toBeUndefined();
    expect(bookingNotes(null)).toBeUndefined();
    expect(bookingNotes('')).toBeUndefined();
    expect(bookingNotes('something else')).toBeUndefined();
  });

  it('never echoes the address bar or an inherited property', () => {
    expect(bookingNotes('constructor')).toBeUndefined();
    expect(bookingNotes('toString')).toBeUndefined();
    expect(bookingNotes('<b>x</b>')).toBeUndefined();
  });
});
