/**
 * Unit Test: MessageService
 *
 * Tests every public method of MessageService (and the two standalone
 * cache helpers) against fully mocked Supabase / messaging clients,
 * encryption service, key-management service, offline queue, message
 * cache, and crypto.subtle. No network, no IndexedDB, no real crypto.
 *
 * IMPORTANT — module-level cache pollution:
 *   message-service.ts holds three module-level caches (conversationCache,
 *   sharedSecretCache, cachedSenderPrivateKey). To keep tests independent,
 *   every test starts from a fresh module instance: beforeEach calls
 *   vi.resetModules() and re-imports the service so those module-level
 *   Maps/refs are recreated empty per test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Valid test UUIDs
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002';
const THIRD_USER_ID = '00000000-0000-0000-0000-000000000003';
const CONVERSATION_ID = '00000000-0000-0000-0000-000000000100';
const MESSAGE_ID = '00000000-0000-0000-0000-000000000200';

// ---------------------------------------------------------------------------
// Mock query builder — chainable; resolves the same {data,error,count} for
// the terminal awaits the service uses (then / single / maybeSingle).
// Mirrors the createMockQueryBuilder helper from connection-service.test.ts
// but adds the messaging-specific terminals: in / is / lt / not.
// ---------------------------------------------------------------------------
const createMockQueryBuilder = (
  data: any = null,
  error: any = null,
  count: number | null = null
) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data, error, count }),
  maybeSingle: vi.fn().mockResolvedValue({ data, error, count }),
  then: vi.fn((resolve) => resolve({ data, error, count })),
});

// Mock Supabase client (used only for auth.getSession in the service)
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
} as any;

// Mock messaging client (.from() returns query builders)
const mockMsgFrom = vi.fn();
const mockMsgClient = { from: mockMsgFrom } as any;

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => mockMsgClient,
}));

// Mock encryption service
vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    deriveSharedSecret: vi.fn(),
    encryptMessage: vi.fn(),
    decryptMessage: vi.fn(),
    getPrivateKey: vi.fn(),
  },
}));

// Mock key-management service
vi.mock('../key-service', () => ({
  keyManagementService: {
    getCurrentKeys: vi.fn(),
    restoreKeysFromCache: vi.fn(),
    getUserPublicKey: vi.fn(),
  },
}));

// Mock offline queue service
vi.mock('../offline-queue-service', () => ({
  offlineQueueService: {
    queueMessage: vi.fn(),
  },
}));

// Mock message cache
vi.mock('@/lib/messaging/cache', () => ({
  cacheService: {
    getCachedMessages: vi.fn(),
    cacheMessages: vi.fn(),
  },
}));

// Stubs we re-grab from the (mocked) modules each test
let encryptionService: any;
let keyManagementService: any;
let offlineQueueService: any;
let cacheService: any;

// The service exports under test, re-imported per test after resetModules()
let MessageService: any;
let messageService: any;
let isConversationCached: (id: string) => boolean;
let cacheConversationData: (id: string, data: any) => Promise<void>;

const DUMMY_PUBLIC_JWK: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'test-x',
  y: 'test-y',
};

/** Set navigator.onLine for the current test. */
function setOnline(online: boolean) {
  Object.defineProperty(global, 'navigator', {
    value: { onLine: online },
    configurable: true,
  });
}

/** Default: authenticated session returning CURRENT_USER_ID. */
function setAuthenticated() {
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: CURRENT_USER_ID } } },
    error: null,
  });
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: CURRENT_USER_ID } },
    error: null,
  });
}

