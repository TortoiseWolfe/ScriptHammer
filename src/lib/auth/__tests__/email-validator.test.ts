// Security Hardening: Email Validation Tests
// Feature 017 - Task T012
// Purpose: Test comprehensive email validation (MUST FAIL until implementation)

import { describe, it, expect } from 'vitest';
import { validateEmail, type EmailValidationResult } from '../email-validator';

describe('Email Validator - REQ-SEC-006', () => {
  describe('Valid Email Addresses', () => {
    it('should accept valid email with common TLD', () => {
      const result = validateEmail('user@example.com');

      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('user@example.com');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should normalize email to lowercase', () => {
      const result = validateEmail('User@EXAMPLE.COM');

      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('user@example.com');
    });

    it('should trim whitespace', () => {
      const result = validateEmail('  user@example.com  ');

      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('user@example.com');
    });

    it('should accept various valid TLDs', () => {
      const validEmails = [
        'user@example.com',
        'user@example.org',
        'user@example.net',
        'user@example.io',
        'user@example.co.uk',
        'user@example.edu',
        'user@example.gov',
      ];

      validEmails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
      });
    });

    it('should accept email with subdomain', () => {
      const result = validateEmail('user@mail.example.com');

      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('user@mail.example.com');
    });

    it('should accept email with plus addressing', () => {
      const result = validateEmail('user+tag@example.com');

      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('user+tag@example.com');
    });

    it('should accept email with dots in local part', () => {
      const result = validateEmail('first.last@example.com');

      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('first.last@example.com');
    });
  });

  describe('Invalid Email Addresses', () => {
    it('should reject email without TLD', () => {
      const result = validateEmail('user@localhost');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Invalid or missing top-level domain (TLD)'
      );
    });

    it('should reject email without @ symbol', () => {
      const result = validateEmail('userexample.com');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject email with consecutive dots', () => {
      const result = validateEmail('user..name@example.com');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email contains consecutive dots (..)');
    });

    it('should reject email starting with dot', () => {
      const result = validateEmail('.user@example.com');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject email ending with dot', () => {
      const result = validateEmail('user.@example.com');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject empty email', () => {
      const result = validateEmail('');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject email without local part', () => {
      const result = validateEmail('@example.com');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject email without domain', () => {
      const result = validateEmail('user@');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject email with spaces', () => {
      const result = validateEmail('user name@example.com');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject email with invalid characters', () => {
      const result = validateEmail('user#name@example.com');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Disposable Email Detection', () => {
    it('should warn about disposable email domains', () => {
      const disposableEmails = [
        'user@tempmail.com',
        'user@10minutemail.com',
        'user@guerrillamail.com',
        'user@mailinator.com',
      ];

      disposableEmails.forEach((email) => {
        const result = validateEmail(email);

        // Should be valid but with warning
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain(
          'Disposable email address detected - account recovery may be limited'
        );
      });
    });

    it('should not warn about legitimate email providers', () => {
      const legitimateEmails = [
        'user@gmail.com',
        'user@yahoo.com',
        'user@outlook.com',
        'user@protonmail.com',
      ];

      legitimateEmails.forEach((email) => {
        const result = validateEmail(email);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });
    });

    it('should allow sign-up with disposable email (just warn)', () => {
      const result = validateEmail('test@tempmail.com');

      // Valid=true means sign-up allowed
      expect(result.valid).toBe(true);
      // But warning present
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('TLD Validation', () => {
    it('should accept two-letter country code TLDs', () => {
      const emails = ['user@example.us', 'user@example.uk', 'user@example.de'];

      emails.forEach((email) => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
      });
    });

    it('should accept multi-part TLDs', () => {
      const result = validateEmail('user@example.co.uk');

      expect(result.valid).toBe(true);
    });

    it('should reject single-letter TLD', () => {
      const result = validateEmail('user@example.x');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Invalid or missing top-level domain (TLD)'
      );
    });

    it('should reject numeric TLD', () => {
      const result = validateEmail('user@example.123');

      expect(result.valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long email addresses', () => {
      const longLocal = 'a'.repeat(64);
      const result = validateEmail(`${longLocal}@example.com`);

      // Should validate length limits
      expect(result).toBeDefined();
    });

    it('should handle international characters', () => {
      const result = validateEmail('用户@example.com');

      // May or may not be valid depending on implementation
      expect(result).toBeDefined();
    });

    it('should handle email with multiple @ symbols', () => {
      const result = validateEmail('user@@example.com');

      expect(result.valid).toBe(false);
    });
  });

  describe('Security Requirements', () => {
    it('should normalize for database consistency', () => {
      const result1 = validateEmail('User@Example.COM');
      const result2 = validateEmail('user@example.com');

      // Both should normalize to same value
      expect(result1.normalized).toBe(result2.normalized);
    });

    it('should provide clear error messages for users', () => {
      const result = validateEmail('invalid');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/email|address|invalid/i);
    });

    it('should return structured validation result', () => {
      const result = validateEmail('test@example.com');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('normalized');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });
});
