import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from '../../supabase/functions/_shared/timing-safe-equal';

describe('timingSafeEqual (#1260)', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('hello', 'hello')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqual('hello', 'world')).toBe(false);
  });

  it('returns false for different strings of different lengths', () => {
    expect(timingSafeEqual('hello', 'helloo')).toBe(false);
    expect(timingSafeEqual('helloo', 'hello')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('returns false when one string is empty', () => {
    expect(timingSafeEqual('a', '')).toBe(false);
    expect(timingSafeEqual('', 'a')).toBe(false);
  });

  it('handles multibyte input correctly', () => {
    // 🍕 is F0 9F 8D 95 in UTF-8 (4 bytes)
    // 🍔 is F0 9F 8D 94 in UTF-8 (4 bytes)
    expect(timingSafeEqual('🍕', '🍕')).toBe(true);
    expect(timingSafeEqual('🍕', '🍔')).toBe(false);
    expect(timingSafeEqual('🍕', '🍕🍕')).toBe(false);
  });

  it('handles strings with common prefixes but different lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('abcd', 'abc')).toBe(false);
  });

  it('handles strings with common suffixes but different lengths', () => {
    expect(timingSafeEqual('bcd', 'abcd')).toBe(false);
    expect(timingSafeEqual('abcd', 'bcd')).toBe(false);
  });

  it('handles null bytes correctly', () => {
    expect(timingSafeEqual('a\0b', 'a\0b')).toBe(true);
    expect(timingSafeEqual('a\0b', 'a\0c')).toBe(false);
    expect(timingSafeEqual('a\0b', 'ab')).toBe(false);
  });
});
