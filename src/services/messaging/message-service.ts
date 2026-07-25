/**
 * Message Service for Encrypted Messaging
 * Tasks: T060-T065
 *
 * Handles encrypted message operations:
 * - Send encrypted messages to connections
 * - Retrieve and decrypt message history
 * - Mark messages as read/delivered
 */

import { createClient } from '@/lib/supabase/client';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  authContextFromSession,
  messagingProvider,
  type AuthContext,
  type MessagingDataProvider,
} from './providers';
import { encryptionService } from '@/lib/messaging/encryption';
import { keyManagementService } from './key-service';
import { groupKeyService } from './group-key-service';
import { offlineQueueService } from './offline-queue-service';
import { cacheService } from '@/lib/messaging/cache';
import { createLogger } from '@/lib/logger';
import { type MessageRow } from '@/lib/supabase/messaging-client';
import type {
  SendMessageInput,
  SendMessageResult,
  Message,
  MessageHistory,
  DecryptedMessage,
  UserProfile,
  EditMessageInput,
} from '@/types/messaging';
import {
  AuthenticationError,
  EncryptionError,
  EncryptionLockedError,
  ConnectionError,
  ValidationError,
  MESSAGE_CONSTRAINTS,
} from '@/types/messaging';

const logger = createLogger('messaging:messages');

/**
 * Get the authenticated user's session, retrying briefly so a transient
 * token-refresh window (where Supabase momentarily exposes session=null)
 * doesn't surface as an auth failure. Replaces a 6-line block that was
 * copy-pasted 8 times across this file — keeping the loop in one place
 * also means a fix to the retry strategy lands everywhere at once.
 *
 * @throws AuthenticationError with the supplied operation string in the
 * message if the retry budget is exhausted with no session.
 */
async function getSessionWithRetry(
  supabase: SupabaseClient,
  operation: string
): Promise<Session> {
  let session: Session | null = null;
  let authError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await supabase.auth.getSession();
    session = result.data?.session ?? null;
    authError = result.error;
    if (session?.user) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
  }
  if (authError || !session?.user) {
    throw new AuthenticationError(`You must be signed in to ${operation}`);
  }
  return session;
}

// Cache conversation participant data so sendMessage works offline after
// the first successful fetch. Keyed by conversation_id.
const conversationCache = new Map<
  string,
  {
    participant_1_id: string;
    participant_2_id: string;
    is_group: boolean;
    current_key_version?: number;
  }
>();

// Cache derived shared secrets so sendMessage can encrypt offline.
// Keyed by recipientId. Invalidated when the sender's CryptoKey
// object reference changes (new key derivation = new object).
const sharedSecretCache = new Map<string, CryptoKey>();
let cachedSenderPrivateKey: CryptoKey | null = null;

/** Check if conversation data is cached (for E2E test verification). */
export function isConversationCached(conversationId: string): boolean {
  return conversationCache.has(conversationId);
}

/**
 * Pre-populate conversation cache so sendMessage works offline.
 * Also pre-fetches the recipient's public key so getUserPublicKey
 * has a cache entry for offline encryption.
 */
export async function cacheConversationData(
  conversationId: string,
  data: {
    participant_1_id: string;
    participant_2_id: string;
    is_group: boolean;
    current_key_version?: number;
  }
): Promise<void> {
  conversationCache.set(conversationId, data);

  // Pre-fetch recipient's public key for offline support.
  // getUserPublicKey caches the result in keyManagementService.publicKeyCache
  // which is only used when offline (online requests always fetch fresh).
  if (!data.is_group) {
    try {
      const session = (await createClient().auth.getSession()).data?.session;
      const currentUserId = session?.user?.id;
      if (!currentUserId) return;

      const recipientId =
        data.participant_1_id === currentUserId
          ? data.participant_2_id
          : data.participant_1_id;

      if (recipientId) {
        // This populates keyManagementService.publicKeyCache as a side effect
        await keyManagementService.getUserPublicKey(recipientId);
      }
    } catch {
      // Non-fatal: public key will be fetched on first send (if online)
    }
  }
}

export class MessageService {
  /**
   * The messaging backend. Injected so tests can swap in a fake or the .NET
   * provider; defaults to the env-selected singleton (#266). Generalizes the
   * AdminPaymentService(supabase) constructor-injection precedent.
   */
  constructor(
    private readonly provider: MessagingDataProvider = messagingProvider
  ) {}

