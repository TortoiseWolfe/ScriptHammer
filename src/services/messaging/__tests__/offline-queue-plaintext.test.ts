/**
 * Queued plaintext does not outlive the message (#1256).
 *
 * `content` and `plaintext_content` exist "for UI rendering while queued". After
 * a successful sync they were left in IndexedDB indefinitely, past logout. This
 * file has its own mocks because the sibling suite never drives syncQueue().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messagingDb } from '@/lib/messaging/database';

// One chainable builder. `maybeSingle` resolves { data: null, error: null }
// for every terminal read: the sequence lookup (→ next = 1) and the upsert
// (→ ON CONFLICT DO NOTHING shape, which the service treats as delivered).
const state = { upsertError: null as null | { code: string; message: string } };
function builder() {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of [
    'select',
    'insert',
    'update',
    'upsert',
    'eq',
    'order',
    'limit',
    'from',
  ])
    b[m] = vi.fn(chain);
  b.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: state.upsertError })
  );
  b.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
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
  from: vi.fn(() => builder()),
};
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => client,
  supabase: client,
}));
vi.mock('@/lib/supabase/messaging-client', () => ({
  createMessagingClient: () => client,
}));
vi.mock('@/lib/messaging/encryption', () => ({
  encryptionService: {
    encryptMessage: vi.fn().mockResolvedValue({ ciphertext: 'c', iv: 'iv' }),
    getPrivateKey: vi.fn().mockResolvedValue(null),
    storePrivateKey: vi.fn(),
  },
}));
vi.mock('../key-service', async () => {
  const real =
    await vi.importActual<typeof import('../key-service')>('../key-service');
  return real;
});

const { OfflineQueueService } = await import('../offline-queue-service');

const seed = async (id: string) =>
  messagingDb.messaging_queued_messages.add({
    id,
    conversation_id: 'conv-1',
    sender_id: 'u1',
    encrypted_content: 'c',
    initialization_vector: 'iv',
    content: 'the secret plaintext',
    plaintext_content: 'the secret plaintext',
    status: 'pending',
    synced: 0,
    retry_count: 0,
    created_at: new Date().toISOString(),
  } as never);

describe('queued plaintext after sync (#1256)', () => {
  beforeEach(async () => {
    await messagingDb.messaging_queued_messages.clear();
    state.upsertError = null;
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
  });

  it('a successfully synced row keeps its status and loses its plaintext', async () => {
    await seed('m-1');
    const service = new OfflineQueueService();
    await service.syncQueue();

    const row = await messagingDb.messaging_queued_messages.get('m-1');
    expect(row?.status).toBe('sent'); // the sync really happened
    expect(row?.synced).toBe(1);
    expect(row?.content).toBeUndefined();
    expect(row?.plaintext_content).toBeUndefined();
  });

  it('CONTROL: a row whose sync FAILS keeps its plaintext for the retry UI', async () => {
    // Proves the harness can tell "cleared by the fix" from "never stored".
    await seed('m-2');
    state.upsertError = { code: 'XX000', message: 'boom' };
    const service = new OfflineQueueService();
    await service.syncQueue();

    const row = await messagingDb.messaging_queued_messages.get('m-2');
    expect(row?.status).not.toBe('sent');
    expect(row?.content).toBe('the secret plaintext');
  });

  it('clearKeys() empties the queue, so logout leaves no plaintext behind', async () => {
    await seed('m-3');
    const { keyManagementService } = await import('../key-service');
    keyManagementService.clearKeys();
    await vi.waitFor(async () => {
      expect(await messagingDb.messaging_queued_messages.count()).toBe(0);
    });
  });
});
