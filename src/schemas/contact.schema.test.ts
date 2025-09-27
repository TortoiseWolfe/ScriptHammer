import { describe, it, expect } from 'vitest';
import { contactSchema } from './contact.schema';

describe('Contact Schema', () => {
  describe('Validation', () => {
    it('should validate valid form data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with more than 10 characters',
      };

      const result = contactSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
        expect(result.data.email).toBe('john@example.com');
        expect(result.data.subject).toBe('Test Subject');
      }
    });

    it('should reject invalid name', () => {
      const invalidData = {
        name: 'J', // Too short
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'at least 2 characters'
        );
      }
    });

    it('should reject invalid email', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'invalid-email',
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid email');
      }
    });

    it('should reject short subject', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test', // Too short
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'at least 5 characters'
        );
      }
    });

    it('should reject short message', () => {
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Too short', // Less than 10 characters
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'at least 10 characters'
        );
      }
    });

    it('should reject names with invalid characters', () => {
      const invalidData = {
        name: 'John@123',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('invalid characters');
      }
    });

    it('should accept names with hyphens, apostrophes, and periods', () => {
      const validData = {
        name: "Jean-Pierre O'Connor Jr.",
        email: 'jean@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Transforms', () => {
    it('should trim whitespace from all fields', () => {
      const dataWithWhitespace = {
        name: '  John Doe  ',
        email: '  john@example.com  ',
        subject: '  Test Subject  ',
        message: '  This is a test message  ',
      };

      const result = contactSchema.safeParse(dataWithWhitespace);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
        expect(result.data.email).toBe('john@example.com');
        expect(result.data.subject).toBe('Test Subject');
        expect(result.data.message).toBe('This is a test message');
      }
    });

    it('should lowercase email addresses', () => {
      const dataWithUppercaseEmail = {
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(dataWithUppercaseEmail);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john@example.com');
      }
    });
  });

  describe('Honeypot Protection', () => {
    it('should accept empty honeypot field', () => {
      const dataWithEmptyHoneypot = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
        _gotcha: '',
      };

      const result = contactSchema.safeParse(dataWithEmptyHoneypot);
      expect(result.success).toBe(true);
    });

    it('should reject non-empty honeypot field', () => {
      const dataWithFilledHoneypot = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
        _gotcha: 'bot filled this',
      };

      const result = contactSchema.safeParse(dataWithFilledHoneypot);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Bot detected');
      }
    });

    it('should allow honeypot field to be optional', () => {
      const dataWithoutHoneypot = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(dataWithoutHoneypot);
      expect(result.success).toBe(true);
    });
  });

  describe('Field Length Limits', () => {
    it('should reject name longer than 100 characters', () => {
      const longName = 'A'.repeat(101);
      const invalidData = {
        name: longName,
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'less than 100 characters'
        );
      }
    });

    it('should reject email longer than 254 characters', () => {
      const longEmail = 'a'.repeat(243) + '@example.com'; // 255 total
      const invalidData = {
        name: 'John Doe',
        email: longEmail,
        subject: 'Test Subject',
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('too long');
      }
    });

    it('should reject subject longer than 200 characters', () => {
      const longSubject = 'A'.repeat(201);
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: longSubject,
        message: 'This is a test message',
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'less than 200 characters'
        );
      }
    });

    it('should reject message longer than 5000 characters', () => {
      const longMessage = 'A'.repeat(5001);
      const invalidData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: longMessage,
      };

      const result = contactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'less than 5000 characters'
        );
      }
    });
  });
});
