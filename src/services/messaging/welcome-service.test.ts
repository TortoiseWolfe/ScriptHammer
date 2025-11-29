import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock implementations - use vi.hoisted to ensure they're defined before mocks
const mockFns = vi.hoisted(() => ({
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
import {
  WelcomeService,
  WELCOME_MESSAGE_CONTENT,
  ADMIN_USER_ID,
} from './welcome-service';

describe('WelcomeService', () => {
  let welcomeService: WelcomeService;
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const testPublicKey: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: 'test-x',
    y: 'test-y',
  };
  const mockPrivateKey = {} as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    welcomeService = new WelcomeService();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('ADMIN_USER_ID', () => {
    it('is fixed UUID for admin', () => {
      expect(ADMIN_USER_ID).toBe('00000000-0000-0000-0000-000000000001');
    });
  });

  describe('getAdminPublicKey', () => {
    it('returns valid JWK when admin key exists (T010)', async () => {
      const adminPublicKey = {
        kty: 'EC',
        crv: 'P-256',
        x: 'admin-x',
        y: 'admin-y',
      };

      mockFns.mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'user_encryption_keys') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { public_key: adminPublicKey },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await welcomeService.getAdminPublicKey();

      expect(result).toEqual(adminPublicKey);
    });

    it('throws when admin key missing (T011)', async () => {
      mockFns.mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'user_encryption_keys') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      await expect(welcomeService.getAdminPublicKey()).rejects.toThrow(
        'Admin public key not found'
      );
    });
  });

  describe('sendWelcomeMessage', () => {
    it('sends welcome message with new signature (T012)', async () => {
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
            single: vi.fn().mockResolvedValue({
              data: {
                public_key: {
                  kty: 'EC',
                  crv: 'P-256',
                  x: 'admin-x',
                  y: 'admin-y',
                },
              },
              error: null,
            }),
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
        mockPrivateKey,
        testPublicKey
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(insertCalled).toBe(true);
    });

    it('derives shared secret using ECDH(userPrivate, adminPublic) (T013)', async () => {
      // Import the mocked encryptionService
      const { encryptionService } = await import('@/lib/messaging/encryption');

      // Setup mocks
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

      mockFns.mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'user_encryption_keys') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                public_key: {
                  kty: 'EC',
                  crv: 'P-256',
                  x: 'admin-x',
                  y: 'admin-y',
                },
              },
              error: null,
            }),
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
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'msg-123' },
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      await welcomeService.sendWelcomeMessage(
        testUserId,
        mockPrivateKey,
        testPublicKey
      );

      // Verify deriveSharedSecret was called with userPrivateKey
      expect(encryptionService.deriveSharedSecret).toHaveBeenCalledWith(
        mockPrivateKey,
        expect.anything() // The imported admin public key
      );
    });

    it('skips if welcome_message_sent is true (T021)', async () => {
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
        mockPrivateKey,
        testPublicKey
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Welcome message already sent');
    });

    it('returns skipped when admin key missing (T026)', async () => {
      // Profile check succeeds
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

      // Admin key not found
      mockFns.mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'user_encryption_keys') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const result = await welcomeService.sendWelcomeMessage(
        testUserId,
        mockPrivateKey,
        testPublicKey
      );

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Admin public key not found');
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
