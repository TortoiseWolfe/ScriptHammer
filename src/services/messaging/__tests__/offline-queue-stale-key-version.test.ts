/**
 * A queued group message survives a key rotation (#1301, #1247 B3).
 *
 * The server now refuses a group message stamped with any key version but the current one
 * (`group_message_key_version_guard`, 42501 "stale group key version"). A message queued before
 * a rotation was encrypted under the old version, so the flush must re-encrypt it at the current
 * one and send it again, not retry the same refused ciphertext five times and give up.
 *
 * The fake server below enforces the same rule as the trigger, so these tests drive the whole
 * path: queue, rotate, flush. The CONTROL cases are what make the first one mean something:
 * a message already at the current version must go through untouched, and a refusal that is
 * not the stale-version one must not trigger a re-encrypt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messagingDb } from '@/lib/messaging/database';

type Sent = {
  key_version: number;
  encrypted_content: string;
  initialization_vector: string;
};

const server = {
  version: 1,
  accepted: [] as Sent[],
  refused: [] as Sent[],
  otherError: null as null | { code: string; message: string },
};

/** One chainable builder that remembers which table it was opened on. */
function builder(table: string) {
  const b: Record<string, unknown> = {};
  let upserted: Sent | null = null;
  for (const m of [
    'select',
    'insert',
    'update',
    'eq',
    'order',
    'limit',
    'from',
  ])
    b[m] = vi.fn(() => b);
  b.upsert = vi.fn((row: Sent) => {
    upserted = row;
    return b;
  });
  b.maybeSingle = vi.fn(() => {
    if (table === 'messages' && upserted) {
      if (server.otherError)
        return Promise.resolve({ data: null, error: server.otherError });
      if (upserted.key_version !== server.version) {
        server.refused.push(upserted);
        return Promise.resolve({
          data: null,
          error: {
            code: '42501',
            message: `stale group key version: message is under v${upserted.key_version} but the group is at v${server.version}`,
          },
        });
      }
      server.accepted.push(upserted);
      return Promise.resolve({ data: null, error: null });
    }
    // the sequence-number lookup
    return Promise.resolve({ data: null, error: null });
  });
  b.single = vi.fn(() =>
    Promise.resolve(
      table === 'conversations'
        ? { data: { current_key_version: server.version }, error: null }
        : { data: null, error: null }
    )
  );
  return b;
}

const client = {
  auth: {
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    getSession: vi.fn().mockResolvedValue({
      data: { session: { user: { id: 'u1' }, access_token: 't' } },
      error: null,
    }),
  },
  from: vi.fn((table: string) => builder(table)),
};
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => client,
  supabase: client,
}));
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => client,
}));

const encryptMessage = vi.fn(async (content: string, key: unknown) => ({
  ciphertext: `enc(${content})@v${(key as { version: number }).version}`,
  iv: 'iv-new',
}));
vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    encryptMessage: (content: string, key: unknown) =>
      encryptMessage(content, key),
    getPrivateKey: vi.fn().mockResolvedValue(null),
    storePrivateKey: vi.fn(),
  },
}));

const getGroupKey = vi.fn(async (_conversationId: string, version: number) => ({
  version,
}));
vi.mock('../group-key-service', () => ({
  groupKeyService: {
    getGroupKeyForConversation: (conversationId: string, version: number) =>
      getGroupKey(conversationId, version),
  },
}));
vi.mock('../key-service', async () => {
  const real =
    await vi.importActual<typeof import('../key-service')>('../key-service');
  return real;
});

const { OfflineQueueService } = await import('../offline-queue-service');

/** A group message encrypted and queued while the group was at `version`. */
const queueAt = (id: string, version: number, withPlaintext = true) =>
  messagingDb.messaging_queued_messages.add({
    id,
    conversation_id: 'group-1',
    sender_id: 'u1',
    encrypted_content: `enc(hello)@v${version}`,
    initialization_vector: 'iv-old',
    key_version: version,
    ...(withPlaintext ? { content: 'hello' } : {}),
    status: 'pending',
    synced: 0,
    retries: 0,
    created_at: Date.now(),
  } as never);

describe('queued group messages across a key rotation (#1301)', () => {
  beforeEach(async () => {
    await messagingDb.messaging_queued_messages.clear();
    server.version = 1;
    server.accepted = [];
    server.refused = [];
    server.otherError = null;
    encryptMessage.mockClear();
    getGroupKey.mockClear();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  it('queue, rotate, flush: the refused message is re-encrypted at the new version and delivered', async () => {
    await queueAt('m-1', 1); // queued while the group was at v1
    server.version = 2; // an owner removes a member: the key rotates

    const result = await new OfflineQueueService().syncQueue();

    expect(result.success).toBe(1);
    // The server really refused the v1 ciphertext first (not a vacuous pass).
    expect(server.refused).toHaveLength(1);
    expect(server.refused[0].key_version).toBe(1);
    // Then it accepted exactly one row, under v2, built from the kept plaintext.
    expect(server.accepted).toHaveLength(1);
    expect(server.accepted[0]).toMatchObject({
      key_version: 2,
      encrypted_content: 'enc(hello)@v2',
      initialization_vector: 'iv-new',
    });
    expect(getGroupKey).toHaveBeenCalledWith('group-1', 2);
    expect(encryptMessage).toHaveBeenCalledWith('hello', { version: 2 });

    const row = await messagingDb.messaging_queued_messages.get('m-1');
    expect(row?.status).toBe('sent');
    expect(row?.synced).toBe(1);
    expect(row?.content).toBeUndefined(); // plaintext still dropped on delivery (#1256)
  });

  it('CONTROL: a message already at the current version is sent as queued, with no re-encrypt', async () => {
    server.version = 2;
    await queueAt('m-2', 2);

    const result = await new OfflineQueueService().syncQueue();

    expect(result.success).toBe(1);
    expect(server.refused).toHaveLength(0);
    expect(server.accepted).toEqual([
      expect.objectContaining({
        key_version: 2,
        encrypted_content: 'enc(hello)@v2',
        initialization_vector: 'iv-old',
      }),
    ]);
    expect(encryptMessage).not.toHaveBeenCalled();
  });

  it('CONTROL: a different refusal does not trigger a re-encrypt', async () => {
    await queueAt('m-3', 1);
    server.otherError = {
      code: '42501',
      message: 'new row violates row-level security',
    };

    await new OfflineQueueService().syncQueue();

    expect(encryptMessage).not.toHaveBeenCalled();
    const row = await messagingDb.messaging_queued_messages.get('m-3');
    expect(row?.status).not.toBe('sent');
    expect(row?.encrypted_content).toBe('enc(hello)@v1');
  });

  it('with no plaintext to re-encrypt from, the message is never sent under the stale key', async () => {
    await queueAt('m-4', 1, false);
    server.version = 2;

    const result = await new OfflineQueueService().syncQueue();

    expect(result.success).toBe(0);
    expect(server.accepted).toHaveLength(0); // nothing readable by a removed member was stored
    const row = await messagingDb.messaging_queued_messages.get('m-4');
    expect(row?.status).not.toBe('sent');
    expect(row?.synced).toBe(0);
  });
});
