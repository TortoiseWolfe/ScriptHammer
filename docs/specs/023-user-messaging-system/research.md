# Phase 0: Research - Existing Codebase Analysis

**Generated**: 2025-10-08 | **For**: User Messaging System (PRP-023)

## Purpose

Analyze ScriptHammer's existing patterns for Supabase integration, offline support, real-time subscriptions, and authentication to ensure the messaging system follows established conventions.

## Key Findings Summary

✅ **Strong Foundation Exists**:

- Supabase client singleton pattern (client + server)
- Offline queue with IndexedDB (payment system)
- Authentication context with auto-refresh
- RLS policy enforcement patterns
- Row-level security examples (payment + auth)
- Mobile-first component patterns (44px touch targets)
- 5-file component structure enforced via CI/CD

⚠️ **New Requirements**:

- Supabase Realtime subscriptions (payment uses this - can reuse pattern)
- End-to-end encryption (new - Web Crypto API)
- Dexie.js wrapper (new dependency for IndexedDB)
- Message threading/conversation UI (new component patterns)

## 1. Supabase Integration Patterns

### Client Singleton Pattern

**Location**: `src/lib/supabase/client.ts`

```typescript
// Singleton pattern - reuse this for messaging
let supabaseInstance: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials');
  }

  supabaseInstance = createSupabaseClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { timeout: 10000 }, // Used by payment system
    }
  );

  return supabaseInstance;
}

// Export instance for imports
export const supabase = createClient();
```

**Findings for Messaging**:

- ✅ Realtime already configured (`realtime: { timeout: 10000 }`)
- ✅ Auto-refresh tokens enabled
- ✅ Persistent sessions
- **Action**: Reuse `supabase` instance from `src/lib/supabase/client.ts`

### Server-Side Pattern

**Location**: `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

- Server components use `@supabase/ssr` with cookie management
- Middleware automatically refreshes sessions
- Protected routes pattern already implemented

**Findings for Messaging**:

- ✅ Server-side authentication handled
- **Action**: API routes for messaging (e.g., `/api/messages/send`) can use server patterns

## 2. Authentication & Authorization

### Auth Context Pattern

**Location**: `src/contexts/AuthContext.tsx`

```typescript
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
}

// Usage in messaging:
const { user, session, isAuthenticated } = useAuth();
if (!isAuthenticated) return <SignInPrompt />;
```

**Findings for Messaging**:

- ✅ `useAuth()` hook available
- ✅ `user.id` for user_id fields
- ✅ `session` for RLS enforcement
- **Action**: Use `useAuth()` in all messaging components

### RLS Policy Pattern

**Location**: `supabase/migrations/20251006_complete_monolithic_setup.sql`

```sql
-- Payment intent pattern (lines 495-505)
CREATE POLICY "Users can view own payment intents" ON payment_intents
  FOR SELECT USING (auth.uid() = template_user_id);

CREATE POLICY "Users can create own payment intents" ON payment_intents
  FOR INSERT WITH CHECK (auth.uid() = template_user_id);

CREATE POLICY "Payment intents are immutable" ON payment_intents
  FOR UPDATE USING (false);

-- User profiles pattern (lines 548-555)
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

**Findings for Messaging**:

- ✅ `auth.uid()` for current user
- ✅ Immutability pattern for sensitive data
- ✅ User isolation via foreign keys
- **Action**: Apply similar patterns to:
  - `user_connections` (requester_id, addressee_id)
  - `conversations` (participant_1_id, participant_2_id)
  - `messages` (sender_id)
  - `user_encryption_keys` (user_id)

## 3. Offline Queue Pattern

### IndexedDB Queue (Payment System)

**Location**: `src/lib/payments/offline-queue.ts`

**Current Implementation**:

```typescript
// Uses native IndexedDB
const DB_NAME = 'scripthammer_offline';
const STORE_NAME = 'queue';
const DB_VERSION = 1;

interface QueuedOperation {
  id: string;
  type: 'payment_intent' | 'subscription';
  data: unknown;
  timestamp: number;
  retries: number;
  status: 'pending' | 'processing' | 'failed';
}

// Queue operation
export async function queueOperation(
  type: QueuedOperation['type'],
  data: unknown
): Promise<string> {
  const db = await openDatabase();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const operation: QueuedOperation = {
    id: crypto.randomUUID(),
    type,
    data,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };

  await store.add(operation);
  return operation.id;
}
```