  /**
   * Send an encrypted message to a connection
   * Task: T061, T157 (updated for offline queue)
   *
   * Flow:
   * 1. Check if online (navigator.onLine)
   * 2. Initialize sender's keys if needed (lazy generation)
   * 3. Get recipient's public key
   * 4. Encrypt message content
   * 5. If offline: queue message for later sync
   * 6. If online: insert encrypted message to database
   * 7. On send failure: queue message with retry
   * 8. Return result
   *
   * @param input - SendMessageInput
   * @returns Promise<SendMessageResult> - Message and queued status
   * @throws AuthenticationError if not authenticated
   * @throws ValidationError if message invalid or recipient has no keys
   * @throws EncryptionError if encryption fails
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const supabase = createClient();

    // Validate message content
    const content = input.content.trim();

    if (content.length < MESSAGE_CONSTRAINTS.MIN_LENGTH) {
      throw new ValidationError('Message cannot be empty', 'content');
    }

    if (content.length > MESSAGE_CONSTRAINTS.MAX_LENGTH) {
      throw new ValidationError(
        `Message cannot exceed ${MESSAGE_CONSTRAINTS.MAX_LENGTH} characters`,
        'content'
      );
    }

    // Get authenticated user via getSession() — avoids server round-trip
    // that can fail when the access token is expired (getUser() calls the
    // server, while getSession() reads from localStorage and auto-refreshes).
    // On static exports, the Supabase client refreshes tokens transparently.
    // Retry getSession up to 3 times with 500ms delays.
    // Supabase token refresh briefly sets session=null — retrying
    // allows the refresh to complete before giving up.
    let session = null;
    let authError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.auth.getSession();
      session = result.data?.session;
      authError = result.error;
      logger.debug('sendMessage getSession attempt', {
        attempt: attempt + 1,
        hasSession: !!session,
        hasUser: !!session?.user,
        hasToken: !!session?.access_token,
        error: authError?.message || null,
        expiresAt: session?.expires_at,
      });
      if (session?.user) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
    }
    const user = session?.user;

    if (authError || !user) {
      // Surface localStorage auth-key state at debug level for diagnostics
      // when the retry budget is exhausted. Never includes token values.
      if (typeof window !== 'undefined') {
        const authKeys = Object.keys(localStorage).filter(
          (k) => k.includes('auth') || k.includes('sb-')
        );
        logger.error('sendMessage AUTH FAILED', {
          localStorageAuthKeys: authKeys,
        });
      }
      throw new AuthenticationError('You must be signed in to send messages');
    }

    // session/user are non-null past the guard above.
    const ctx = authContextFromSession(session as Session);

    try {
      // Get sender's derived keys from memory (derived on login).
      // If not in memory, attempt restore from localStorage cache
      // (covers page reload / race with EncryptionKeyGate).
      let senderKeys = keyManagementService.getCurrentKeys();
      if (!senderKeys) {
        await keyManagementService.restoreKeysFromCache(user.id);
        senderKeys = keyManagementService.getCurrentKeys();
      }
      if (!senderKeys) {
        throw new EncryptionLockedError(
          'Your encryption keys are not available. Please sign in again to send messages.'
        );
      }

      // Get conversation details (with cache for offline support)
      let conversation = conversationCache.get(input.conversation_id) ?? null;
      if (!conversation) {
        const data = await this.provider.getConversationMeta(
          ctx,
          input.conversation_id
        );

        if (!data) {
          throw new ValidationError(
            'Conversation not found',
            'conversation_id'
          );
        }
        const cached = {
          participant_1_id: data.participant_1_id ?? '',
          participant_2_id: data.participant_2_id ?? '',
          is_group: data.is_group,
          current_key_version: data.current_key_version ?? 1,
        };
        conversation = cached;
        conversationCache.set(input.conversation_id, cached);
      }

      // Encrypt the message content. Both paths produce the same
      // { ciphertext, iv } and a key_version to stamp on the row:
      //   - Group conversations use the shared symmetric group key
      //     (already distributed per-member on join) keyed by
      //     current_key_version.
      //   - 1-to-1 conversations derive a per-pair ECDH shared secret.
      let encrypted: Awaited<
        ReturnType<typeof encryptionService.encryptMessage>
      >;
      let keyVersion = 1;

      if (conversation.is_group) {
        keyVersion = conversation.current_key_version ?? 1;
        const groupKey = await groupKeyService.getGroupKeyForConversation(
          input.conversation_id,
          keyVersion
        );
        encrypted = await encryptionService.encryptMessage(content, groupKey);
      } else {
        const recipientId =
          conversation.participant_1_id === user.id
            ? conversation.participant_2_id
            : conversation.participant_1_id;

        if (!recipientId) {
          throw new ValidationError(
            'Invalid conversation: no recipient found',
            'conversation_id'
          );
        }

        // Invalidate shared secret cache if sender's keys changed
        // (e.g. after resetEncryptionKeys + ReAuthModal re-derivation).
        if (cachedSenderPrivateKey !== senderKeys.privateKey) {
          sharedSecretCache.clear();
          cachedSenderPrivateKey = senderKeys.privateKey;
        }

        // Get or derive shared secret for this recipient
        let sharedSecret = sharedSecretCache.get(recipientId) ?? null;
        const sharedSecretSource = sharedSecret ? 'cache' : 'derive';
        if (!sharedSecret) {
          const recipientPublicKey =
            await keyManagementService.getUserPublicKey(recipientId);

          if (!recipientPublicKey) {
            throw new ValidationError(
              "This person needs to sign in before you can message them. Messages cannot be delivered until they've logged in at least once to set up encryption.",
              'conversation_id'
            );
          }

          const recipientPublicKeyCrypto = await crypto.subtle.importKey(
            'jwk',
            recipientPublicKey,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
          );

          sharedSecret = await encryptionService.deriveSharedSecret(
            senderKeys.privateKey,
            recipientPublicKeyCrypto
          );
          sharedSecretCache.set(recipientId, sharedSecret);
        }

        logger.debug('sendMessage sharedSecret', {
          source: sharedSecretSource,
          recipientIdPrefix: recipientId.slice(0, 8),
          online: navigator.onLine,
        });

        // Encrypt message content
        encrypted = await encryptionService.encryptMessage(
          content,
          sharedSecret
        );
      }

      // Check if online - if offline, queue immediately
      if (!navigator.onLine) {
        const messageId = crypto.randomUUID();
        await offlineQueueService.queueMessage({
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          content,
          key_version: keyVersion,
        });

        // Return a placeholder message object
        const queuedMessage: Message = {
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          sequence_number: 0, // Will be assigned when synced
          deleted: false,
          edited: false,
          edited_at: null,
          delivered_at: null,
          read_at: null,
          created_at: new Date().toISOString(),
          key_version: keyVersion,
          is_system_message: false,
          system_message_type: null,
          // #245: the queued id IS the idempotency key the sync flush will send.
          client_generated_id: messageId,
        };

        return {
          message: queuedMessage,
          queued: true, // Message queued for later sync
        };
      }

      // Online - attempt to send to database.
      //
      // The provider owns the atomic sequence-number assignment + retry loop
      // (C13) and the last_message_at bump. It throws on non-recoverable
      // failure, which falls through to the offline-queue catch below — the
      // service still owns that fallback because it's backend-agnostic.
      try {
        const message = await this.provider.sendMessage(ctx, {
          conversationId: input.conversation_id,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          keyVersion,
          // Live sends carry a NULL idempotency key (offline flushes set it).
          clientGeneratedId: null,
        });

        return {
          message,
          queued: false, // Not queued (successful send)
        };
      } catch (sendError) {
        // Online but send failed - queue with retry
        const messageId = crypto.randomUUID();
        await offlineQueueService.queueMessage({
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          content,
          key_version: keyVersion,
        });

        // Return a placeholder message object
        const queuedMessage: Message = {
          id: messageId,
          conversation_id: input.conversation_id,
          sender_id: user.id,
          encrypted_content: encrypted.ciphertext,
          initialization_vector: encrypted.iv,
          sequence_number: 0, // Will be assigned when synced
          deleted: false,
          edited: false,
          edited_at: null,
          delivered_at: null,
          read_at: null,
          created_at: new Date().toISOString(),
          key_version: keyVersion,
          is_system_message: false,
          system_message_type: null,
          // #245: the queued id IS the idempotency key the sync flush will send.
          client_generated_id: messageId,
        };

        return {
          message: queuedMessage,
          queued: true, // Message queued for retry
        };
      }
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof EncryptionError ||
        error instanceof EncryptionLockedError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to send message', error);
    }
  }

  /**
   * Get message history for a conversation with pagination
   * Task: T062, T167 (updated with caching and offline support)
   *
   * Retrieves encrypted messages from the database and decrypts them for display.
   * Messages that fail to decrypt are shown with a placeholder text.
   *
   * Offline support:
   * - If online: fetch from database and cache results
   * - If offline: fallback to cached messages from IndexedDB
   *
   * @param conversationId - UUID of the conversation to fetch messages from
   * @param cursor - Sequence number to start from for pagination (null fetches latest messages)
   * @param limit - Maximum number of messages to fetch (default: 50, max: 50)
   * @returns Promise<MessageHistory> - Decrypted messages in chronological order with pagination info
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if conversation not found
   * @throws EncryptionError if encryption keys cannot be initialized
   * @throws ConnectionError if database query fails
   *
   * @example
   * ```typescript
   * // Fetch latest 50 messages
   * const result = await messageService.getMessageHistory(conversationId);
   *
   * // Fetch next page
   * const nextPage = await messageService.getMessageHistory(
   *   conversationId,
   *   result.cursor,
   *   50
   * );
   * ```
   */
  async getMessageHistory(
    conversationId: string,
    cursor: number | null = null,
    limit: number = 50
  ): Promise<MessageHistory> {
    const supabase = createClient();

    // Get authenticated user (retries through token refresh)
    const session = await getSessionWithRetry(supabase, 'view messages');
    const user = session.user;
    const ctx = authContextFromSession(session);

    try {
      // Variables to hold messages across different code paths
      let messages: MessageRow[] = [];
      let hasMore: boolean = false;
      let messagesToDecrypt: MessageRow[] = [];

      // If offline, try to load from cache
      if (!navigator.onLine) {
        const cachedMessages = await cacheService.getCachedMessages(
          conversationId,
          limit
        );

        // If we have cached messages, return them (already in Message format)
        // Note: Cached messages are encrypted, so we still need to decrypt them
        // Fall through to normal decryption logic below with cached messages
        if (cachedMessages.length > 0) {
          // Use cached messages variable in place of database query result
          messages = cachedMessages;
          hasMore = false; // Can't determine has_more from cache
          messagesToDecrypt = messages;

          // Skip to decryption section (conversation and key fetching below)
        } else {
          // No cached messages and offline - return empty
          return {
            messages: [],
            has_more: false,
            cursor: null,
          };
        }
      }

      // Online - fetch from database via the provider.
      // Note: deleted messages are NOT filtered out — they render as
      // placeholders in MessageBubble so sequence numbers and threading
      // stay intact. MessageBubble checks `message.deleted` before
      // `message.decryptionError`, so deleted-message rendering wins even if
      // decryption fails. The provider fetches limit+1 and returns the page
      // sliced to `limit` with hasMore already computed.
      if (navigator.onLine) {
        try {
          const page = await this.provider.getMessages(ctx, {
            conversationId,
            cursor,
            limit,
          });
          // Successfully fetched from database
          messages = page.rows;
          hasMore = page.hasMore;
          messagesToDecrypt = page.rows;

          // Cache the fetched messages for offline use
          if (page.rows.length > 0) {
            await cacheService.cacheMessages(conversationId, messagesToDecrypt);
          }
        } catch (fetchError) {
          // Failed to fetch - try cache fallback
          const cachedMessages = await cacheService.getCachedMessages(
            conversationId,
            limit
          );

          if (cachedMessages.length > 0) {
            messages = cachedMessages;
            hasMore = false;
            messagesToDecrypt = messages;
          } else {
            throw fetchError instanceof ConnectionError
              ? fetchError
              : new ConnectionError(
                  'Failed to fetch messages: ' + String(fetchError)
                );
          }
        }
      }

      // Variables messages, hasMore, messagesToDecrypt are set above in either path

      // Get conversation details for decryption
      const conversation = await this.provider.getConversationMeta(
        ctx,
        conversationId
      );

      if (!conversation) {
        throw new ValidationError('Conversation not found', 'conversationId');
      }

      // Group conversations use symmetric encryption: each message is decrypted
      // with the group key at that message's key_version (so messages sent
      // before a key rotation still decrypt). Resolve keys lazily + cache by
      // version to avoid re-deriving per message.
      if (conversation.is_group) {
        return await this.getGroupMessageHistory({
          ctx,
          conversationId,
          userId: user.id,
          messagesToDecrypt,
          hasMore,
        });
      }

      // Determine other participant (1-to-1 only)
      const otherParticipantId =
        conversation.participant_1_id === user.id
          ? conversation.participant_2_id
          : conversation.participant_1_id;

      if (!otherParticipantId) {
        throw new ValidationError(
          'Invalid conversation: no recipient found',
          'conversationId'
        );
      }

      // Get both users' profiles for display names
      const profiles = await this.provider.getProfiles(ctx, [
        user.id,
        otherParticipantId,
      ]);

      const profileMap = new Map<string, UserProfile>();
      profiles.forEach((profile) => {
        profileMap.set(profile.id, profile);
      });

      // If no messages, just return empty array (no need for keys)
      if (messagesToDecrypt.length === 0) {
        return {
          messages: [],
          has_more: false,
          cursor: null,
        };
      }

      // Get private key for decryption from memory (with cache restore fallback)
      logger.debug('Starting decryption', { conversationId });
      let currentKeys = keyManagementService.getCurrentKeys();
      if (!currentKeys) {
        await keyManagementService.restoreKeysFromCache(user.id);
        currentKeys = keyManagementService.getCurrentKeys();
      }

      if (!currentKeys) {
        logger.error(
          'CRITICAL: Encryption keys not available - user needs to re-authenticate'
        );
        throw new EncryptionLockedError(
          'Your encryption keys are not available. Please sign in again to view messages.'
        );
      }

      logger.debug('Keys available in memory', { userId: user.id });

      // Get other participant's public key
      logger.debug('Fetching public key for other user', {
        otherParticipantId,
      });
      const otherPublicKey =
        await keyManagementService.getUserPublicKey(otherParticipantId);
      logger.debug('Other user public key', {
        status: otherPublicKey ? 'FOUND' : 'MISSING',
      });

      if (!otherPublicKey) {
        // Cannot decrypt messages without other user's public key
        // This shouldn't happen if messages exist, but handle gracefully
        logger.error(
          'CRITICAL: Cannot decrypt - other user has no public key',
          { otherParticipantId }
        );
        return {
          messages: [],
          has_more: false,
          cursor: null,
        };
      }

      // Derive a fresh shared secret per call. An earlier batch reused the
      // module-level sharedSecretCache here (matching sendMessage's pattern)
      // but it caused a real Firefox/WebKit messaging E2E regression — the
      // cached CryptoKey reference behaves differently across reload + tab
      // contexts on those browsers, and polling could see stale or mismatched
      // shared secrets. Reverted in hotfix until a browser-safe instance-aware
      // cache key is designed. Fresh derivation is ~6 ECDH derivations/min
      // under polling — measurable but not user-perceivable.
      logger.debug('Importing other user public key via crypto.subtle');
      const otherPublicKeyCrypto = await crypto.subtle.importKey(
        'jwk',
        otherPublicKey,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        false,
        []
      );
      logger.debug('Other user public key imported successfully');

      // Derive shared secret using our derived private key
      const sharedSecret = await encryptionService.deriveSharedSecret(
        currentKeys.privateKey,
        otherPublicKeyCrypto
      );

      // Log key fingerprints for E2E diagnostics (debug-suppressed in prod)
      const otherKeyFingerprint = otherPublicKey?.x?.slice(0, 8) ?? 'null';
      logger.debug('getMessageHistory decrypt', {
        myIdPrefix: user.id.slice(0, 8),
        otherIdPrefix: otherParticipantId.slice(0, 8),
        otherPubKey: otherKeyFingerprint,
        msgCount: messagesToDecrypt.length,
      });

      // Decrypt all messages
      logger.debug('Decrypting messages', {
        count: messagesToDecrypt.length,
        currentUserId: user.id,
        otherParticipantId,
      });
      const decryptedMessages: DecryptedMessage[] = await Promise.all(
        messagesToDecrypt.map(async (msg) => {
          try {
            const content = await encryptionService.decryptMessage(
              msg.encrypted_content,
              msg.initialization_vector,
              sharedSecret
            );

            const senderProfile = profileMap.get(msg.sender_id);

            return {
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              content,
              sequence_number: msg.sequence_number,
              deleted: msg.deleted,
              edited: msg.edited,
              edited_at: msg.edited_at,
              delivered_at: msg.delivered_at,
              read_at: msg.read_at,
              created_at: msg.created_at,
              isOwn: msg.sender_id === user.id,
              senderName:
                senderProfile?.display_name ||
                senderProfile?.username ||
                'Unknown',
            };
          } catch (decryptError) {
            // Log the decryption failure with details (but not sensitive data).
            // Single logger.error call below is sufficient — the previous
            // duplicate console.error was redundant noise in production.
            const err = decryptError as Error;
            logger.error('Decryption FAILED for message', {
              messageId: msg.id,
              errorName: String(err.name || 'unknown'),
              errorMessage: String(err.message || 'no message'),
              senderId: msg.sender_id,
              contentLength: msg.encrypted_content?.length || 0,
              ivLength: msg.initialization_vector?.length || 0,
              createdAt: msg.created_at,
            });
            const senderProfile = profileMap.get(msg.sender_id);
            return {
              id: msg.id,
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              content: 'Encrypted with previous keys',
              sequence_number: msg.sequence_number,
              deleted: msg.deleted,
              edited: msg.edited,
              edited_at: msg.edited_at,
              delivered_at: msg.delivered_at,
              read_at: msg.read_at,
              created_at: msg.created_at,
              isOwn: msg.sender_id === user.id,
              senderName:
                senderProfile?.display_name ||
                senderProfile?.username ||
                'Unknown User',
              decryptionError: true,
            };
          }
        })
      );
      logger.debug('Completed decryption', { count: decryptedMessages.length });

      // Reverse to chronological order (oldest first)
      decryptedMessages.reverse();

      return {
        messages: decryptedMessages,
        has_more: hasMore,
        cursor:
          decryptedMessages.length > 0
            ? decryptedMessages[0].sequence_number
            : null,
      };
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof EncryptionError ||
        error instanceof EncryptionLockedError ||
        error instanceof ConnectionError ||
        error instanceof ValidationError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to get message history', error);
    }
  }

