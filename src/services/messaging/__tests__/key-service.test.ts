/**
 * Unit Test: KeyManagementService
 *
 * Tests KeyManagementService methods with fully mocked dependencies:
 * Supabase client, messaging client, encryption service, key-derivation
 * service, IndexedDB (Dexie) table, and crypto.subtle. No network, no real
 * crypto, no real IndexedDB — fast, deterministic unit tests.
 *
 * The service exports a class (KeyManagementService) plus a module-level
 * singleton (keyManagementService). The singleton carries in-memory state
 * (derivedKeys + publicKeyCache); we clear it in beforeEach via clearKeys()
 * / clearPublicKeyCache() so tests don't pollute each other.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Valid test UUIDs
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';

// ---------------------------------------------------------------------------
// Supabase client mock (auth lives here)
// ---------------------------------------------------------------------------
const mockSupabase = {
  from: vi.fn(),
  // #1040: the salt is no longer selectable off the table by `authenticated`, so
  // own-row reads go through the get_own_encryption_key() RPC. These tests mock
  // the RPC for exactly the paths that read a salt; every other path still reads
  // the table and still mocks `from`.
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
} as unknown as SupabaseClient;

/**
 * What get_own_encryption_key() returns, with sane defaults per field.
 *
 * Shaped as a full PostgrestSingleResponse (count/status/statusText included)
 * because `supabase.rpc` is typed to return one, and vitest does not type-check —
 * so a half-shaped fixture passes here and fails `pnpm run type-check` later.
 */
function ownKey(over: Record<string, unknown> = {}) {
  return {
    data: {
      key_id: 'k1',
      public_key: null,
      encryption_salt: null,
      created_at: '2026-01-01T00:00:00Z',
      active_key_count: 0,
      salted_key_count: 0,
      ...over,
    },
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
  };
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// ---------------------------------------------------------------------------
// Messaging client mock (all user_encryption_keys table access)
// ---------------------------------------------------------------------------
const mockMessagingFrom = vi.fn();

vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => ({
    from: mockMessagingFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Encryption service mock (IndexedDB private-key persistence)
// ---------------------------------------------------------------------------
const mockStorePrivateKey = vi.fn().mockResolvedValue(undefined);
const mockGetPrivateKey = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    storePrivateKey: (userId: string, key: CryptoKey) =>
      mockStorePrivateKey(userId, key),
    getPrivateKey: (userId: string) => mockGetPrivateKey(userId),
  },
}));

// ---------------------------------------------------------------------------
// Key-derivation service mock (Argon2id + ECDH). The service instantiates
// `new KeyDerivationService()`, so mock the class to return controllable
// instance methods.
// ---------------------------------------------------------------------------
const mockGenerateSalt = vi.fn();
const mockDeriveKeyPair = vi.fn();
const mockVerifyPublicKey = vi.fn();

vi.mock('@/lib/messaging/key-derivation', () => ({
  KeyDerivationService: class {
    generateSalt = mockGenerateSalt;
    deriveKeyPair = mockDeriveKeyPair;
    verifyPublicKey = mockVerifyPublicKey;
  },
}));

// ---------------------------------------------------------------------------
// Dexie database mock (clearKeys fire-and-forget IndexedDB wipe)
// ---------------------------------------------------------------------------
const mockPrivateKeysClear = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/messaging/database', () => ({
  db: {
    messaging_private_keys: {
      clear: mockPrivateKeysClear,
    },
  },
}));

// ---------------------------------------------------------------------------
// crypto.subtle.importKey stub (restoreKeysFromCache imports the public JWK)
// ---------------------------------------------------------------------------
const mockImportKey = vi.fn().mockResolvedValue({} as CryptoKey);
vi.stubGlobal('crypto', {
  subtle: {
    importKey: mockImportKey,
  },
});

// Mock query builder (matches connection-service.test.ts pattern)
const createMockQueryBuilder = (data: any = null, error: any = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  then: vi.fn((resolve) => resolve({ data, error })),
});

// Reusable fake derived key pair + JWKs
const PUBLIC_JWK: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'derived-x',
  y: 'derived-y',
};
const fakeKeyPair = {
  privateKey: {} as CryptoKey,
  publicKey: {} as CryptoKey,
  publicKeyJwk: PUBLIC_JWK,
  salt: 'base64salt',
};

// navigator.onLine helper
const setOnline = (online: boolean) => {
  Object.defineProperty(global, 'navigator', {
    value: { onLine: online },
    configurable: true,
  });
};