**Findings for Messaging**:

- ✅ Offline queue pattern exists
- ⚠️ Currently uses raw IndexedDB API
- ⚠️ No TypeScript-friendly wrapper
- **Action**: Add Dexie.js for better TypeScript support in messaging
  - Dexie provides:
    - Type-safe queries
    - Automatic index management
    - Observable queries
    - Better error handling

### Connection Status Detection

**Location**: `src/hooks/useOfflineStatus.ts`

```typescript
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

**Findings for Messaging**:

- ✅ Reusable hook for online/offline detection
- **Action**: Use in message send flow to trigger queue

## 4. Real-time Subscriptions (Payment System Example)

**Location**: Payment system uses Realtime for webhook processing

**Pattern to Apply to Messaging**:

```typescript
// Subscribe to new messages in conversation
const channel = supabase
  .channel(`conversation-${conversationId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    handleNewMessage
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    handleEditedMessage
  )
  .subscribe();

// Cleanup
return () => {
  supabase.removeChannel(channel);
};
```

**Findings**:

- ✅ Supabase client already configured for Realtime
- ✅ `postgres_changes` event type for database triggers
- **Action**: Create `useConversationRealtime` hook

## 5. Component Structure Requirements

### 5-File Pattern (Enforced)

**Location**: Component generator + CI/CD validation

**Every component MUST have**:

1. `index.tsx` - Barrel export
2. `ComponentName.tsx` - Main component
3. `ComponentName.test.tsx` - Unit tests (MANDATORY)
4. `ComponentName.stories.tsx` - Storybook stories (MANDATORY)
5. `ComponentName.accessibility.test.tsx` - A11y tests (MANDATORY)

**Generator Usage**:

```bash
docker compose exec scripthammer pnpm run generate:component -- \
  --name MessageBubble \
  --category atomic \
  --hasProps true \
  --withHooks false
```

**Findings for Messaging**:

- ✅ CI/CD will FAIL if components missing files
- ✅ Generator creates correct structure
- **Action**: Generate all messaging components using generator
  - Atomic: MessageBubble, MessageInput, TypingIndicator, ReadReceipt
  - Molecular: ConversationListItem, UserSearch, ChatHeader
  - Organisms: ChatWindow, MessageThread, ConversationList, ConnectionManager

### Mobile-First Standards (PRP-017)

**Location**: `src/config/touch-targets.ts`

```typescript
// Minimum touch target size (WCAG AAA / Apple HIG)
export const MIN_TOUCH_TARGET = 44; // 44×44px in Tailwind: min-h-11 min-w-11

// Apply to all interactive elements
<button className="btn btn-primary min-h-11 min-w-11">Send</button>
<Link href="/messages" className="inline-block min-h-11 min-w-11">Messages</Link>
```

**Findings for Messaging**:

- ✅ 44×44px standard enforced
- ✅ Tailwind class: `min-h-11 min-w-11` (44px = 11 × 4px)
- **Action**: Apply to all message buttons, links, input controls

## 6. Type Safety Patterns

### Supabase Database Types

**Location**: `src/lib/supabase/types.ts`

- Generated from Supabase schema
- Provides type-safe queries
- Update after database migrations

**Action for Messaging**:

1. Create migration: `supabase/migrations/20251008_user_messaging_system.sql`
2. Run migration
3. Regenerate types: `pnpm supabase gen types typescript --local > src/lib/supabase/types.ts`
4. Create `src/types/messaging.ts` for application-level types

### Service Pattern

**Location**: `src/lib/payments/payment-service.ts`

```typescript
// High-level service functions
export async function createPaymentIntent(...): Promise<PaymentIntent> {
  // 1. Validate inputs
  validatePaymentAmount(amount);

  // 2. Get authenticated user
  const userId = await getAuthenticatedUserId();

  // 3. Check if online
  const isOnline = await isSupabaseOnline();
  if (!isOnline) {
    await queueOperation('payment_intent', data);
    throw new Error('Queued for offline sync');
  }

  // 4. Execute database operation
  const { data, error } = await supabase
    .from('payment_intents')
    .insert({ ...data, template_user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

**Findings for Messaging**:

- ✅ Service layer pattern for business logic
- ✅ Authentication checks centralized
- ✅ Offline handling integrated
- **Action**: Create similar services:
  - `src/services/messaging/connection-service.ts`
  - `src/services/messaging/message-service.ts`
  - `src/services/messaging/key-service.ts`

## 7. Testing Patterns

### Unit Testing (Vitest)

**Location**: `src/lib/avatar/__tests__/validation.test.ts` (example)

```typescript
import { describe, it, expect } from 'vitest';
import { validateAvatarFile } from '../validation';

describe('validateAvatarFile', () => {
  it('should accept valid JPEG file', () => {
    const result = validateAvatarFile(mockJpegFile);
    expect(result.valid).toBe(true);
  });

  it('should reject files over 5MB', () => {
    const result = validateAvatarFile(largeMockFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5MB');
  });
});
```

**Findings for Messaging**:

- ✅ Vitest configured with MSW for API mocking
- **Action**: 100% coverage for crypto functions

### Integration Testing

**Location**: `tests/integration/auth/` (example pattern)

```typescript
import { createClient } from '@supabase/supabase-js';

describe('Message RLS Policies', () => {
  it('user can only view own messages', async () => {
    // Test RLS enforcement
    const { data, error } = await supabase.from('messages').select('*');

    // Should only return messages user is participant in
    expect(
      data?.every(
        (msg) =>
          msg.sender_id === userId ||
          msg.conversation.participant_1_id === userId ||
          msg.conversation.participant_2_id === userId
      )
    ).toBe(true);
  });
});
```

**Findings for Messaging**:

- ✅ Integration tests use real Supabase connection
- **Action**: Test all RLS policies with different users

### E2E Testing (Playwright)

**Location**: `e2e/auth/sign-in.spec.ts` (example)

```typescript
test('complete messaging flow', async ({ page }) => {
  // 1. Sign in as User A
  await page.goto('/sign-in');
  await page.fill('[name=email]', 'usera@test.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // 2. Send friend request
  await page.goto('/messages/connections');
  await page.fill('[placeholder="Search users"]', 'userb@test.com');
  await page.click('button:has-text("Send Request")');

  // 3. Send message (in separate session as User B)
  // ... multi-session E2E test
});
```

**Findings for Messaging**:

- ✅ Playwright configured with 8 mobile + 2 tablet viewports
- **Action**: Test complete messaging flow across viewports

## 8. Web Crypto API Patterns (New Requirement)

**No existing crypto code** - messaging will be first feature to use Web Crypto API.

**Reference Implementation Needed**:

```typescript
// ECDH key generation
async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable (for export)
    ['deriveKey', 'deriveBits']
  );
}

// Export public key to JWK (store in database)
async function exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', publicKey);
}