/** No session — every getSession attempt returns null. */
function setUnauthenticated() {
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'Not authenticated' },
  });
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  // Fresh module instances so module-level caches (conversationCache,
  // sharedSecretCache, cachedSenderPrivateKey) start empty per test.
  vi.resetModules();

  const svcMod = await import('../message-service');
  MessageService = svcMod.MessageService;
  messageService = svcMod.messageService;
  isConversationCached = svcMod.isConversationCached;
  cacheConversationData = svcMod.cacheConversationData;

  ({ encryptionService } = await import('@/lib/messaging/encryption'));
  ({ keyManagementService } = await import('../key-service'));
  ({ offlineQueueService } = await import('../offline-queue-service'));
  ({ cacheService } = await import('@/lib/messaging/cache'));

  // Sensible defaults
  setOnline(true);
  setAuthenticated();

  keyManagementService.getCurrentKeys.mockReturnValue({
    privateKey: { id: 'priv' } as unknown as CryptoKey,
    publicKey: { id: 'pub' } as unknown as CryptoKey,
  });
  keyManagementService.restoreKeysFromCache.mockResolvedValue(true);
  keyManagementService.getUserPublicKey.mockResolvedValue(DUMMY_PUBLIC_JWK);

  encryptionService.deriveSharedSecret.mockResolvedValue(
    {} as unknown as CryptoKey
  );
  encryptionService.encryptMessage.mockResolvedValue({
    ciphertext: 'encrypted-content',
    iv: 'test-iv',
  });
  encryptionService.decryptMessage.mockResolvedValue('decrypted text');
  encryptionService.getPrivateKey.mockResolvedValue({} as unknown as CryptoKey);

  offlineQueueService.queueMessage.mockResolvedValue(undefined);
  cacheService.getCachedMessages.mockResolvedValue([]);
  cacheService.cacheMessages.mockResolvedValue(0);

  // crypto.subtle.importKey + randomUUID stub
  vi.stubGlobal('crypto', {
    subtle: { importKey: vi.fn().mockResolvedValue({}) },
    randomUUID: vi.fn(() => '11111111-1111-1111-1111-111111111111'),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MessageService', () => {
  describe('module exports', () => {
    it('exports a MessageService class and a singleton instance', () => {
      expect(typeof MessageService).toBe('function');
      expect(messageService).toBeInstanceOf(MessageService);
    });
  });

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------
  describe('sendMessage', () => {
    const baseConv = {
      participant_1_id: CURRENT_USER_ID,
      participant_2_id: OTHER_USER_ID,
      is_group: false,
    };

    it('sends a message successfully when online (happy path)', async () => {
      // conversations lookup -> messages seq lookup -> insert -> conv update
      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder(baseConv, null);
        }
        if (table === 'messages') {
          // First a select (seq number) then an insert().select().single()
          const builder = createMockQueryBuilder(
            { id: MESSAGE_ID, sequence_number: 1 },
            null
          );
          // maybeSingle returns the "last message" seq number lookup
          builder.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: { sequence_number: 5 }, error: null });
          // insert().select().single() returns the inserted row
          builder.single = vi.fn().mockResolvedValue({
            data: { id: MESSAGE_ID, sequence_number: 6 },
            error: null,
          });
          return builder;
        }
        return createMockQueryBuilder(null, null);
      });

      const result = await messageService.sendMessage({
        conversation_id: CONVERSATION_ID,
        content: 'hello world',
      });

      expect(result.queued).toBe(false);
      expect(result.message).toEqual({ id: MESSAGE_ID, sequence_number: 6 });
      expect(encryptionService.encryptMessage).toHaveBeenCalledWith(
        'hello world',
        expect.anything()
      );
    });

    it('rejects empty content (min length validation)', async () => {
      await expect(
        messageService.sendMessage({
          conversation_id: CONVERSATION_ID,
          content: '   ',
        })
      ).rejects.toThrow('Message cannot be empty');
    });

    it('rejects content over MAX_LENGTH', async () => {
      await expect(
        messageService.sendMessage({
          conversation_id: CONVERSATION_ID,
          content: 'a'.repeat(10001),
        })
      ).rejects.toThrow('cannot exceed');
    });

    it('throws AuthenticationError when not signed in (after retries)', async () => {
      setUnauthenticated();
      const promise = messageService.sendMessage({
        conversation_id: CONVERSATION_ID,
        content: 'hi there',
      });
      // Attach the rejection assertion BEFORE draining timers so the promise
      // is never momentarily unhandled (avoids Vitest unhandled-rejection
      // false positives), then drain the 2 x 500ms retry sleeps.
      const assertion = expect(promise).rejects.toThrow(
        'You must be signed in to send messages'
      );
      await vi.runAllTimersAsync();
      await assertion;
    });

    it('succeeds on a later getSession retry (session-retry)', async () => {
      // First two attempts null, third returns a session
      mockSupabase.auth.getSession
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValue({
          data: { session: { user: { id: CURRENT_USER_ID } } },
          error: null,
        });

      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder(baseConv, null);
        }
        if (table === 'messages') {
          const builder = createMockQueryBuilder(null, null);
          builder.maybeSingle = vi
            .fn()
            .mockResolvedValue({ data: null, error: null });
          builder.single = vi
            .fn()
            .mockResolvedValue({ data: { id: MESSAGE_ID }, error: null });
          return builder;
        }
        return createMockQueryBuilder(null, null);
      });

      const promise = messageService.sendMessage({
        conversation_id: CONVERSATION_ID,
        content: 'retry me',
      });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.queued).toBe(false);
      // Two retries means at least 3 getSession calls
      expect(
        mockSupabase.auth.getSession.mock.calls.length
      ).toBeGreaterThanOrEqual(3);
    });

    it('queues the message when offline', async () => {
      setOnline(false);
      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder(baseConv, null);
        }
        return createMockQueryBuilder(null, null);
      });

      const result = await messageService.sendMessage({
        conversation_id: CONVERSATION_ID,
        content: 'offline message',
      });

      expect(result.queued).toBe(true);
      expect(offlineQueueService.queueMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: CONVERSATION_ID,
          sender_id: CURRENT_USER_ID,
          content: 'offline message',
          encrypted_content: 'encrypted-content',
          initialization_vector: 'test-iv',
        })
      );
    });

    it('throws EncryptionLockedError when keys cannot be restored', async () => {
      keyManagementService.getCurrentKeys.mockReturnValue(null);
      keyManagementService.restoreKeysFromCache.mockResolvedValue(false);

      await expect(
        messageService.sendMessage({
          conversation_id: CONVERSATION_ID,
          content: 'no keys',
        })
      ).rejects.toThrow('encryption keys are not available');
    });

    it('throws ValidationError for group conversations', async () => {
      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder({ ...baseConv, is_group: true }, null);
        }
        return createMockQueryBuilder(null, null);
      });

      await expect(
        messageService.sendMessage({
          conversation_id: CONVERSATION_ID,
          content: 'group msg',
        })
      ).rejects.toThrow('Group message encryption not yet implemented');
    });
  });

  // -----------------------------------------------------------------------
  // getMessageHistory
  // -----------------------------------------------------------------------
  describe('getMessageHistory', () => {
    const conv = {
      participant_1_id: CURRENT_USER_ID,
      participant_2_id: OTHER_USER_ID,
      is_group: false,
    };

    const messageRow = {
      id: MESSAGE_ID,
      conversation_id: CONVERSATION_ID,
      sender_id: OTHER_USER_ID,
      encrypted_content: 'enc',
      initialization_vector: 'iv',
      sequence_number: 1,
      deleted: false,
      edited: false,
      edited_at: null,
      delivered_at: null,
      read_at: null,
      created_at: '2025-01-01T00:00:00Z',
    };

    function wireHistory(rows: any[], decryptImpl?: () => any) {
      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'messages') {
          return createMockQueryBuilder(rows, null);
        }
        if (table === 'conversations') {
          return createMockQueryBuilder(conv, null);
        }
        if (table === 'user_profiles') {
          return createMockQueryBuilder(
            [
              { id: CURRENT_USER_ID, username: 'me', display_name: 'Me' },
              { id: OTHER_USER_ID, username: 'them', display_name: 'Them' },
            ],
            null
          );
        }
        return createMockQueryBuilder(null, null);
      });
      if (decryptImpl) {
        encryptionService.decryptMessage.mockImplementation(decryptImpl);
      }
    }

    it('fetches and decrypts messages (happy path)', async () => {
      wireHistory([messageRow], () => Promise.resolve('hello!'));

      const result = await messageService.getMessageHistory(CONVERSATION_ID);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('hello!');
      expect(result.messages[0].id).toBe(MESSAGE_ID);
      expect(cacheService.cacheMessages).toHaveBeenCalled();
    });

    it('returns a decryption placeholder when decrypt fails', async () => {
      wireHistory([messageRow], () => Promise.reject(new Error('bad key')));

      const result = await messageService.getMessageHistory(CONVERSATION_ID);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].decryptionError).toBe(true);
      expect(result.messages[0].content).toBe('Encrypted with previous keys');
    });

    it('falls back to IndexedDB cache when offline', async () => {
      setOnline(false);
      cacheService.getCachedMessages.mockResolvedValue([messageRow]);
      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'conversations') {
          return createMockQueryBuilder(conv, null);
        }
        if (table === 'user_profiles') {
          return createMockQueryBuilder([], null);
        }
        return createMockQueryBuilder(null, null);
      });
      encryptionService.decryptMessage.mockResolvedValue('cached text');

      const result = await messageService.getMessageHistory(CONVERSATION_ID);

      expect(cacheService.getCachedMessages).toHaveBeenCalledWith(
        CONVERSATION_ID,
        50
      );
      expect(result.messages[0].content).toBe('cached text');
    });

    it('returns empty when offline with no cache', async () => {
      setOnline(false);
      cacheService.getCachedMessages.mockResolvedValue([]);

      const result = await messageService.getMessageHistory(CONVERSATION_ID);

      expect(result).toEqual({ messages: [], has_more: false, cursor: null });
    });

    it('throws AuthenticationError when not signed in', async () => {
      setUnauthenticated();
      const promise = messageService.getMessageHistory(CONVERSATION_ID);
      // Attach assertion before draining timers (see sendMessage auth test).
      const assertion = expect(promise).rejects.toThrow(
        'You must be signed in to view messages'
      );
      await vi.runAllTimersAsync();
      await assertion;
    });
  });

  // -----------------------------------------------------------------------
  // markAsRead
  // -----------------------------------------------------------------------
  describe('markAsRead', () => {
    it('updates read_at for given message ids (happy path)', async () => {
      const builder = createMockQueryBuilder(null, null, 2);
      mockMsgFrom.mockReturnValue(builder);

      await messageService.markAsRead([MESSAGE_ID]);

      expect(mockMsgFrom).toHaveBeenCalledWith('messages');
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ read_at: expect.any(String) })
      );
    });

    it('returns early (no DB call) when given an empty array', async () => {
      await messageService.markAsRead([]);
      expect(mockMsgFrom).not.toHaveBeenCalled();
    });

    it('throws ConnectionError when the update fails', async () => {
      const builder = createMockQueryBuilder(null, {
        message: 'db down',
      });
      mockMsgFrom.mockReturnValue(builder);

      await expect(messageService.markAsRead([MESSAGE_ID])).rejects.toThrow(
        'Failed to mark messages as read: db down'
      );
    });
  });

  // -----------------------------------------------------------------------
  // markAsDelivered
  // -----------------------------------------------------------------------
  describe('markAsDelivered', () => {
    it('updates delivered_at for given message ids (happy path)', async () => {
      const builder = createMockQueryBuilder(null, null, 1);
      mockMsgFrom.mockReturnValue(builder);

      await messageService.markAsDelivered([MESSAGE_ID]);

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ delivered_at: expect.any(String) })
      );
    });

    it('returns early when given an empty array', async () => {
      await messageService.markAsDelivered([]);
      expect(mockMsgFrom).not.toHaveBeenCalled();
    });

    it('swallows DB errors silently (never throws)', async () => {
      const builder = createMockQueryBuilder(null, { message: 'boom' });
      mockMsgFrom.mockReturnValue(builder);

      // Should resolve, not reject — delivery receipts never break the UI
      await expect(
        messageService.markAsDelivered([MESSAGE_ID])
      ).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // editMessage
  // -----------------------------------------------------------------------
  describe('editMessage', () => {
    const recentMessage = (overrides: any = {}) => ({
      id: MESSAGE_ID,
      conversation_id: CONVERSATION_ID,
      sender_id: CURRENT_USER_ID,
      created_at: new Date().toISOString(),
      deleted: false,
      ...overrides,
    });

    const conv = {
      participant_1_id: CURRENT_USER_ID,
      participant_2_id: OTHER_USER_ID,
      is_group: false,
    };

    function wireEdit(messageData: any, updateError: any = null) {
      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'messages') {
          const builder = createMockQueryBuilder(messageData, null);
          // fetch uses .single(); update uses terminal then() -> updateError
          builder.then = vi.fn((resolve) =>
            resolve({ data: null, error: updateError })
          );
          return builder;
        }
        if (table === 'conversations') {
          return createMockQueryBuilder(conv, null);
        }
        return createMockQueryBuilder(null, null);
      });
    }

    it('re-encrypts and updates within the window (happy path)', async () => {
      wireEdit(recentMessage());

      await messageService.editMessage({
        message_id: MESSAGE_ID,
        new_content: 'edited text',
      });

      expect(encryptionService.encryptMessage).toHaveBeenCalledWith(
        'edited text',
        expect.anything()
      );
    });

    it('rejects empty new content', async () => {
      await expect(
        messageService.editMessage({ message_id: MESSAGE_ID, new_content: ' ' })
      ).rejects.toThrow('Message cannot be empty');
    });

    it('throws when the user does not own the message (ownership)', async () => {
      wireEdit(recentMessage({ sender_id: THIRD_USER_ID }));

      await expect(
        messageService.editMessage({
          message_id: MESSAGE_ID,
          new_content: 'nope',
        })
      ).rejects.toThrow('You can only edit your own messages');
    });

    it('throws when outside the 15-minute edit window', async () => {
      const old = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      wireEdit(recentMessage({ created_at: old }));

      await expect(
        messageService.editMessage({
          message_id: MESSAGE_ID,
          new_content: 'too late',
        })
      ).rejects.toThrow('can only be edited within 15 minutes');
    });

    it('throws when the message is not found', async () => {
      mockMsgFrom.mockImplementation((table: string) => {
        if (table === 'messages') {
          return createMockQueryBuilder(null, { message: 'not found' });
        }
        return createMockQueryBuilder(null, null);
      });

      await expect(
        messageService.editMessage({
          message_id: MESSAGE_ID,
          new_content: 'ghost',
        })
      ).rejects.toThrow('Message not found');
    });
  });

  // -----------------------------------------------------------------------
  // deleteMessage
  // -----------------------------------------------------------------------
  describe('deleteMessage', () => {
    const recentMessage = (overrides: any = {}) => ({
      id: MESSAGE_ID,
      conversation_id: CONVERSATION_ID,
      sender_id: CURRENT_USER_ID,
      created_at: new Date().toISOString(),
      deleted: false,
      ...overrides,
    });

    function wireDelete(messageData: any, updateError: any = null) {
      const builder = createMockQueryBuilder(messageData, null);
      // soft-delete update is a terminal await on the builder (then())
      builder.then = vi.fn((resolve) =>
        resolve({ data: null, error: updateError })
      );
      mockMsgFrom.mockReturnValue(builder);
      return builder;
    }

    it('soft-deletes (sets deleted:true) within the window (happy path)', async () => {
      const builder = wireDelete(recentMessage());

      await messageService.deleteMessage(MESSAGE_ID);

      expect(builder.update).toHaveBeenCalledWith({ deleted: true });
    });

    it('throws when the user does not own the message (ownership)', async () => {
      wireDelete(recentMessage({ sender_id: THIRD_USER_ID }));

      await expect(messageService.deleteMessage(MESSAGE_ID)).rejects.toThrow(
        'You can only delete your own messages'
      );
    });

    it('throws when the message is already deleted', async () => {
      wireDelete(recentMessage({ deleted: true }));

      await expect(messageService.deleteMessage(MESSAGE_ID)).rejects.toThrow(
        'Message is already deleted'
      );
    });

    it('throws when outside the 15-minute delete window', async () => {
      const old = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      wireDelete(recentMessage({ created_at: old }));

      await expect(messageService.deleteMessage(MESSAGE_ID)).rejects.toThrow(
        'can only be deleted within 15 minutes'
      );
    });

    it('throws ConnectionError when the soft-delete update fails', async () => {
      wireDelete(recentMessage(), { message: 'update failed' });

      await expect(messageService.deleteMessage(MESSAGE_ID)).rejects.toThrow(
        'Failed to delete message: update failed'
      );
    });
  });

  // -----------------------------------------------------------------------
  // archiveConversation
  // -----------------------------------------------------------------------
  describe('archiveConversation', () => {
    function wireArchive(conv: any, updateError: any = null) {
      const builder = createMockQueryBuilder(conv, null);
      // update().eq().select() resolves via then()
      builder.then = vi.fn((resolve) =>
        resolve({ data: [{}], error: updateError })
      );
      mockMsgFrom.mockReturnValue(builder);
      return builder;
    }

    it('archives as participant_1 (happy path)', async () => {
      const builder = wireArchive({
        participant_1_id: CURRENT_USER_ID,
        participant_2_id: OTHER_USER_ID,
        is_group: false,
      });

      await messageService.archiveConversation(CONVERSATION_ID);

      expect(builder.update).toHaveBeenCalledWith({
        archived_by_participant_1: true,
      });
    });

    it('archives as participant_2', async () => {
      const builder = wireArchive({
        participant_1_id: OTHER_USER_ID,
        participant_2_id: CURRENT_USER_ID,
        is_group: false,
      });

      await messageService.archiveConversation(CONVERSATION_ID);

      expect(builder.update).toHaveBeenCalledWith({
        archived_by_participant_2: true,
      });
    });

    it('throws when the user is not a participant', async () => {
      wireArchive({
        participant_1_id: OTHER_USER_ID,
        participant_2_id: THIRD_USER_ID,
        is_group: false,
      });

      await expect(
        messageService.archiveConversation(CONVERSATION_ID)
      ).rejects.toThrow('You are not a participant in this conversation');
    });

    it('throws when the conversation is not found', async () => {
      mockMsgFrom.mockReturnValue(
        createMockQueryBuilder(null, { message: 'missing' })
      );

      await expect(
        messageService.archiveConversation(CONVERSATION_ID)
      ).rejects.toThrow('Conversation not found');
    });
  });

  // -----------------------------------------------------------------------
  // unarchiveConversation
  // -----------------------------------------------------------------------
  describe('unarchiveConversation', () => {
    function wireUnarchive(conv: any, updateError: any = null) {
      const builder = createMockQueryBuilder(conv, null);
      builder.then = vi.fn((resolve) =>
        resolve({ data: null, error: updateError })
      );
      mockMsgFrom.mockReturnValue(builder);
      return builder;
    }

    it('unarchives as participant_1 (happy path)', async () => {
      const builder = wireUnarchive({
        participant_1_id: CURRENT_USER_ID,
        participant_2_id: OTHER_USER_ID,
        is_group: false,
      });

      await messageService.unarchiveConversation(CONVERSATION_ID);

      expect(builder.update).toHaveBeenCalledWith({
        archived_by_participant_1: false,
      });
    });

    it('throws ConnectionError when the update fails', async () => {
      wireUnarchive(
        {
          participant_1_id: CURRENT_USER_ID,
          participant_2_id: OTHER_USER_ID,
          is_group: false,
        },
        { message: 'nope' }
      );

      await expect(
        messageService.unarchiveConversation(CONVERSATION_ID)
      ).rejects.toThrow('Failed to unarchive conversation: nope');
    });

    it('throws for group conversations', async () => {
      wireUnarchive({
        participant_1_id: CURRENT_USER_ID,
        participant_2_id: OTHER_USER_ID,
        is_group: true,
      });

      await expect(
        messageService.unarchiveConversation(CONVERSATION_ID)
      ).rejects.toThrow('Group conversation unarchiving not yet implemented');
    });
  });

  // -----------------------------------------------------------------------
  // isConversationCached + cacheConversationData (standalone helpers)
  // -----------------------------------------------------------------------
  describe('isConversationCached / cacheConversationData', () => {
    it('reports false before caching and true after', async () => {
      expect(isConversationCached(CONVERSATION_ID)).toBe(false);

      await cacheConversationData(CONVERSATION_ID, {
        participant_1_id: CURRENT_USER_ID,
        participant_2_id: OTHER_USER_ID,
        is_group: false,
      });

      expect(isConversationCached(CONVERSATION_ID)).toBe(true);
    });

    it('pre-fetches the recipient public key for 1-to-1 conversations', async () => {
      await cacheConversationData(CONVERSATION_ID, {
        participant_1_id: CURRENT_USER_ID,
        participant_2_id: OTHER_USER_ID,
        is_group: false,
      });

      // recipient is the OTHER participant
      expect(keyManagementService.getUserPublicKey).toHaveBeenCalledWith(
        OTHER_USER_ID
      );
    });

    it('does not pre-fetch a public key for group conversations', async () => {
      await cacheConversationData(CONVERSATION_ID, {
        participant_1_id: CURRENT_USER_ID,
        participant_2_id: OTHER_USER_ID,
        is_group: true,
      });

      expect(keyManagementService.getUserPublicKey).not.toHaveBeenCalled();
      expect(isConversationCached(CONVERSATION_ID)).toBe(true);
    });

    it('swallows public-key prefetch errors (non-fatal)', async () => {
      keyManagementService.getUserPublicKey.mockRejectedValue(
        new Error('network')
      );

      await expect(
        cacheConversationData(CONVERSATION_ID, {
          participant_1_id: CURRENT_USER_ID,
          participant_2_id: OTHER_USER_ID,
          is_group: false,
        })
      ).resolves.toBeUndefined();

      // Cache is still populated even though prefetch threw
      expect(isConversationCached(CONVERSATION_ID)).toBe(true);
    });

    it('module-level cache is reset between tests (isolation check)', () => {
      // If resetModules() were not wired into beforeEach, the entry written
      // by the first test in this block would still be present here.
      expect(isConversationCached(CONVERSATION_ID)).toBe(false);
    });
  });
});
