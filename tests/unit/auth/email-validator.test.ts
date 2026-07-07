/**
 * Unit Tests: Email Validator
 * These tests define the expected behavior - they will FAIL until implementation
 */

import { describe, it, expect } from 'vitest';
import { validateEmail, isValidEmail } from '@/lib/auth/email-validator';

describe('Email Validator', () => {
  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('123@test.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidEmail('a@b.io')).toBe(true); // Min valid
      expect(isValidEmail('user..name@example.com')).toBe(false); // Double dot
      expect(isValidEmail('user@example..com')).toBe(false); // Double dot in domain
    });
  });

  describe('validateEmail', () => {
    it('should return error for invalid email', () => {
      const result = validateEmail('notanemail');
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors[0]).toContain('Invalid email');
    });

    it('should return success for valid email', () => {
      const result = validateEmail('user@example.com');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should normalize email to lowercase', () => {
      const result = validateEmail('User@Example.COM');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('user@example.com');
    });
  });
});