  /**
   * Decrypt a page of GROUP-conversation messages.
   *
   * Unlike 1:1 (one ECDH shared secret for the whole page), each group message
   * is decrypted with the symmetric group key at its own `key_version` — so
   * messages sent before a key rotation still decrypt. Group keys are resolved
   * lazily and cached per version (groupKeyService also caches internally).
   * Decryption failures degrade to a placeholder, matching the 1:1 path.
   */
  private async getGroupMessageHistory(params: {
    ctx: AuthContext;
    conversationId: string;
    userId: string;
    messagesToDecrypt: Message[];
    hasMore: boolean;
  }): Promise<MessageHistory> {
    const { ctx, conversationId, userId, messagesToDecrypt, hasMore } = params;

    if (messagesToDecrypt.length === 0) {
      return { messages: [], has_more: false, cursor: null };
    }

    // Fetch display profiles for every distinct sender in this page.
    const senderIds = [...new Set(messagesToDecrypt.map((m) => m.sender_id))];
    const profiles = await this.provider.getProfiles(ctx, senderIds);
    const profileMap = new Map<string, UserProfile>();
    profiles.forEach((p) => profileMap.set(p.id, p));

    // Resolve (and memoize) the group key for a given key_version.
    const keyByVersion = new Map<number, Promise<CryptoKey>>();
    const groupKeyFor = (version: number): Promise<CryptoKey> => {
      let keyPromise = keyByVersion.get(version);
      if (!keyPromise) {
        keyPromise = groupKeyService.getGroupKeyForConversation(
          conversationId,
          version
        );
        keyByVersion.set(version, keyPromise);
      }
      return keyPromise;
    };

    const decryptedMessages: DecryptedMessage[] = await Promise.all(
      messagesToDecrypt.map(async (msg) => {
        const senderProfile = profileMap.get(msg.sender_id);
        const base = {
          id: msg.id,
          conversation_id: msg.conversation_id,
          sender_id: msg.sender_id,
          sequence_number: msg.sequence_number,
          deleted: msg.deleted,
          edited: msg.edited,
          edited_at: msg.edited_at,
          delivered_at: msg.delivered_at,
          read_at: msg.read_at,
          created_at: msg.created_at,
          isOwn: msg.sender_id === userId,
          senderName:
            senderProfile?.display_name || senderProfile?.username || 'Unknown',
        };
        try {
          const groupKey = await groupKeyFor(msg.key_version ?? 1);
          const content = await encryptionService.decryptMessage(
            msg.encrypted_content,
            msg.initialization_vector,
            groupKey
          );
          return { ...base, content };
        } catch (decryptError) {
          const err = decryptError as Error;
          logger.error('Group message decryption FAILED', {
            messageId: msg.id,
            keyVersion: msg.key_version,
            errorName: String(err.name || 'unknown'),
            errorMessage: String(err.message || 'no message'),
          });
          return {
            ...base,
            content: 'Encrypted with previous keys',
            decryptionError: true,
          };
        }
      })
    );

    // Chronological order (oldest first), matching the 1:1 path.
    decryptedMessages.reverse();

    return {
      messages: decryptedMessages,
      has_more: hasMore,
      cursor:
        decryptedMessages.length > 0
          ? decryptedMessages[0].sequence_number
          : null,
    };
  }

