/**
 * Unit Tests: Rate Limiter
 * These tests define the expected behavior - they will FAIL until implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '@/lib/auth/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    rateLimiter = new RateLimiter('test', 5, 15); // 5 attempts per 15 min
  });

  it('should allow attempts under the limit', () => {
    expect(rateLimiter.isAllowed()).toBe(true);
    expect(rateLimiter.getRemainingAttempts()).toBe(5);

    rateLimiter.recordAttempt();
    expect(rateLimiter.isAllowed()).toBe(true);
    expect(rateLimiter.getRemainingAttempts()).toBe(4);
  });

  it('should block attempts after limit exceeded', () => {
    // Use up all attempts
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordAttempt();
    }

    expect(rateLimiter.isAllowed()).toBe(false);
    expect(rateLimiter.getRemainingAttempts()).toBe(0);
  });

  it('should return time until reset when blocked', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordAttempt();
    }

    const timeUntilReset = rateLimiter.getTimeUntilReset();
    expect(timeUntilReset).toBeGreaterThan(0);
    expect(timeUntilReset).toBeLessThanOrEqual(15 * 60 * 1000); // 15 min in ms
  });

  it('should reset after time window expires', () => {
    // Mock time to simulate 15 minutes passing
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // Use up attempts
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordAttempt();
    }

    expect(rateLimiter.isAllowed()).toBe(false);

    // Fast forward 16 minutes
    vi.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

    expect(rateLimiter.isAllowed()).toBe(true);
    expect(rateLimiter.getRemainingAttempts()).toBe(5);
  });

  it('should support different identifiers', () => {
    const limiter1 = new RateLimiter('user1', 5, 15);
    const limiter2 = new RateLimiter('user2', 5, 15);

    for (let i = 0; i < 5; i++) {
      limiter1.recordAttempt();
    }

    expect(limiter1.isAllowed()).toBe(false);
    expect(limiter2.isAllowed()).toBe(true); // Different identifier
  });

  it('should clear rate limit manually', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordAttempt();
    }

    expect(rateLimiter.isAllowed()).toBe(false);

    rateLimiter.clear();

    expect(rateLimiter.isAllowed()).toBe(true);
    expect(rateLimiter.getRemainingAttempts()).toBe(5);
  });
});
