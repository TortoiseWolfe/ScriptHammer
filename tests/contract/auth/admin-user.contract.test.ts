/**
 * Contract Test: Admin User Configuration (Feature 002)
 *
 * Tests that the admin user (ScriptHammer) is properly configured for
 * sending welcome messages to new users.
 *
 * Admin user properties:
 * - Fixed UUID: 00000000-0000-0000-0000-000000000001
 * - Email: admin@scripthammer.com (configurable via env)
 * - Password: Set via TEST_USER_ADMIN_PASSWORD env
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  TEST_EMAIL_ADMIN,
  TEST_PASSWORD_ADMIN,
  ADMIN_USER_ID,
  hasAdminUser,
} from '../../fixtures/test-user';

describe('Admin User Configuration Contract', () => {
  describe('Environment Configuration', () => {
    it('should have admin user ID configured', () => {
      expect(ADMIN_USER_ID).toBeDefined();
      expect(ADMIN_USER_ID).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('should have admin email configured', () => {
      expect(TEST_EMAIL_ADMIN).toBeDefined();
      expect(TEST_EMAIL_ADMIN).toContain('@');
    });

    it('should have hasAdminUser helper', () => {
      const result = hasAdminUser();
      // Result depends on env, but function should work
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Admin UUID Format', () => {
    it('should be valid UUID format', () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(ADMIN_USER_ID).toMatch(uuidRegex);
    });

    it('should be fixed sentinel value', () => {
      // Admin UUID should always be the same for consistency
      expect(ADMIN_USER_ID).toBe('00000000-0000-0000-0000-000000000001');
    });
  });

  describe('Admin Password Configuration', () => {
    it.skipIf(!hasAdminUser())(
      'should have admin password configured when available',
      () => {
        expect(TEST_PASSWORD_ADMIN).toBeDefined();
        expect(TEST_PASSWORD_ADMIN!.length).toBeGreaterThanOrEqual(8);
      }
    );

    it('should gracefully handle missing admin password', () => {
      // hasAdminUser() should return false if password not set
      if (!TEST_PASSWORD_ADMIN) {
        expect(hasAdminUser()).toBe(false);
      }
    });
  });

  describe('Admin Email Validation', () => {
    it('should have valid email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(TEST_EMAIL_ADMIN).toMatch(emailRegex);
    });

    it('should use default email if not configured', () => {
      // Default is admin@scripthammer.com if env not set
      if (!process.env.TEST_USER_ADMIN_EMAIL) {
        expect(TEST_EMAIL_ADMIN).toBe('admin@scripthammer.com');
      }
    });
  });
});

describe('Admin WelcomeService Integration', () => {
  describe('WELCOME_MESSAGE_CONTENT', () => {
    it('should export welcome message content', async () => {
      const { WELCOME_MESSAGE_CONTENT } = await import(
        '@/services/messaging/welcome-service'
      );
      expect(WELCOME_MESSAGE_CONTENT).toBeDefined();
      expect(typeof WELCOME_MESSAGE_CONTENT).toBe('string');
    });

    it('should include required content per FR-010', async () => {
      const { WELCOME_MESSAGE_CONTENT } = await import(
        '@/services/messaging/welcome-service'
      );

      // Privacy explanation
      expect(WELCOME_MESSAGE_CONTENT.toLowerCase()).toContain('private');

      // Key derivation explanation
      expect(WELCOME_MESSAGE_CONTENT.toLowerCase()).toContain('password');
      expect(WELCOME_MESSAGE_CONTENT.toLowerCase()).toContain('key');

      // Cross-device access
      expect(WELCOME_MESSAGE_CONTENT.toLowerCase()).toContain('device');
    });

    it('should be in layman terms (no crypto jargon)', async () => {
      const { WELCOME_MESSAGE_CONTENT } = await import(
        '@/services/messaging/welcome-service'
      );

      // Should NOT contain technical jargon
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('ECDH');
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('AES-GCM');
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('Argon2');
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('P-256');
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('SHA');
    });
  });

  describe('WelcomeService class', () => {
    it('should export WelcomeService class', async () => {
      const { WelcomeService } = await import(
        '@/services/messaging/welcome-service'
      );
      expect(WelcomeService).toBeDefined();
    });

    it('should export welcomeService singleton', async () => {
      const { welcomeService } = await import(
        '@/services/messaging/welcome-service'
      );
      expect(welcomeService).toBeDefined();
    });

    it('should have sendWelcomeMessage method', async () => {
      const { welcomeService } = await import(
        '@/services/messaging/welcome-service'
      );
      expect(typeof welcomeService.sendWelcomeMessage).toBe('function');
    });

    it('should have hasReceivedWelcome method', async () => {
      const { welcomeService } = await import(
        '@/services/messaging/welcome-service'
      );
      expect(typeof welcomeService.hasReceivedWelcome).toBe('function');
    });

    it('should have initializeAdminKeys method', async () => {
      const { welcomeService } = await import(
        '@/services/messaging/welcome-service'
      );
      expect(typeof welcomeService.initializeAdminKeys).toBe('function');
    });
  });
});