  /**
   * Mark messages as read by updating their read_at timestamp
   * Task: T063
   *
   * Updates the read_at field for messages that haven't been read yet.
   * Only affects messages where read_at is currently null.
   * This operation is silent - errors won't be thrown to avoid disrupting message viewing.
   *
   * @param messageIds - Array of message UUIDs to mark as read
   * @returns Promise<void> - Completes silently, even if some messages fail to update
   * @throws AuthenticationError if user is not signed in
   * @throws ConnectionError if database update completely fails
   *
   * @example
   * ```typescript
   * // Mark unread messages as read when user views conversation
   * const unreadMessages = messages.filter(m => !m.isOwn && !m.read_at);
   * const messageIds = unreadMessages.map(m => m.id);
   * await messageService.markAsRead(messageIds);
   * ```
   */
  async markAsRead(messageIds: string[]): Promise<void> {
    const supabase = createClient();

    const session = await getSessionWithRetry(
      supabase,
      'mark messages as read'
    );
    const ctx = authContextFromSession(session);

    if (messageIds.length === 0) {
      return;
    }

    logger.debug('markAsRead called', { count: messageIds.length });
    try {
      await this.provider.markAsRead(ctx, messageIds);
      logger.debug('markAsRead success', { count: messageIds.length });
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to mark messages as read', error);
    }
  }