// Store private key in IndexedDB (never transmitted)
async function storePrivateKey(privateKey: CryptoKey): Promise<void> {
  const exported = await crypto.subtle.exportKey('jwk', privateKey);
  await db.privateKeys.put({ userId, privateKey: exported });
}

// Derive shared secret (ECDH)
async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable (security)
    ['encrypt', 'decrypt']
  );
}

// Encrypt message (AES-GCM)
async function encryptMessage(
  plaintext: string,
  sharedSecret: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedSecret,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

// Decrypt message (AES-GCM)
async function decryptMessage(
  ciphertext: string,
  iv: string,
  sharedSecret: CryptoKey
): Promise<string> {
  const encrypted = base64ToArrayBuffer(ciphertext);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    sharedSecret,
    encrypted
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
```

**Findings**:

- ✅ Web Crypto API built into browsers (no dependency)
- ✅ Works in all modern browsers (Chrome 60+, Firefox 88+, Safari 14+)
- **Action**: Create `src/lib/messaging/encryption.ts` with 100% test coverage

## 9. Dexie.js Integration (New Dependency)

**Current State**: Payment system uses raw IndexedDB API
**Recommendation**: Use Dexie.js for messaging for better TypeScript support

**Installation**:

```bash
docker compose exec scripthammer pnpm add dexie@^4.0.10
```

**Usage Pattern**:

```typescript
import Dexie, { Table } from 'dexie';

interface QueuedMessage {
  id: string;
  conversation_id: string;
  encrypted_content: string;
  initialization_vector: string;
  synced: boolean;
  created_at: number;
}

interface CachedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  initialization_vector: string;
  sequence_number: number;
  created_at: string;
}

interface PrivateKey {
  userId: string;
  privateKey: JsonWebKey;
  created_at: number;
}

class MessagingDatabase extends Dexie {
  queuedMessages!: Table<QueuedMessage, string>;
  cachedMessages!: Table<CachedMessage, string>;
  privateKeys!: Table<PrivateKey, string>;

  constructor() {
    super('MessagingDB');
    this.version(1).stores({
      queuedMessages: 'id, conversation_id, synced, created_at',
      cachedMessages: 'id, conversation_id, created_at',
      privateKeys: 'userId',
    });
  }
}

export const messagingDb = new MessagingDatabase();
```

**Benefits over raw IndexedDB**:

- ✅ Type-safe queries: `await messagingDb.queuedMessages.where('synced').equals(false).toArray()`
- ✅ Observable queries for React: `useLiveQuery(() => messagingDb.cachedMessages.toArray())`
- ✅ Automatic schema migration
- ✅ Better error messages

## 10. Migration Strategy

### Database Migration Pattern

**Location**: `supabase/migrations/20251006_complete_monolithic_setup.sql`

**Existing Pattern**:

```sql
-- Wrap in transaction
BEGIN;

-- Create tables
CREATE TABLE table_name (...);

-- Create indexes
CREATE INDEX idx_name ON table_name(column);

-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "policy_name" ON table_name
  FOR SELECT USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT ON table_name TO authenticated;

-- Commit
COMMIT;
```

**Action for Messaging**:

- Create `/home/turtle_wolfe/repos/ScriptHammer/supabase/migrations/20251008_user_messaging_system.sql`
- Follow transaction pattern
- 6 tables: user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators
- Apply RLS to all tables
- Create indexes on foreign keys + frequently queried columns

## 11. Recommendations Summary

### Reuse Existing Patterns ✅

1. **Supabase Client**: Use singleton from `src/lib/supabase/client.ts`
2. **Authentication**: Use `useAuth()` hook for all user checks
3. **RLS Policies**: Follow payment system patterns for user isolation
4. **Service Layer**: Create similar structure to `payment-service.ts`
5. **Component Structure**: Use generator for all components (5-file pattern)
6. **Mobile-First**: Apply `min-h-11 min-w-11` to all interactive elements
7. **Testing**: Follow Vitest + Playwright patterns

### New Patterns to Implement 🆕

1. **Dexie.js**: Upgrade from raw IndexedDB for better TypeScript support
2. **Web Crypto API**: Implement ECDH + AES-GCM encryption (100% test coverage)
3. **Supabase Realtime**: Create `useConversationRealtime` hook for message subscriptions
4. **Lazy Key Generation**: Generate encryption keys on first message send (not sign-up)

### Constitutional Compliance ✅

- All components use generator (5-file pattern enforced)
- TDD workflow (tests before implementation)
- Docker-first development
- Mobile-first design (44px touch targets)
- Privacy-first (zero-knowledge encryption)
- Accessibility (WCAG AA via Pa11y)

## 12. Risk Assessment

### Low Risk ✅

- Supabase integration (well-established patterns)
- Offline queue (existing pattern, upgrading with Dexie)
- Component structure (enforced by CI/CD)
- Authentication (robust AuthContext exists)

### Medium Risk ⚠️

- Supabase Realtime subscriptions (payment uses it, but messaging has higher volume)
- Virtual scrolling for 1000+ messages (performance optimization required)
- Dexie.js migration (new dependency, but widely used)

### Higher Risk 🔴

- **Web Crypto API** (first use in codebase):
  - Requires 100% test coverage
  - Browser compatibility must be verified
  - Key management is security-critical
  - Lost keys = unrecoverable messages (by design)
- **Zero-knowledge architecture**:
  - No server-side message recovery
  - Client-side decryption failures are UX issues
  - Debugging encrypted content is challenging

### Mitigation Strategies

1. **Crypto**: Write comprehensive unit tests FIRST (TDD), add browser compatibility checks
2. **Realtime**: Monitor subscription count, unsubscribe aggressively, test with 10+ active conversations
3. **Virtual Scroll**: Use battle-tested library (react-window or custom with intersection observer)
4. **Lost Keys**: Clear user warnings, export/import functionality in v0.5.0

## Next Phase

✅ **Phase 0 Complete** - Codebase analysis finished

**→ Proceed to Phase 1**: Design (data-model.md, contracts/, quickstart.md)
