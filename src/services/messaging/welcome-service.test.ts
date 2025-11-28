import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock implementations - use vi.hoisted to ensure they're defined before mocks
const mockFns = vi.hoisted(() => ({
  mockDeriveKeyPair: vi.fn(),
  mockGenerateSalt: vi.fn(),
  mockVerifyPublicKey: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockMessagingFrom: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: mockFns.mockSupabaseFrom,
  }),
}));

vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => ({
    from: mockFns.mockMessagingFrom,
  }),
}));

// Mock key derivation service
vi.mock('@/lib/messaging/key-derivation', () => ({
  KeyDerivationService: class MockKeyDerivationService {
    generateSalt() {
      return mockFns.mockGenerateSalt();
    }
    deriveKeyPair(params: unknown) {
      return mockFns.mockDeriveKeyPair(params);
    }
    verifyPublicKey(a: unknown, b: unknown) {
      return mockFns.mockVerifyPublicKey(a, b);
    }
  },
}));

// Mock encryption service
vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    deriveSharedSecret: vi.fn().mockResolvedValue({}),
    encryptMessage: vi.fn().mockResolvedValue({
      ciphertext: 'encrypted-content',
      iv: 'test-iv',
    }),
  },
}));

// Mock crypto.subtle
const mockImportKey = vi.fn().mockResolvedValue({});
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: mockImportKey,
    },
  },
});

// Import after mocks
import { WelcomeService, WELCOME_MESSAGE_CONTENT } from './welcome-service';

describe('WelcomeService', () => {
  let welcomeService: WelcomeService;
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testPublicKey: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: 'test-x',
    y: 'test-y',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment
    vi.stubEnv('TEST_USER_ADMIN_PASSWORD', 'test-admin-password-64chars');
    vi.stubEnv(
      'NEXT_PUBLIC_ADMIN_USER_ID',
      '00000000-0000-0000-0000-000000000001'
    );

    // Default mock responses
    mockFns.mockGenerateSalt.mockReturnValue(new Uint8Array(16));
    mockFns.mockDeriveKeyPair.mockResolvedValue({
      privateKey: {},
      publicKey: {},
      publicKeyJwk: { kty: 'EC', crv: 'P-256', x: 'admin-x', y: 'admin-y' },
      salt: 'base64-salt',
    });
    mockFns.mockVerifyPublicKey.mockReturnValue(true);

    // Create fresh instance
    welcomeService = new WelcomeService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('sendWelcomeMessage', () => {
    it('sends welcome message to new user', async () => {
      // Setup: User profile without welcome message sent
      mockFns.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { welcome_message_sent: false },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      // Setup: Messaging client mocks
      let insertCalled = false;
      mockFns.mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'user_encryption_keys') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            insert: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'conv-123' },
              error: null,
            }),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'messages') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            insert: vi.fn().mockImplementation(() => {
              insertCalled = true;
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: 'msg-123' },
                  error: null,
                }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await welcomeService.sendWelcomeMessage(
        testUserId,
        testPublicKey
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(insertCalled).toBe(true);
    });

    it('skips if welcome_message_sent is true', async () => {
      mockFns.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { welcome_message_sent: true },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await welcomeService.sendWelcomeMessage(
        testUserId,
        testPublicKey
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Welcome message already sent');
    });

    it('handles missing admin password gracefully', async () => {
      vi.stubEnv('TEST_USER_ADMIN_PASSWORD', '');

      const result = await welcomeService.sendWelcomeMessage(
        testUserId,
        testPublicKey
      );

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Admin password not configured');
    });
  });

  describe('initializeAdminKeys', () => {
    it('derives admin keys lazily on first send', async () => {
      // No existing keys
      mockFns.mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'user_encryption_keys') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            insert: vi.fn().mockReturnThis(),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const publicKey = await welcomeService.initializeAdminKeys();

      expect(publicKey).toBeDefined();
      expect(mockFns.mockDeriveKeyPair).toHaveBeenCalled();
      expect(mockFns.mockGenerateSalt).toHaveBeenCalled();
    });

    it('self-heals if admin keys corrupted', async () => {
      // Existing keys with mismatched public key
      mockFns.mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'user_encryption_keys') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                public_key: {
                  kty: 'EC',
                  crv: 'P-256',
                  x: 'wrong-x',
                  y: 'wrong-y',
                },
                encryption_salt: btoa('test-salt-bytes'),
              },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      // Verify returns false (corruption detected)
      mockFns.mockVerifyPublicKey.mockReturnValue(false);

      const publicKey = await welcomeService.initializeAdminKeys();

      expect(publicKey).toBeDefined();
      // Should have generated new salt after detecting corruption
      expect(mockFns.mockGenerateSalt).toHaveBeenCalled();
    });
  });

  describe('hasReceivedWelcome', () => {
    it('returns true if welcome_message_sent is true', async () => {
      mockFns.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { welcome_message_sent: true },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await welcomeService.hasReceivedWelcome(testUserId);

      expect(result).toBe(true);
    });

    it('returns false if welcome_message_sent is false', async () => {
      mockFns.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { welcome_message_sent: false },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await welcomeService.hasReceivedWelcome(testUserId);

      expect(result).toBe(false);
    });
  });

  describe('WELCOME_MESSAGE_CONTENT', () => {
    it('includes required content per FR-010', () => {
      // Must explain message privacy
      expect(WELCOME_MESSAGE_CONTENT).toContain('private');
      expect(WELCOME_MESSAGE_CONTENT).toContain('encryption');

      // Must explain password-derived keys
      expect(WELCOME_MESSAGE_CONTENT).toContain('password');
      expect(WELCOME_MESSAGE_CONTENT).toContain('key');

      // Must explain cross-device access
      expect(WELCOME_MESSAGE_CONTENT).toContain('any device');
    });

    it('uses layman terms (no jargon)', () => {
      // Should NOT contain technical jargon
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('ECDH');
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('AES-GCM');
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('Argon2');
      expect(WELCOME_MESSAGE_CONTENT).not.toContain('P-256');
    });
  });
});