  /**
   * Mark messages as delivered by setting delivered_at timestamp
   *
   * Sets delivered_at for messages that haven't been marked delivered yet.
   * Called when recipient's page loads messages from another user.
   * Delivery is distinct from read — delivery means the message reached
   * the recipient's client, read means they viewed it.
   *
   * Failures are logged but not thrown — delivery receipts should never
   * break the UI.
   *
   * @param messageIds - Array of message UUIDs to mark as delivered
   */
  async markAsDelivered(messageIds: string[]): Promise<void> {
    const supabase = createClient();

    const session = await getSessionWithRetry(
      supabase,
      'mark messages as delivered'
    );
    const ctx = authContextFromSession(session);

    if (messageIds.length === 0) {
      return;
    }

    logger.debug('markAsDelivered called', { count: messageIds.length });
    try {
      await this.provider.markAsDelivered(ctx, messageIds);
      logger.debug('markAsDelivered success', { count: messageIds.length });
    } catch (error) {
      // Silent failure — delivery receipts shouldn't break the UI
      logger.error('Failed to mark messages as delivered', { error });
    }
  }

  /**
   * Edit a message within the 15-minute window
   * Task: T105
   *
   * Re-encrypts the message content with new plaintext and updates the database.
   * Only allows editing if:
   * - User is the message sender
   * - Message is within 15-minute edit window
   * - Message is not deleted
   *
   * @param input - EditMessageInput with message_id and new_content
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if message not found, not owned, or outside edit window
   * @throws EncryptionError if re-encryption fails
   * @throws ConnectionError if database update fails
   *
   * @example
   * ```typescript
   * await messageService.editMessage({
   *   message_id: '123e4567-e89b-12d3-a456-426614174000',
   *   new_content: 'Updated message text'
   * });
   * ```
   */
  async editMessage(input: {
    message_id: string;
    new_content: string;
  }): Promise<void> {
    const supabase = createClient();

    // Validate new content
    const content = input.new_content.trim();

    if (content.length < MESSAGE_CONSTRAINTS.MIN_LENGTH) {
      throw new ValidationError('Message cannot be empty', 'new_content');
    }

    if (content.length > MESSAGE_CONSTRAINTS.MAX_LENGTH) {
      throw new ValidationError(
        `Message cannot exceed ${MESSAGE_CONSTRAINTS.MAX_LENGTH} characters`,
        'new_content'
      );
    }

    const session = await getSessionWithRetry(supabase, 'edit messages');
    const user = session.user;
    const ctx = authContextFromSession(session);

    try {
      // Get the message to edit
      const message = await this.provider.getMessageById(ctx, input.message_id);

      if (!message) {
        throw new ValidationError('Message not found', 'message_id');
      }

      // Verify ownership
      if (message.sender_id !== user.id) {
        throw new ValidationError(
          'You can only edit your own messages',
          'message_id'
        );
      }

      // Check if already deleted
      if (message.deleted) {
        throw new ValidationError(
          'Cannot edit a deleted message',
          'message_id'
        );
      }

      // Check 15-minute window
      const createdAt = new Date(message.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

      if (diffMinutes > MESSAGE_CONSTRAINTS.EDIT_WINDOW_MINUTES) {
        throw new ValidationError(
          `Messages can only be edited within ${MESSAGE_CONSTRAINTS.EDIT_WINDOW_MINUTES} minutes`,
          'message_id'
        );
      }

      // Get conversation details for encryption
      const conversation = await this.provider.getConversationMeta(
        ctx,
        message.conversation_id
      );

      if (!conversation) {
        throw new ValidationError('Conversation not found', 'conversation_id');
      }

      // Re-encrypt the edited content. Groups use the current group key
      // (a rotation may have happened since the original send, so re-key to
      // the latest version); 1:1 derives the per-pair ECDH shared secret.
      let encrypted: Awaited<
        ReturnType<typeof encryptionService.encryptMessage>
      >;
      let keyVersion = 1;

      if (conversation.is_group) {
        keyVersion = conversation.current_key_version ?? 1;
        const groupKey = await groupKeyService.getGroupKeyForConversation(
          message.conversation_id,
          keyVersion
        );
        encrypted = await encryptionService.encryptMessage(content, groupKey);
      } else {
        // Determine recipient ID (1-to-1 only)
        const recipientId =
          conversation.participant_1_id === user.id
            ? conversation.participant_2_id
            : conversation.participant_1_id;

        if (!recipientId) {
          throw new ValidationError(
            'Invalid conversation: no recipient found',
            'conversation_id'
          );
        }

        // Get sender's derived keys from memory (with cache restore fallback)
        let senderKeys = keyManagementService.getCurrentKeys();
        if (!senderKeys) {
          await keyManagementService.restoreKeysFromCache(user.id);
          senderKeys = keyManagementService.getCurrentKeys();
        }
        if (!senderKeys) {
          throw new EncryptionLockedError(
            'Your encryption keys are not available. Please sign in again to edit messages.'
          );
        }

        // Get recipient's public key
        const recipientPublicKey =
          await keyManagementService.getUserPublicKey(recipientId);

        if (!recipientPublicKey) {
          throw new EncryptionError(
            'Cannot edit message: recipient encryption keys not available'
          );
        }

        // Import recipient's public key
        const recipientPublicKeyCrypto = await crypto.subtle.importKey(
          'jwk',
          recipientPublicKey,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          []
        );

        // Derive shared secret using sender's derived private key
        const sharedSecret = await encryptionService.deriveSharedSecret(
          senderKeys.privateKey,
          recipientPublicKeyCrypto
        );

        // Encrypt new content
        encrypted = await encryptionService.encryptMessage(
          content,
          sharedSecret
        );
      }

      // Update message in database
      await this.provider.editMessage(ctx, {
        messageId: input.message_id,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        keyVersion,
      });
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof EncryptionError ||
        error instanceof EncryptionLockedError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new EncryptionError('Failed to edit message', error);
    }
  }

  /**
   * Delete a message within the 15-minute window (soft delete)
   * Task: T106
   *
   * Marks a message as deleted without removing it from the database.
   * Only allows deletion if:
   * - User is the message sender
   * - Message is within 15-minute delete window
   * - Message is not already deleted
   *
   * @param message_id - UUID of the message to delete
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if message not found, not owned, or outside delete window
   * @throws ConnectionError if database update fails
   *
   * @example
   * ```typescript
   * await messageService.deleteMessage('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async deleteMessage(message_id: string): Promise<void> {
    const supabase = createClient();

    const session = await getSessionWithRetry(supabase, 'delete messages');
    const user = session.user;
    const ctx = authContextFromSession(session);

    try {
      // Get the message to delete
      const message = await this.provider.getMessageById(ctx, message_id);

      if (!message) {
        throw new ValidationError('Message not found', 'message_id');
      }

      // Verify ownership
      if (message.sender_id !== user.id) {
        throw new ValidationError(
          'You can only delete your own messages',
          'message_id'
        );
      }

      // Check if already deleted
      if (message.deleted) {
        throw new ValidationError('Message is already deleted', 'message_id');
      }

      // Check 15-minute window
      const createdAt = new Date(message.created_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

      if (diffMinutes > MESSAGE_CONSTRAINTS.DELETE_WINDOW_MINUTES) {
        throw new ValidationError(
          `Messages can only be deleted within ${MESSAGE_CONSTRAINTS.DELETE_WINDOW_MINUTES} minutes`,
          'message_id'
        );
      }

      // Soft delete - set deleted flag
      await this.provider.deleteMessage(ctx, message_id);
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to delete message', error);
    }
  }

  /**
   * Archive a conversation for the current user
   * Per-user archive: User A archiving doesn't affect User B's view
   *
   * @param conversationId - UUID of the conversation to archive
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if conversation not found or user not a participant
   * @throws ConnectionError if database update fails
   */
  async archiveConversation(conversationId: string): Promise<void> {
    const supabase = createClient();

    const session = await getSessionWithRetry(
      supabase,
      'archive conversations'
    );
    const ctx = authContextFromSession(session);

    try {
      // The provider owns the group-vs-1:1 branch + participant-column logic;
      // it throws ValidationError/ConnectionError with identical semantics.
      await this.provider.archiveConversation(ctx, conversationId);
      logger.debug('archiveConversation success', { conversationId });
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to archive conversation', error);
    }
  }

  /**
   * Unarchive a conversation for the current user
   *
   * @param conversationId - UUID of the conversation to unarchive
   * @returns Promise<void>
   * @throws AuthenticationError if user is not signed in
   * @throws ValidationError if conversation not found or user not a participant
   * @throws ConnectionError if database update fails
   */
  async unarchiveConversation(conversationId: string): Promise<void> {
    const supabase = createClient();

    const session = await getSessionWithRetry(
      supabase,
      'unarchive conversations'
    );
    const ctx = authContextFromSession(session);

    try {
      await this.provider.unarchiveConversation(ctx, conversationId);
      logger.debug('unarchiveConversation success', { conversationId });
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof ConnectionError
      ) {
        throw error;
      }
      throw new ConnectionError('Failed to unarchive conversation', error);
    }
  }
}

// Export singleton instance
export const messageService = new MessageService();
