/**
 * Unit Test: GroupKeyService
 * Feature 010: Group Chats
 *
 * Tests GroupKeyService symmetric-key operations with a fully mocked
 * Supabase client, messaging client, ECDH encryption service, key-management
 * service, and Web Crypto (crypto.subtle / crypto.getRandomValues).
 *
 * No network and no real cryptography — crypto primitives return plausible
 * fakes (exportKey -> 32-byte ArrayBuffer, encrypt/decrypt -> ArrayBuffer,
 * generate/importKey -> stub CryptoKey). btoa/atob come from jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Valid test UUIDs
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';
const MEMBER_1_ID = '00000000-0000-0000-0000-000000000002';
const MEMBER_2_ID = '00000000-0000-0000-0000-000000000003';
const CONVERSATION_ID = '00000000-0000-0000-0000-000000000100';

// Mock Supabase client (auth.getUser is what this service uses)
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
} as unknown as SupabaseClient;

// Mock messaging client (createMessagingClient(supabase).from(...))
const mockMessagingFrom = vi.fn();
const mockMessagingRpc = vi.fn();
const msgClient = { from: mockMessagingFrom, rpc: mockMessagingRpc };

// Mock createClient
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Mock createMessagingClient
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => msgClient,
}));

// Mock ECDH encryption service
vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    deriveSharedSecret: vi.fn().mockResolvedValue({} as CryptoKey),
  },
}));

// Mock key-management service
vi.mock('@/services/messaging/key-service', () => ({
  keyManagementService: {
    getCurrentKeys: vi.fn(),
    getUserPublicKey: vi.fn(),
    getUserPublicKeyAt: vi.fn(), // #243: legacy-row fallback resolver
    getUserPublicKeyHistory: vi.fn(), // #1247 B2: every key a user has held
  },
}));

// Mock query builder (same helper shape as connection-service.test.ts)
const createMockQueryBuilder = (data: any = null, error: any = null) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  then: vi.fn((resolve) => resolve({ data, error })),
});

// A fake JWK (member / sender public key shape)
const TEST_PUBLIC_KEY: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'test-x',
  y: 'test-y',
};

// Stub CryptoKeys
const STUB_GROUP_KEY = { type: 'secret' } as unknown as CryptoKey;
const STUB_PRIVATE_KEY = { type: 'private' } as unknown as CryptoKey;

// crypto.subtle / crypto.getRandomValues fakes
const mockGenerateKey = vi.fn().mockResolvedValue(STUB_GROUP_KEY);
const mockImportKey = vi.fn().mockResolvedValue({} as CryptoKey);
const mockExportKey = vi.fn().mockResolvedValue(new ArrayBuffer(32));
const mockEncrypt = vi.fn().mockResolvedValue(new ArrayBuffer(48));
const mockDecrypt = vi.fn().mockResolvedValue(new ArrayBuffer(32));
const mockGetRandomValues = vi.fn((arr: Uint8Array) => arr);

// Import after mocks are set up
const { GroupKeyService, groupKeyService } = await import(
  '../group-key-service'
);
const { encryptionService } = await import('@/lib/messaging/encryption');
const { keyManagementService } = await import(
  '@/services/messaging/key-service'
);

describe('GroupKeyService', () => {
  let service: InstanceType<typeof GroupKeyService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-stub crypto each test (cleared by clearAllMocks impls retained)
    vi.stubGlobal('crypto', {
      subtle: {
        generateKey: mockGenerateKey,
        importKey: mockImportKey,
        exportKey: mockExportKey,
        encrypt: mockEncrypt,
        decrypt: mockDecrypt,
      },
      getRandomValues: mockGetRandomValues,
    });

    // Restore default mock implementations (clearAllMocks wipes them)
    mockGenerateKey.mockResolvedValue(STUB_GROUP_KEY);
    mockImportKey.mockResolvedValue({} as CryptoKey);
    mockExportKey.mockResolvedValue(new ArrayBuffer(32));
    mockEncrypt.mockResolvedValue(new ArrayBuffer(48));
    mockDecrypt.mockResolvedValue(new ArrayBuffer(32));
    mockGetRandomValues.mockImplementation((arr: Uint8Array) => arr);

    vi.mocked(encryptionService.deriveSharedSecret).mockResolvedValue(
      {} as CryptoKey
    );

    // Default: authenticated user
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
      data: { user: { id: CURRENT_USER_ID } },
      error: null,
    } as any);

    // Default: current user has keys
    vi.mocked(keyManagementService.getCurrentKeys).mockReturnValue({
      privateKey: STUB_PRIVATE_KEY,
      publicKey: {} as CryptoKey,
    } as any);

    // Default: members have public keys
    vi.mocked(keyManagementService.getUserPublicKey).mockResolvedValue(
      TEST_PUBLIC_KEY
    );
    // Default: a row's creator owns the JWK stored on it (#1247 B2 reader check)
    vi.mocked(keyManagementService.getUserPublicKeyHistory).mockResolvedValue([
      { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
    ]);

    // Use a fresh instance per test so the in-memory cache is isolated
    service = new GroupKeyService();
  });

  // ---------------------------------------------------------------------------
  // generateGroupKey
  // ---------------------------------------------------------------------------
  describe('generateGroupKey', () => {
    it('generates an AES-GCM-256 CryptoKey', async () => {
      const key = await service.generateGroupKey();

      expect(key).toBe(STUB_GROUP_KEY);
      expect(mockGenerateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('throws GroupKeyError when generation fails', async () => {
      mockGenerateKey.mockRejectedValueOnce(new Error('boom'));

      await expect(service.generateGroupKey()).rejects.toThrow(
        'Failed to generate group key'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // encryptGroupKeyForMember
  // ---------------------------------------------------------------------------
  describe('encryptGroupKeyForMember', () => {
    it('imports the member public key, derives a secret, and returns base64', async () => {
      const result = await service.encryptGroupKeyForMember(
        STUB_GROUP_KEY,
        TEST_PUBLIC_KEY,
        STUB_PRIVATE_KEY
      );

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(mockImportKey).toHaveBeenCalledWith(
        'jwk',
        TEST_PUBLIC_KEY,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
      expect(encryptionService.deriveSharedSecret).toHaveBeenCalled();
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('throws GroupKeyError when encryption fails', async () => {
      mockEncrypt.mockRejectedValueOnce(new Error('encrypt fail'));

      await expect(
        service.encryptGroupKeyForMember(
          STUB_GROUP_KEY,
          TEST_PUBLIC_KEY,
          STUB_PRIVATE_KEY
        )
      ).rejects.toThrow('Failed to encrypt group key');
    });
  });

  // ---------------------------------------------------------------------------
  // decryptGroupKey
  // ---------------------------------------------------------------------------
  describe('decryptGroupKey', () => {
    it('decodes base64, derives secret, decrypts, and imports the key', async () => {
      // Round-trip: produce a real base64 string via the encrypt path first
      const encrypted = await service.encryptGroupKeyForMember(
        STUB_GROUP_KEY,
        TEST_PUBLIC_KEY,
        STUB_PRIVATE_KEY
      );

      const result = await service.decryptGroupKey(
        encrypted,
        TEST_PUBLIC_KEY,
        STUB_PRIVATE_KEY
      );

      // importKeyBytes -> crypto.subtle.importKey('raw', ...) returns our stub
      expect(result).toBeDefined();
      expect(mockDecrypt).toHaveBeenCalled();
      expect(encryptionService.deriveSharedSecret).toHaveBeenCalled();
    });

    it('throws GroupKeyError when decryption fails', async () => {
      const encrypted = await service.encryptGroupKeyForMember(
        STUB_GROUP_KEY,
        TEST_PUBLIC_KEY,
        STUB_PRIVATE_KEY
      );
      mockDecrypt.mockRejectedValueOnce(new Error('decrypt fail'));

      await expect(
        service.decryptGroupKey(encrypted, TEST_PUBLIC_KEY, STUB_PRIVATE_KEY)
      ).rejects.toThrow('Failed to decrypt group key');
    });
  });

  // ---------------------------------------------------------------------------
  // getGroupKeyForConversation
  // ---------------------------------------------------------------------------
  describe('getGroupKeyForConversation', () => {
    it('returns the cached key on a cache hit (no DB / no auth call)', async () => {
      // distributeGroupKey caches version 1 for current user
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([], null) as any
      );
      await service.distributeGroupKey(CONVERSATION_ID, [], 1);

      vi.mocked(mockSupabase.auth.getUser).mockClear();
      mockMessagingFrom.mockClear();

      const key = await service.getGroupKeyForConversation(CONVERSATION_ID, 1);

      expect(key).toBe(STUB_GROUP_KEY);
      // Cache hit short-circuits before auth + DB
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
      expect(mockMessagingFrom).not.toHaveBeenCalled();
    });

    it('fetches + decrypts when not cached', async () => {
      // #243: the row now carries the creator's wrap-time public JWK, and the
      // unwrap path uses THAT (not getUserPublicKey / the creator's current key).
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          {
            encrypted_key: 'ZmFrZQ==',
            created_by: MEMBER_1_ID,
            creator_public_key: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
            created_at: '2025-01-01T00:00:00Z',
          },
          null
        ) as any
      );

      const key = await service.getGroupKeyForConversation(CONVERSATION_ID, 7);

      expect(key).toBeDefined();
      expect(mockMessagingFrom).toHaveBeenCalledWith('group_keys');
      // #243: primary path uses the stored creator_public_key — it must NOT call
      // getUserPublicKey (that's only the legacy fallback for rows without it).
      expect(keyManagementService.getUserPublicKey).not.toHaveBeenCalled();
      expect(mockDecrypt).toHaveBeenCalled();

      // Second call should now be served from cache (no further DB hit)
      mockMessagingFrom.mockClear();
      const cached = await service.getGroupKeyForConversation(
        CONVERSATION_ID,
        7
      );
      expect(cached).toBe(key);
      expect(mockMessagingFrom).not.toHaveBeenCalled();
    });

    it('#243: legacy row (no creator_public_key) resolves via getUserPublicKeyAt', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(
          {
            encrypted_key: 'ZmFrZQ==',
            created_by: MEMBER_1_ID,
            creator_public_key: null, // legacy row, pre-#243
            created_at: '2025-01-01T00:00:00Z',
          },
          null
        ) as any
      );
      vi.mocked(keyManagementService.getUserPublicKeyAt).mockResolvedValue({
        kty: 'EC',
        crv: 'P-256',
        x: 'x',
        y: 'y',
      } as JsonWebKey);

      const key = await service.getGroupKeyForConversation(CONVERSATION_ID, 3);

      expect(key).toBeDefined();
      // Falls back to the time-window resolver anchored on the row's created_at.
      expect(keyManagementService.getUserPublicKeyAt).toHaveBeenCalledWith(
        MEMBER_1_ID,
        '2025-01-01T00:00:00Z'
      );
      expect(mockDecrypt).toHaveBeenCalled();
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        service.getGroupKeyForConversation(CONVERSATION_ID, 1)
      ).rejects.toThrow('You must be signed in to access group keys');
    });

    // #1247 B2: the reader trusted whatever JWK sat on the row. B1's write guard now refuses a
    // foreign JWK, but rows written before it, or by service code, were never checked — and the
    // JWK decides whose ECDH secret unwraps the key.
    describe('the stored creator key must belong to created_by (#1247 B2)', () => {
      const row = (over: Record<string, unknown>) =>
        createMockQueryBuilder(
          {
            encrypted_key: 'ZmFrZQ==',
            created_by: MEMBER_1_ID,
            creator_public_key: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
            created_at: '2025-01-01T00:00:00Z',
            ...over,
          },
          null
        ) as any;

      it('refuses a row whose JWK is not one of its creator’s keys', async () => {
        mockMessagingFrom.mockReturnValue(
          row({
            creator_public_key: {
              kty: 'EC',
              crv: 'P-256',
              x: 'forged',
              y: 'forged',
            },
          })
        );

        await expect(
          service.getGroupKeyForConversation(CONVERSATION_ID, 4)
        ).rejects.toThrow(/does not belong to the member who wrote it/i);
        expect(
          keyManagementService.getUserPublicKeyHistory
        ).toHaveBeenCalledWith(MEMBER_1_ID);
        expect(mockDecrypt).not.toHaveBeenCalled();
      });

      it('control: a key the creator has since revoked still counts as theirs (#243)', async () => {
        vi.mocked(
          keyManagementService.getUserPublicKeyHistory
        ).mockResolvedValue([
          { kty: 'EC', crv: 'P-256', x: 'current', y: 'current' },
          { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, // revoked, but theirs
        ]);
        mockMessagingFrom.mockReturnValue(row({}));

        await expect(
          service.getGroupKeyForConversation(CONVERSATION_ID, 4)
        ).resolves.toBeDefined();
      });

      it('control: an erased creator (created_by NULL) leaves only the stored JWK (#247)', async () => {
        mockMessagingFrom.mockReturnValue(row({ created_by: null }));

        await expect(
          service.getGroupKeyForConversation(CONVERSATION_ID, 4)
        ).resolves.toBeDefined();
        expect(
          keyManagementService.getUserPublicKeyHistory
        ).not.toHaveBeenCalled();
      });
    });

    it('throws GroupKeyError when the key row is not found (PGRST116)', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder(null, {
          code: 'PGRST116',
          message: 'no rows',
        }) as any
      );

      await expect(
        service.getGroupKeyForConversation(CONVERSATION_ID, 9)
      ).rejects.toThrow('Group key not found for version 9');
    });
  });

  // ---------------------------------------------------------------------------
  // distributeGroupKey
  // ---------------------------------------------------------------------------
  describe('distributeGroupKey', () => {
    const members = [
      { id: 'm1', conversation_id: CONVERSATION_ID, user_id: MEMBER_1_ID },
      { id: 'm2', conversation_id: CONVERSATION_ID, user_id: MEMBER_2_ID },
    ] as any;

    it('encrypts for each member and returns successful ids', async () => {
      const builder = createMockQueryBuilder([], null);
      mockMessagingFrom.mockReturnValue(builder as any);

      const result = await service.distributeGroupKey(
        CONVERSATION_ID,
        members,
        1
      );

      expect(result.successful).toEqual([MEMBER_1_ID, MEMBER_2_ID]);
      expect(result.pending).toEqual([]);
      expect(builder.insert).toHaveBeenCalled();
      // Distributed key is cached for the current user
      expect(service.getCachedKey(CONVERSATION_ID, 1)).toBe(STUB_GROUP_KEY);
    });

    it('writes every member’s row in ONE insert, whatever the group size (#1247 B2)', async () => {
      // Batches of 50 were separate statements: a failure after the first left some members
      // with rows at the new version and others without, and group_keys has no DELETE path.
      const many = Array.from({ length: 120 }, (_, i) => ({
        id: `m${i}`,
        conversation_id: CONVERSATION_ID,
        user_id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      })) as any;
      const builder = createMockQueryBuilder([], null);
      mockMessagingFrom.mockReturnValue(builder as any);

      await service.distributeGroupKey(CONVERSATION_ID, many, 1);

      expect(builder.insert).toHaveBeenCalledTimes(1);
      expect(vi.mocked(builder.insert).mock.calls[0][0]).toHaveLength(120);
    });

    it('marks members without a public key as pending', async () => {
      vi.mocked(keyManagementService.getUserPublicKey).mockImplementation(
        async (id: string) => (id === MEMBER_1_ID ? TEST_PUBLIC_KEY : null)
      );
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([], null) as any
      );

      const result = await service.distributeGroupKey(
        CONVERSATION_ID,
        members,
        1
      );

      expect(result.successful).toEqual([MEMBER_1_ID]);
      expect(result.pending).toEqual([MEMBER_2_ID]);
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        service.distributeGroupKey(CONVERSATION_ID, members, 1)
      ).rejects.toThrow('You must be signed in to distribute group keys');
    });

    it('throws GroupKeyError when current user has no keys', async () => {
      vi.mocked(keyManagementService.getCurrentKeys).mockReturnValue(null);

      await expect(
        service.distributeGroupKey(CONVERSATION_ID, members, 1)
      ).rejects.toThrow('Encryption keys not available');
    });
  });

  // ---------------------------------------------------------------------------
  // rotateGroupKey
  // ---------------------------------------------------------------------------
  describe('rotateGroupKey', () => {
    /** Each table answers its calls in order; the last answer repeats. */
    function answers(byTable: Record<string, unknown[]>) {
      const queues = Object.fromEntries(
        Object.entries(byTable).map(([t, list]) => [t, [...list]])
      );
      mockMessagingFrom.mockImplementation((table: string) => {
        const q = queues[table] ?? [createMockQueryBuilder(null, null)];
        return (q.length > 1 ? q.shift() : q[0]) as any;
      });
    }
    const activeMembers = [
      { id: 'm0', conversation_id: CONVERSATION_ID, user_id: CURRENT_USER_ID },
      { id: 'm1', conversation_id: CONVERSATION_ID, user_id: MEMBER_1_ID },
    ];

    it('rotates in ONE call to rotate_group_key and returns the new version (#1247 B2)', async () => {
      // Writing the rows and bumping were two requests: a failed bump left rows at N+1 that
      // then blocked every later rotation. The RPC commits both or neither.
      answers({
        conversation_members: [
          createMockQueryBuilder({ role: 'owner' }, null),
          createMockQueryBuilder(activeMembers, null),
        ],
        conversations: [
          createMockQueryBuilder({ current_key_version: 2 }, null),
        ],
      });
      mockMessagingRpc.mockResolvedValue({ data: 3, error: null });

      const newVersion = await service.rotateGroupKey(CONVERSATION_ID);

      expect(newVersion).toBe(3);
      expect(mockMessagingRpc).toHaveBeenCalledTimes(1);
      const [fn, args] = mockMessagingRpc.mock.calls[0];
      expect(fn).toBe('rotate_group_key');
      expect(args).toMatchObject({
        p_conversation_id: CONVERSATION_ID,
        p_from_version: 2,
      });
      expect(args.p_rows.map((r: any) => r.user_id)).toEqual([
        CURRENT_USER_ID,
        MEMBER_1_ID,
      ]);
      // Nothing is written outside the RPC.
      expect(mockMessagingFrom).not.toHaveBeenCalledWith('group_keys');
    });

    it('a rotation that lost the race says so, as a GroupKeyError', async () => {
      answers({
        conversation_members: [
          createMockQueryBuilder({ role: 'owner' }, null),
          createMockQueryBuilder(activeMembers, null),
        ],
        conversations: [
          createMockQueryBuilder({ current_key_version: 2 }, null),
        ],
      });
      mockMessagingRpc.mockResolvedValue({
        data: null,
        error: {
          code: 'PT409',
          message: 'the group key moved on from version 2',
        },
      });

      await expect(service.rotateGroupKey(CONVERSATION_ID)).rejects.toThrow(
        /another rotation got there first/i
      );
    });

    it('only an owner rotates: a member is refused before anything is written', async () => {
      answers({
        conversation_members: [
          createMockQueryBuilder({ role: 'member' }, null),
        ],
      });

      await expect(service.rotateGroupKey(CONVERSATION_ID)).rejects.toThrow(
        /only the group owner can rotate/i
      );
      expect(mockMessagingRpc).not.toHaveBeenCalled();
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(service.rotateGroupKey(CONVERSATION_ID)).rejects.toThrow(
        'You must be signed in to rotate group keys'
      );
    });

    it('throws ConnectionError when the conversation lookup fails', async () => {
      answers({
        conversation_members: [createMockQueryBuilder({ role: 'owner' }, null)],
        conversations: [createMockQueryBuilder(null, { message: 'db down' })],
      });

      await expect(service.rotateGroupKey(CONVERSATION_ID)).rejects.toThrow(
        'Failed to get conversation: db down'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // rotateIfDepartedSinceKey (#1247 B2): the owner's client rotates after a leave
  // ---------------------------------------------------------------------------
  describe('rotateIfDepartedSinceKey', () => {
    const KEY_AT = '2026-09-24T10:00:00.000Z';
    function wire(opts: {
      role: string | null;
      ownKeyAt: string | null;
      lastLeftAt: string | null;
    }) {
      const queues: Record<string, unknown[]> = {
        conversation_members: [
          createMockQueryBuilder(opts.role ? { role: opts.role } : null, null),
          createMockQueryBuilder(
            opts.lastLeftAt ? { left_at: opts.lastLeftAt } : null,
            null
          ),
        ],
        conversations: [
          createMockQueryBuilder({ current_key_version: 4 }, null),
        ],
        group_keys: [
          createMockQueryBuilder(
            opts.ownKeyAt ? { created_at: opts.ownKeyAt } : null,
            null
          ),
        ],
      };
      mockMessagingFrom.mockImplementation((table: string) => {
        const q = queues[table] ?? [createMockQueryBuilder(null, null)];
        return (q.length > 1 ? q.shift() : q[0]) as any;
      });
      return vi.spyOn(service, 'rotateGroupKey').mockResolvedValue(5);
    }

    it('rotates when someone left after the owner’s current key was written', async () => {
      const rotate = wire({
        role: 'owner',
        ownKeyAt: KEY_AT,
        lastLeftAt: '2026-09-24T11:00:00.000Z',
      });
      await expect(
        service.rotateIfDepartedSinceKey(CONVERSATION_ID)
      ).resolves.toBe(true);
      expect(rotate).toHaveBeenCalledWith(CONVERSATION_ID);
    });

    it('leaves the key alone when nobody has left since it was written', async () => {
      const rotate = wire({
        role: 'owner',
        ownKeyAt: KEY_AT,
        lastLeftAt: '2026-09-24T09:00:00.000Z',
      });
      await expect(
        service.rotateIfDepartedSinceKey(CONVERSATION_ID)
      ).resolves.toBe(false);
      expect(rotate).not.toHaveBeenCalled();
    });

    it('rotates when the owner holds no key at the current version and someone has left', async () => {
      // A newly promoted owner (#247 erasure hand-over) may never have been given the current key.
      const rotate = wire({
        role: 'owner',
        ownKeyAt: null,
        lastLeftAt: '2026-09-24T09:00:00.000Z',
      });
      await expect(
        service.rotateIfDepartedSinceKey(CONVERSATION_ID)
      ).resolves.toBe(true);
      expect(rotate).toHaveBeenCalled();
    });

    it('does nothing for a member who is not the owner', async () => {
      const rotate = wire({
        role: 'member',
        ownKeyAt: KEY_AT,
        lastLeftAt: '2026-09-24T11:00:00.000Z',
      });
      await expect(
        service.rotateIfDepartedSinceKey(CONVERSATION_ID)
      ).resolves.toBe(false);
      expect(rotate).not.toHaveBeenCalled();
    });

    it('never throws: a failed rotation is logged and reported as false', async () => {
      const rotate = wire({
        role: 'owner',
        ownKeyAt: KEY_AT,
        lastLeftAt: '2026-09-24T11:00:00.000Z',
      });
      rotate.mockRejectedValue(new Error('boom'));
      await expect(
        service.rotateIfDepartedSinceKey(CONVERSATION_ID)
      ).resolves.toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // retryKeyDistribution
  // ---------------------------------------------------------------------------
  describe('retryKeyDistribution', () => {
    it('re-distributes to pending members and returns empty when all succeed', async () => {
      // Seed a cached key so getGroupKeyForConversation is a cache hit
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([], null) as any
      );
      await service.distributeGroupKey(CONVERSATION_ID, [], 5);

      mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder(
            { current_key_version: 5 },
            null
          ) as any;
        }
        // group_keys / conversation_members inserts+updates succeed
        return createMockQueryBuilder([], null) as any;
      });

      const stillPending = await service.retryKeyDistribution(CONVERSATION_ID, [
        MEMBER_1_ID,
      ]);

      expect(stillPending).toEqual([]);
    });

    it('a refused insert leaves the member pending instead of counting as delivered (#1247 B2)', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([], null) as any
      );
      await service.distributeGroupKey(CONVERSATION_ID, [], 5);
      vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder(
            { current_key_version: 5 },
            null
          ) as any;
        }
        if (table === 'group_keys') {
          return createMockQueryBuilder(null, {
            code: '42501',
            message: 'refused',
          }) as any;
        }
        return createMockQueryBuilder([], null) as any;
      });

      const stillPending = await service.retryKeyDistribution(CONVERSATION_ID, [
        MEMBER_1_ID,
      ]);

      expect(stillPending).toEqual([MEMBER_1_ID]);
    });

    it('throws AuthenticationError when not signed in', async () => {
      vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      } as any);

      await expect(
        service.retryKeyDistribution(CONVERSATION_ID, [MEMBER_1_ID])
      ).rejects.toThrow('You must be signed in to retry key distribution');
    });

    it('throws GroupKeyError when current user has no keys', async () => {
      mockMessagingFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder(
            { current_key_version: 1 },
            null
          ) as any;
        }
        return createMockQueryBuilder([], null) as any;
      });
      vi.mocked(keyManagementService.getCurrentKeys).mockReturnValue(null);

      await expect(
        service.retryKeyDistribution(CONVERSATION_ID, [MEMBER_1_ID])
      ).rejects.toThrow('Encryption keys not available');
    });
  });

  // ---------------------------------------------------------------------------
  // clearCache
  // ---------------------------------------------------------------------------
  describe('clearCache', () => {
    it('empties the in-memory key cache', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([], null) as any
      );
      await service.distributeGroupKey(CONVERSATION_ID, [], 1);
      expect(service.getCachedKey(CONVERSATION_ID, 1)).toBe(STUB_GROUP_KEY);

      service.clearCache();

      expect(service.getCachedKey(CONVERSATION_ID, 1)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getCachedKey
  // ---------------------------------------------------------------------------
  describe('getCachedKey', () => {
    it('returns the cached key when present', async () => {
      mockMessagingFrom.mockReturnValue(
        createMockQueryBuilder([], null) as any
      );
      await service.distributeGroupKey(CONVERSATION_ID, [], 4);

      expect(service.getCachedKey(CONVERSATION_ID, 4)).toBe(STUB_GROUP_KEY);
    });

    it('returns undefined when the key is not cached', () => {
      expect(service.getCachedKey(CONVERSATION_ID, 999)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // exportKeyBytes
  // ---------------------------------------------------------------------------
  describe('exportKeyBytes', () => {
    it('exports raw key bytes via crypto.subtle.exportKey', async () => {
      const bytes = await service.exportKeyBytes(STUB_GROUP_KEY);

      expect(bytes).toBeInstanceOf(ArrayBuffer);
      expect((bytes as ArrayBuffer).byteLength).toBe(32);
      expect(mockExportKey).toHaveBeenCalledWith('raw', STUB_GROUP_KEY);
    });

    it('propagates errors from crypto.subtle.exportKey', async () => {
      mockExportKey.mockRejectedValueOnce(new Error('not extractable'));

      await expect(service.exportKeyBytes(STUB_GROUP_KEY)).rejects.toThrow(
        'not extractable'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // importKeyBytes
  // ---------------------------------------------------------------------------
  describe('importKeyBytes', () => {
    it('imports an ArrayBuffer as an AES-GCM key', async () => {
      const key = await service.importKeyBytes(new ArrayBuffer(32));

      expect(key).toBeDefined();
      expect(mockImportKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('accepts a Uint8Array directly', async () => {
      const key = await service.importKeyBytes(new Uint8Array(32));

      expect(key).toBeDefined();
      expect(mockImportKey).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // singleton export
  // ---------------------------------------------------------------------------
  describe('groupKeyService singleton', () => {
    it('is an instance of GroupKeyService', () => {
      expect(groupKeyService).toBeInstanceOf(GroupKeyService);
    });
  });
});
