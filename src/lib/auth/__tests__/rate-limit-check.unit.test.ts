// Security Hardening: Rate Limiting Unit Tests
// Feature 017 - Task T009 (Refactored for proper unit testing)
// Purpose: Test rate limiting business logic without database dependency

import { describe, it, expect, vi } from 'vitest';
import { formatLockoutTime } from '../rate-limit-check';

describe('Rate Limiting - Unit Tests', () => {
  describe('formatLockoutTime', () => {
    it('should format time remaining correctly', () => {
      const oneMinute = new Date(Date.now() + 60 * 1000).toISOString();
      expect(formatLockoutTime(oneMinute)).toBe('1 minute');

      const fiveMinutes = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      expect(formatLockoutTime(fiveMinutes)).toBe('5 minutes');

      const fifteenMinutes = new Date(
        Date.now() + 15 * 60 * 1000
      ).toISOString();
      expect(formatLockoutTime(fifteenMinutes)).toBe('15 minutes');
    });

    it('should return "shortly" for expired locks', () => {
      const pastTime = new Date(Date.now() - 1000).toISOString();
      expect(formatLockoutTime(pastTime)).toBe('shortly');
    });

    it('should handle fractional minutes correctly', () => {
      const thirtySeconds = new Date(Date.now() + 30 * 1000).toISOString();
      expect(formatLockoutTime(thirtySeconds)).toBe('1 minute'); // Rounds up

      const ninetySeconds = new Date(Date.now() + 90 * 1000).toISOString();
      expect(formatLockoutTime(ninetySeconds)).toBe('2 minutes'); // Rounds up
    });
  });
});