// Import after mocks are set up
const { keyManagementService, KeyManagementService } = await import(
  '../key-service'
);

describe('KeyManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear singleton in-memory state between tests.
    keyManagementService.clearKeys();
    keyManagementService.clearPublicKeyCache();

    // Default: authenticated user via BOTH getSession + getUser.
    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: CURRENT_USER_ID } } },
      error: null,
    } as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    } as any);

    // Default key-derivation behavior: succeed + verify true.
    mockGenerateSalt.mockReturnValue(new Uint8Array([1, 2, 3, 4]));
    mockDeriveKeyPair.mockResolvedValue(fakeKeyPair);
    mockVerifyPublicKey.mockReturnValue(true);

    // Default: persistence + restore stubs
    mockStorePrivateKey.mockResolvedValue(undefined);
    mockGetPrivateKey.mockResolvedValue(null);
    mockImportKey.mockResolvedValue({} as CryptoKey);

    // Default: online (so getUserPublicKey hits DB unless overridden).
    setOnline(true);
  });

  describe('singleton export', () => {
    it('exposes a singleton instance of KeyManagementService', () => {
      expect(keyManagementService).toBeInstanceOf(KeyManagementService);
    });
  });

  describe('initializeKeys', () => {
    it('derives, uploads, and stores keys for a new user', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      const result = await keyManagementService.initializeKeys('password');

      expect(result).toEqual(fakeKeyPair);
      expect(mockDeriveKeyPair).toHaveBeenCalled();
      expect(mockStorePrivateKey).toHaveBeenCalledWith(
        CURRENT_USER_ID,
        fakeKeyPair.privateKey
      );
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        keyManagementService.initializeKeys('password')
      ).rejects.toThrow('You must be signed in to initialize encryption keys');
    });

    it('throws ConnectionError when the upload fails', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { message: 'insert failed' })
      );

      await expect(
        keyManagementService.initializeKeys('password')
      ).rejects.toThrow('Failed to upload public key: insert failed');
    });
  });

  describe('deriveKeys', () => {
    it('derives keys and verifies the stored public key (happy path)', async () => {
      vi.mocked(mockSupabase.rpc).mockResolvedValue(
        ownKey({
          encryption_salt: 'YWJjZA==',
          public_key: PUBLIC_JWK,
          active_key_count: 1,
          salted_key_count: 1,
        })
      );

      const result = await keyManagementService.deriveKeys('password');

      expect(result).toEqual(fakeKeyPair);
      expect(mockVerifyPublicKey).toHaveBeenCalled();
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });

    it('throws KeyMismatchError when password is wrong (verifyPublicKey false)', async () => {
      mockVerifyPublicKey.mockReturnValue(false);
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          { encryption_salt: 'YWJjZA==', public_key: PUBLIC_JWK },
          null
        )
      );

      await expect(keyManagementService.deriveKeys('wrong')).rejects.toThrow(
        "Incorrect password. The encryption key doesn't match. Please try again."
      );
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.deriveKeys('password')).rejects.toThrow(
        'You must be signed in to derive encryption keys'
      );
    });

    it('throws KeyDerivationError when no salt exists for the user', async () => {
      // The accessor answers, but the row carries no salt — a legacy key. This
      // must still be KeyDerivationError and NOT a connection error, because the
      // UI distinguishes "needs migration" from "database is unreachable".
      vi.mocked(mockSupabase.rpc).mockResolvedValue(
        ownKey({ active_key_count: 1, salted_key_count: 0 })
      );

      await expect(keyManagementService.deriveKeys('password')).rejects.toThrow(
        'No salt found. User may need migration or initialization.'
      );
    });
  });

  describe('getCurrentKeys', () => {
    it('returns null when no keys are in memory', () => {
      expect(keyManagementService.getCurrentKeys()).toBeNull();
    });

    it('returns the in-memory key pair after initializeKeys', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });
  });

  describe('restoreKeysFromCache', () => {
    it('returns true immediately when keys already in memory', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(true);
      // Should not have queried IndexedDB since memory was populated.
      expect(mockGetPrivateKey).not.toHaveBeenCalled();
    });

    it('returns false when no userId is provided', async () => {
      const result = await keyManagementService.restoreKeysFromCache();
      expect(result).toBe(false);
    });

    it('returns false when no private key exists in IndexedDB', async () => {
      mockGetPrivateKey.mockResolvedValue(null);

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(false);
    });

    it('rebuilds the key pair from IndexedDB + Supabase (happy path)', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      vi.mocked(mockSupabase.rpc).mockResolvedValue(
        ownKey({
          encryption_salt: 'base64salt',
          public_key: PUBLIC_JWK,
          active_key_count: 1,
          salted_key_count: 1,
        })
      );

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(true);
      expect(mockImportKey).toHaveBeenCalled();
      expect(keyManagementService.getCurrentKeys()).toMatchObject({
        publicKeyJwk: PUBLIC_JWK,
        salt: 'base64salt',
      });
    });

    it('returns false when private key exists but Supabase has no public key/salt', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      // The accessor answers with an empty row: no keys, so no salt and no public
      // key. false, not a throw -- this path has a real fallback (re-derive from
      // the password), so a failure costs a prompt rather than a keypair.
      vi.mocked(mockSupabase.rpc).mockResolvedValue(ownKey());

      const result =
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID);

      expect(result).toBe(false);
    });

    it('returns false, never throws, when the accessor itself fails (#1040)', async () => {
      // If the RPC is missing -- the migration edited but never executed, the
      // #1038 shape -- this path must still degrade to "re-derive from password"
      // rather than propagating. deriveKeys() is the path that must throw
      // instead, and it is asserted separately, because there a silent empty
      // answer would let the UI offer to re-initialize and orphan every existing
      // message.
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);
      vi.mocked(mockSupabase.rpc).mockResolvedValue({
        data: null,
        error: {
          message: 'function get_own_encryption_key() does not exist',
          details: '',
          hint: '',
          code: '42883',
          name: 'PostgrestError',
        },
        count: null,
        status: 404,
        statusText: 'Not Found',
      });

      expect(
        await keyManagementService.restoreKeysFromCache(CURRENT_USER_ID)
      ).toBe(false);
    });

    it('deriveKeys THROWS when the accessor fails, rather than reporting no keys (#1040)', async () => {
      // The asymmetry above, pinned from the other side. A missing salt here
      // degrades to "no keys yet"; the UI reads that as a new user and offers to
      // initialize; initializing OVERWRITES the keypair and permanently orphans
      // every message encrypted to the old one. So this path must surface the
      // error.
      vi.mocked(mockSupabase.rpc).mockResolvedValue({
        data: null,
        error: {
          message: 'function get_own_encryption_key() does not exist',
          details: '',
          hint: '',
          code: '42883',
          name: 'PostgrestError',
        },
        count: null,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(keyManagementService.deriveKeys('password')).rejects.toThrow(
        /Failed to read own encryption key/
      );
    });
  });

  describe('clearKeys', () => {
    it('clears in-memory keys and wipes the IndexedDB table', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');
      expect(keyManagementService.getCurrentKeys()).not.toBeNull();

      keyManagementService.clearKeys();

      expect(keyManagementService.getCurrentKeys()).toBeNull();
      expect(mockPrivateKeysClear).toHaveBeenCalled();
    });
  });

  describe('needsMigration', () => {
    it('returns false when user is not authenticated', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      expect(await keyManagementService.needsMigration()).toBe(false);
    });

    it('returns false when user has at least one key with a valid salt', async () => {
      // First query (valid keys with salt) returns a row.
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([{ id: 'k1' }], null)
      );

      expect(await keyManagementService.needsMigration()).toBe(false);
    });

    it('returns true when user has keys but none have a salt (legacy)', async () => {
      // ONE round trip now (#1040): the accessor returns both counts, so the
      // two-query dance -- and its ordering-dependent mock -- is gone. Has keys,
      // none salted => legacy => needs migration.
      vi.mocked(mockSupabase.rpc).mockResolvedValue(
        ownKey({ active_key_count: 1, salted_key_count: 0 })
      );

      expect(await keyManagementService.needsMigration()).toBe(true);
    });
  });

  describe('hasKeysForUser', () => {
    it('returns true when a non-revoked key row exists', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ id: 'k1' }, null)
      );

      expect(await keyManagementService.hasKeysForUser(OTHER_USER_ID)).toBe(
        true
      );
    });

    it('returns false when no key row exists', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      expect(await keyManagementService.hasKeysForUser(OTHER_USER_ID)).toBe(
        false
      );
    });

    it('throws ConnectionError on a non-PGRST116 database error', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: '500', message: 'boom' })
      );

      await expect(
        keyManagementService.hasKeysForUser(OTHER_USER_ID)
      ).rejects.toThrow('Failed to check encryption keys: boom');
    });
  });

  describe('hasKeys', () => {
    it('returns true when the authenticated user has a key row', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ id: 'k1' }, null)
      );

      expect(await keyManagementService.hasKeys()).toBe(true);
    });

    it('returns false when not authenticated', async () => {
      vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Not authenticated' },
      } as any);

      expect(await keyManagementService.hasKeys()).toBe(false);
    });

    it('throws ConnectionError on a real database error', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: '500', message: 'db down' })
      );

      await expect(keyManagementService.hasKeys()).rejects.toThrow(
        'Failed to check encryption keys: db down'
      );
    });
  });

  describe('hasValidKeys', () => {
    it('returns true when keys are in memory (no DB hit)', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));
      await keyManagementService.initializeKeys('password');

      mockGetPrivateKey.mockClear();
      expect(await keyManagementService.hasValidKeys()).toBe(true);
      expect(mockGetPrivateKey).not.toHaveBeenCalled();
    });

    it('falls back to IndexedDB and returns true when a private key exists', async () => {
      mockGetPrivateKey.mockResolvedValue({} as CryptoKey);

      expect(await keyManagementService.hasValidKeys()).toBe(true);
      expect(mockGetPrivateKey).toHaveBeenCalledWith(CURRENT_USER_ID);
    });

    it('throws AuthenticationError when not signed in and no memory keys', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.hasValidKeys()).rejects.toThrow(
        'You must be signed in to check encryption keys'
      );
    });
  });

  describe('rotateKeys', () => {
    it('revokes old keys, derives + uploads new ones (happy path)', async () => {
      // Both update (revoke) and insert (upload) resolve with no error.
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      const result = await keyManagementService.rotateKeys('password');

      expect(result).toBe(true);
      expect(mockDeriveKeyPair).toHaveBeenCalled();
      expect(mockStorePrivateKey).toHaveBeenCalledWith(
        CURRENT_USER_ID,
        fakeKeyPair.privateKey
      );
      expect(keyManagementService.getCurrentKeys()).toEqual(fakeKeyPair);
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.rotateKeys('password')).rejects.toThrow(
        'You must be signed in to rotate encryption keys'
      );
    });

    it('throws ConnectionError when revoking old keys fails', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { message: 'revoke failed' })
      );

      await expect(keyManagementService.rotateKeys('password')).rejects.toThrow(
        'Failed to revoke old keys: revoke failed'
      );
    });
  });

  describe('revokeKeys', () => {
    it('marks all keys revoked when authenticated', async () => {
      mockMessagingFrom.mockReturnValue(createMockQueryBuilder(null, null));

      await expect(keyManagementService.revokeKeys()).resolves.toBeUndefined();
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(keyManagementService.revokeKeys()).rejects.toThrow(
        'You must be signed in to revoke encryption keys'
      );
    });

    it('throws ConnectionError when the revoke update fails', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { message: 'update failed' })
      );

      await expect(keyManagementService.revokeKeys()).rejects.toThrow(
        'Failed to revoke keys: update failed'
      );
    });
  });

  describe('getUserPublicKey', () => {
    it('fetches the public key from the database when online', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ public_key: PUBLIC_JWK }, null)
      );

      const result = await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      expect(result).toEqual(PUBLIC_JWK);
    });

    it('returns null when no key row exists (PGRST116)', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'no rows' })
      );

      expect(
        await keyManagementService.getUserPublicKey(OTHER_USER_ID)
      ).toBeNull();
    });

    it('throws ConnectionError on a real query error', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: '500', message: 'query boom' })
      );

      await expect(
        keyManagementService.getUserPublicKey(OTHER_USER_ID)
      ).rejects.toThrow('Failed to get user public key: query boom');
    });

    it('returns the cached key when offline (offline-cache branch)', async () => {
      // First, populate the cache via an online fetch.
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ public_key: PUBLIC_JWK }, null)
      );
      await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      // Now go offline and clear DB mocks — must serve from cache.
      setOnline(false);
      mockMessagingFrom.mockClear();

      const result = await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      expect(result).toEqual(PUBLIC_JWK);
      expect(mockMessagingFrom).not.toHaveBeenCalled();
    });
  });

  describe('clearPublicKeyCache', () => {
    it('empties the cache so a later offline lookup misses', async () => {
      // Populate cache online.
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder({ public_key: PUBLIC_JWK }, null)
      );
      await keyManagementService.getUserPublicKey(OTHER_USER_ID);

      keyManagementService.clearPublicKeyCache();

      // Offline + no cache → falls through to DB query (which now finds nothing).
      setOnline(false);
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, { code: 'PGRST116', message: 'no rows' })
      );

      expect(
        await keyManagementService.getUserPublicKey(OTHER_USER_ID)
      ).toBeNull();
    });
  });
});
