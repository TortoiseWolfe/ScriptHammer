import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  usernameSchema,
  urlSchema,
  phoneSchema,
  playerNameSchema,
  gameConfigSchema,
  loginFormSchema,
  registrationFormSchema,
  safeParseWithErrors,
  validateField,
} from '../forms';

describe('Form Schemas', () => {
  describe('emailSchema', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'test+tag@example.org',
        'TEST@EXAMPLE.COM', // Should be lowercased
      ];

      validEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(email.toLowerCase().trim());
        }
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'not-an-email',
        '@example.com',
        'test@',
        'test @example.com',
        'test@.com',
      ];

      invalidEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('passwordSchema', () => {
    it('should validate strong passwords', () => {
      const validPasswords = [
        'Password1',
        'Test123Pass',
        'MyP@ssw0rd',
        'LongPasswordWith123',
      ];

      validPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const invalidPasswords = [
        'short1A', // Too short
        'password', // No uppercase or number
        'PASSWORD123', // No lowercase
        'Passworddd', // No number
        '12345678', // No letters
        'a'.repeat(101) + 'A1', // Too long
      ];

      invalidPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('usernameSchema', () => {
    it('should validate correct usernames', () => {
      const validUsernames = ['user', 'user_123', 'test-user', 'User123'];

      validUsernames.forEach((username) => {
        const result = usernameSchema.safeParse(username);
        expect(result.success).toBe(true);
      });

      // Test trimming separately
      const trimResult = usernameSchema.safeParse('trimmed');
      expect(trimResult.success).toBe(true);
      if (trimResult.success) {
        expect(trimResult.data).toBe('trimmed');
      }
    });

    it('should reject invalid usernames', () => {
      const invalidUsernames = [
        'ab', // Too short
        'a'.repeat(21), // Too long
        'user name', // Contains space
        'user@name', // Contains @
        'user.name', // Contains .
        'user!', // Contains special char
      ];

      invalidUsernames.forEach((username) => {
        const result = usernameSchema.safeParse(username);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('playerNameSchema', () => {
    it('should validate correct player names', () => {
      const validNames = [
        'Player',
        'Player 1',
        'Test_Player',
        'Player-123',
        '  Multiple   Spaces  ', // Should normalize spaces
      ];

      validNames.forEach((name) => {
        const result = playerNameSchema.safeParse(name);
        expect(result.success).toBe(true);
        if (result.success && name.includes('  ')) {
          expect(result.data).not.toContain('  ');
        }
      });
    });

    it('should reject invalid player names', () => {
      const invalidNames = [
        '', // Empty
        'a'.repeat(31), // Too long
        'Player@123', // Contains @
        'Player!', // Contains special char
        'Player#1', // Contains #
      ];

      invalidNames.forEach((name) => {
        const result = playerNameSchema.safeParse(name);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('gameConfigSchema', () => {
    it('should validate correct game configurations', () => {
      const validConfigs = [
        { playerCount: 1, gameMode: 'classic' },
        { playerCount: 4, gameMode: 'target', targetScore: 100 },
        { playerCount: 8, gameMode: 'timed', timeLimit: 300 },
      ];

      validConfigs.forEach((config) => {
        const result = gameConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid game configurations', () => {
      const invalidConfigs = [
        { playerCount: 0, gameMode: 'classic' }, // Too few players
        { playerCount: 9, gameMode: 'classic' }, // Too many players
        { playerCount: 4, gameMode: 'target', targetScore: 5 }, // Score too low
        { playerCount: 4, gameMode: 'timed', timeLimit: 30 }, // Time too short
      ];

      invalidConfigs.forEach((config) => {
        const result = gameConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('registrationFormSchema', () => {
    it('should validate matching passwords', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptTerms: true,
      };

      const result = registrationFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'DifferentPassword123',
        acceptTerms: true,
      };

      const result = registrationFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find(
          (issue) => issue.path[0] === 'confirmPassword'
        );
        expect(error?.message).toBe('Passwords do not match');
      }
    });

    it('should require accepting terms', () => {
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
        acceptTerms: false,
      };

      const result = registrationFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('safeParseWithErrors', () => {
    it('should return formatted errors', () => {
      const data = {
        email: 'invalid-email',
        password: '', // Empty password
      };

      const result = safeParseWithErrors(loginFormSchema, data);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.email).toBeDefined();
      expect(result.errors?.password).toBeDefined();
    });

    it('should return data on success', () => {
      const data = {
        email: 'test@example.com',
        password: 'password',
      };

      const result = safeParseWithErrors(loginFormSchema, data);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });
  });

  describe('validateField', () => {
    it('should validate a single field', () => {
      const validResult = validateField(emailSchema, 'test@example.com');
      expect(validResult.valid).toBe(true);
      expect(validResult.error).toBeUndefined();

      const invalidResult = validateField(emailSchema, 'not-an-email');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe('urlSchema', () => {
    it('should validate URLs and empty strings', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://subdomain.example.co.uk/path',
        '', // Empty string is allowed
        undefined, // Optional
      ];

      validUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = ['not-a-url', 'invalid'];

      invalidUrls.forEach((url) => {
        const result = urlSchema.safeParse(url);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('phoneSchema', () => {
    it('should validate phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '123-456-7890',
        '(123) 456-7890',
        undefined, // Optional
      ];

      validPhones.forEach((phone) => {
        const result = phoneSchema.safeParse(phone);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = ['not-a-phone', 'abc-def-ghij'];

      invalidPhones.forEach((phone) => {
        const result = phoneSchema.safeParse(phone);
        expect(result.success).toBe(false);
      });
    });
  });
});
