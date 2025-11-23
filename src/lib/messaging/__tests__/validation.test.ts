/**
 * Unit tests for Validation Service
 * Tasks: T113 (isWithinEditWindow, isWithinDeleteWindow)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isWithinEditWindow,
  isWithinDeleteWindow,
  validateEmail,
  validateUsername,
  validateMessageContent,
  validateUUID,
  sanitizeInput,
} from '../validation';
import { ValidationError } from '@/types/messaging';

describe('Validation Service - Time Window Functions', () => {
  let originalDateNow: () => number;

  beforeEach(() => {
    // Save original Date.now
    originalDateNow = Date.now;
  });

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });

  describe('isWithinEditWindow', () => {
    it('should return true for message created 5 minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(isWithinEditWindow(fiveMinutesAgo)).toBe(true);
    });

    it('should return true for message created 14 minutes 59 seconds ago', () => {
      const almostFifteenMinutes = new Date(
        Date.now() - 14 * 60 * 1000 - 59 * 1000
      ).toISOString();
      expect(isWithinEditWindow(almostFifteenMinutes)).toBe(true);
    });

    it('should return true for message created exactly 15 minutes ago', () => {
      const exactlyFifteen = new Date(
        Date.now() - 15 * 60 * 1000
      ).toISOString();
      expect(isWithinEditWindow(exactlyFifteen)).toBe(true);
    });

    it('should return false for message created 16 minutes ago', () => {
      const sixteenMinutesAgo = new Date(
        Date.now() - 16 * 60 * 1000
      ).toISOString();
      expect(isWithinEditWindow(sixteenMinutesAgo)).toBe(false);
    });

    it('should return false for message created 1 hour ago', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(isWithinEditWindow(oneHourAgo)).toBe(false);
    });

    it('should return true for message created just now', () => {
      const justNow = new Date().toISOString();
      expect(isWithinEditWindow(justNow)).toBe(true);
    });

    it('should handle different date formats', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // ISO string format
      expect(isWithinEditWindow(fiveMinutesAgo.toISOString())).toBe(true);

      // UTC string format (also valid for Date constructor)
      expect(isWithinEditWindow(fiveMinutesAgo.toUTCString())).toBe(true);
    });

    it('should use current time for comparison', () => {
      // Mock Date constructor and Date.now to return a fixed timestamp
      const fixedNow = new Date('2025-01-01T12:00:00Z').getTime();

      // Save original Date constructor
      const OriginalDate = Date;

      // Override global Date
      global.Date = class extends OriginalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(fixedNow);
          } else if (args.length === 1) {
            super(args[0]);
          } else {
            super(
              args[0],
              args[1],
              args[2],
              args[3],
              args[4],
              args[5],
              args[6]
            );
          }
        }

        static override now() {
          return fixedNow;
        }
      } as any;

      // Message created at 11:50:00 (10 minutes ago)
      const tenMinutesAgo = new OriginalDate(
        '2025-01-01T11:50:00Z'
      ).toISOString();
      expect(isWithinEditWindow(tenMinutesAgo)).toBe(true);

      // Message created at 11:44:00 (16 minutes ago)
      const sixteenMinutesAgo = new OriginalDate(
        '2025-01-01T11:44:00Z'
      ).toISOString();
      expect(isWithinEditWindow(sixteenMinutesAgo)).toBe(false);

      // Restore original Date
      global.Date = OriginalDate;
    });
  });

  describe('isWithinDeleteWindow', () => {
    it('should return true for message created 5 minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(isWithinDeleteWindow(fiveMinutesAgo)).toBe(true);
    });

    it('should return true for message created 14 minutes 59 seconds ago', () => {
      const almostFifteenMinutes = new Date(
        Date.now() - 14 * 60 * 1000 - 59 * 1000
      ).toISOString();
      expect(isWithinDeleteWindow(almostFifteenMinutes)).toBe(true);
    });

    it('should return true for message created exactly 15 minutes ago', () => {
      const exactlyFifteen = new Date(
        Date.now() - 15 * 60 * 1000
      ).toISOString();
      expect(isWithinDeleteWindow(exactlyFifteen)).toBe(true);
    });

    it('should return false for message created 16 minutes ago', () => {
      const sixteenMinutesAgo = new Date(
        Date.now() - 16 * 60 * 1000
      ).toISOString();
      expect(isWithinDeleteWindow(sixteenMinutesAgo)).toBe(false);
    });

    it('should return false for message created 1 hour ago', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(isWithinDeleteWindow(oneHourAgo)).toBe(false);
    });

    it('should return true for message created just now', () => {
      const justNow = new Date().toISOString();
      expect(isWithinDeleteWindow(justNow)).toBe(true);
    });

    it('should have same behavior as isWithinEditWindow (both use 15-minute window)', () => {
      const testTimestamps = [
        new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        new Date().toISOString(),
      ];

      testTimestamps.forEach((timestamp) => {
        expect(isWithinEditWindow(timestamp)).toBe(
          isWithinDeleteWindow(timestamp)
        );
      });
    });
  });
});

describe('Validation Service - Existing Functions', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(() => validateEmail('user@example.com')).not.toThrow();
      expect(() => validateEmail('test.user@domain.co.uk')).not.toThrow();
      expect(() =>
        validateEmail('name+tag@subdomain.example.com')
      ).not.toThrow();
    });

    it('should reject invalid email addresses', () => {
      expect(() => validateEmail('notanemail')).toThrow(ValidationError);
      expect(() => validateEmail('@example.com')).toThrow(ValidationError);
      expect(() => validateEmail('user@')).toThrow(ValidationError);
      expect(() => validateEmail('')).toThrow(ValidationError);
    });

    it('should reject emails with invalid TLD', () => {
      expect(() => validateEmail('user@domain.c')).toThrow(ValidationError);
    });
  });

  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(() => validateUsername('user123')).not.toThrow();
      expect(() => validateUsername('test_user')).not.toThrow();
      expect(() => validateUsername('user-name')).not.toThrow();
    });

    it('should reject usernames that are too short', () => {
      expect(() => validateUsername('ab')).toThrow(ValidationError);
    });

    it('should reject usernames with invalid characters', () => {
      expect(() => validateUsername('user@name')).toThrow(ValidationError);
      expect(() => validateUsername('user name')).toThrow(ValidationError);
    });
  });

  describe('validateMessageContent', () => {
    it('should accept valid message content', () => {
      expect(() => validateMessageContent('Hello world')).not.toThrow();
      expect(() => validateMessageContent('A'.repeat(1000))).not.toThrow();
    });

    it('should reject empty messages', () => {
      expect(() => validateMessageContent('')).toThrow(ValidationError);
      expect(() => validateMessageContent('   ')).toThrow(ValidationError);
    });

    it('should reject messages exceeding max length', () => {
      expect(() => validateMessageContent('A'.repeat(10001))).toThrow(
        ValidationError
      );
    });
  });

  describe('validateUUID', () => {
    it('should accept valid UUIDs', () => {
      expect(() =>
        validateUUID('123e4567-e89b-12d3-a456-426614174000')
      ).not.toThrow();
    });

    it('should reject invalid UUIDs', () => {
      expect(() => validateUUID('not-a-uuid')).toThrow(ValidationError);
      expect(() => validateUUID('123456')).toThrow(ValidationError);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
        'scriptalert("xss")/script'
      );
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeInput('javascript:alert("xss")')).toBe('alert("xss")');
    });

    it('should remove inline event handlers', () => {
      expect(sanitizeInput('onclick=alert("xss")')).toBe('alert("xss")');
    });

    it('should limit string length to 1000 characters', () => {
      const longString = 'A'.repeat(1500);
      expect(sanitizeInput(longString).length).toBe(1000);
    });
  });
});
