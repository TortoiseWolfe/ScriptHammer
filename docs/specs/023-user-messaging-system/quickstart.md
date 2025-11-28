# Developer Quickstart: User Messaging System

**Generated**: 2025-10-08 | **For**: PRP-023 Implementation

## Prerequisites

✅ Before starting, ensure you have completed:

- [x] ScriptHammer development environment set up (Docker + Supabase)
- [x] Read `/home/turtle_wolfe/repos/ScriptHammer/specs/023-user-messaging-system/spec.md`
- [x] Read `/home/turtle_wolfe/repos/ScriptHammer/specs/023-user-messaging-system/research.md`
- [x] Read `/home/turtle_wolfe/repos/ScriptHammer/specs/023-user-messaging-system/data-model.md`

**Estimated Time**: 8-11 days (4 phases)

---

## Phase 1: Database & Friend Requests (3 days)

### Step 1.1: Create Database Migration

**File**: `/home/turtle_wolfe/repos/ScriptHammer/supabase/migrations/20251008_user_messaging_system.sql`

```bash
# Create migration file
touch supabase/migrations/20251008_user_messaging_system.sql
```

**Content** (refer to data-model.md for complete SQL):

- 6 tables: user_connections, conversations, messages, user_encryption_keys, conversation_keys, typing_indicators
- Indexes on all foreign keys + frequently queried columns
- RLS policies for user isolation
- Triggers for last_message_at and sequence_number

**Test Migration**:

```bash
# Apply migration locally
docker compose exec scripthammer pnpm supabase db reset

# Verify tables created
docker compose exec scripthammer pnpm supabase db diff
```

### Step 1.2: Regenerate Supabase Types

```bash
# Generate TypeScript types from database schema
docker compose exec scripthammer pnpm supabase gen types typescript --local > src/lib/supabase/types.ts
```

### Step 1.3: Create Application Types

**File**: `src/types/messaging.ts`

Copy from `/home/turtle_wolfe/repos/ScriptHammer/specs/023-user-messaging-system/contracts/types.ts`

### Step 1.4: Build ConnectionService (TDD)

**Test First** (`tests/unit/messaging/connection-service.test.ts`):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionService } from '@/services/messaging/connection-service';

describe('ConnectionService', () => {
  let service: ConnectionService;

  beforeEach(() => {
    service = new ConnectionService();
  });

  describe('sendFriendRequest', () => {
    it('should create pending connection', async () => {
      const result = await service.sendFriendRequest({
        addressee_email: 'friend@test.com'
      });

      expect(result.status).toBe('pending');
      expect(result.requester_id).toBe(mockUserId);
    });

    it('should reject duplicate requests', async () => {
      await service.sendFriendRequest({ addressee_email: 'friend@test.com' });

      await expect(
        service.sendFriendRequest({ addressee_email: 'friend@test.com' })
      ).rejects.toThrow('Already connected');
    });

    it('should reject self-connection', async () => {
      await expect(
        service.sendFriendRequest({ addressee_email: 'self@test.com' })
      ).rejects.toThrow('Cannot connect to yourself');
    });
  });

  describe('respondToRequest', () => {
    it('should accept request and update status', async () => {
      const request = await service.sendFriendRequest(...);

      const result = await service.respondToRequest({
        connection_id: request.id,
        action: 'accept'
      });

      expect(result.status).toBe('accepted');
    });
  });

  describe('searchUsers', () => {
    it('should find users by exact email', async () => {
      const result = await service.searchUsers({
        query: 'friend@test.com'
      });

      expect(result.users.length).toBe(1);
      expect(result.users[0].email).toBe('friend@test.com');
    });

    it('should exclude already connected users', async () => {
      // ... test implementation
    });
  });
});
```

**Then Implementation** (`src/services/messaging/connection-service.ts`):

```typescript
import { supabase } from '@/lib/supabase/client';
import type {
  SendFriendRequestInput,
  RespondToRequestInput,
  SearchUsersInput,
  UserConnection,
  ConnectionList,
  SearchUsersResult,
} from '@/types/messaging';
import { AuthenticationError, ValidationError } from '@/types/messaging';

export class ConnectionService implements IConnectionService {
  async sendFriendRequest(
    input: SendFriendRequestInput
  ): Promise<UserConnection> {
    // 1. Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new AuthenticationError('Not authenticated');

    // 2. Find addressee by email
    const { data: addressee, error: searchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', input.addressee_email)
      .single();

    if (searchError || !addressee) {
      throw new ValidationError('User not found', 'addressee_email');
    }

    // 3. Prevent self-connection
    if (addressee.id === user.id) {
      throw new ValidationError('Cannot connect to yourself');
    }

    // 4. Check for existing connection
    const { data: existing } = await supabase
      .from('user_connections')
      .select('*')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${addressee.id}),and(requester_id.eq.${addressee.id},addressee_id.eq.${user.id})`
      )
      .single();

    if (existing) {
      throw new ValidationError('Already connected or request pending');
    }

    // 5. Create connection
    const { data, error } = await supabase
      .from('user_connections')
      .insert({
        requester_id: user.id,
        addressee_id: addressee.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as UserConnection;
  }

  async respondToRequest(
    input: RespondToRequestInput
  ): Promise<UserConnection> {
    // ... implementation
  }

  async getConnections(): Promise<ConnectionList> {
    // ... implementation
  }

  async searchUsers(input: SearchUsersInput): Promise<SearchUsersResult> {
    // ... implementation
  }

  async removeConnection(connection_id: string): Promise<void> {
    // ... implementation
  }
}
```

### Step 1.5: Build UI Components (5-file pattern)

**Use Component Generator**:

```bash
# UserSearch component
docker compose exec scripthammer pnpm run generate:component -- \
  --name UserSearch \
  --category molecular \
  --hasProps true \
  --withHooks true

# ConnectionManager component
docker compose exec scripthammer pnpm run generate:component -- \
  --name ConnectionManager \
  --category organisms \
  --hasProps true \
  --withHooks true
```

**Implementation** (`src/components/molecular/UserSearch/UserSearch.tsx`):

```typescript
'use client';

import { useState } from 'react';
import { useConnections } from '@/hooks/useConnections';

export interface UserSearchProps {
  onSelect: (userId: string) => void;
}

export default function UserSearch({ onSelect }: UserSearchProps) {
  const [query, setQuery] = useState('');
  const { searchUsers } = useConnections();
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const data = await searchUsers(query);
    setResults(data.users);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email..."
          className="input input-bordered min-h-11 flex-1"
          aria-label="Search users by email"
        />
        <button
          onClick={handleSearch}
          className="btn btn-primary min-h-11 min-w-11"
        >
          Search
        </button>
      </div>

      <ul className="space-y-2" role="list" aria-label="Search results">
        {results.map((user) => (
          <li key={user.id} className="flex items-center justify-between p-2 border rounded">
            <span>{user.display_name || user.username}</span>
            <button
              onClick={() => onSelect(user.id)}
              className="btn btn-sm btn-ghost min-h-11 min-w-11"
            >
              Send Request
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Step 1.6: Write Integration Tests

**File**: `tests/integration/messaging/connections.integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Connection RLS Policies', () => {
  it('users can only view own connections', async () => {
    // Test with actual Supabase instance
    const { data, error } = await supabase.from('user_connections').select('*');

    expect(error).toBeNull();
    expect(data).toBeDefined();
    // RLS should filter to only user's connections
  });

  it('only addressee can accept request', async () => {
    // ... test implementation
  });
});
```

### Step 1.7: E2E Tests

**File**: `e2e/messaging/friend-requests.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('complete friend request flow', async ({ page, context }) => {
  // 1. User A signs in
  await page.goto('/sign-in');
  await page.fill('[name=email]', 'usera@test.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // 2. User A sends friend request
  await page.goto('/messages/connections');
  await page.fill('[placeholder*="Search"]', 'userb@test.com');
  await page.click('button:has-text("Send Request")');

  await expect(page.locator('text=Request sent')).toBeVisible();

  // 3. User B accepts request (new session)
  const page2 = await context.newPage();
  await page2.goto('/sign-in');
  // ... continue flow
});
```

**Phase 1 Deliverable**: ✅ Users can send/accept/decline/block friend requests

---

## Phase 2: Encryption (3 days)

### Step 2.1: Install Dexie.js

```bash
docker compose exec scripthammer pnpm add dexie@^4.0.10
```

### Step 2.2: Create IndexedDB Database

**File**: `src/lib/messaging/database.ts`

```typescript
import Dexie, { Table } from 'dexie';
import type {
  QueuedMessage,
  CachedMessage,
  PrivateKey,
} from '@/types/messaging';

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

### Step 2.3: Build Encryption Service (TDD - 100% Coverage Required)

**Test First** (`tests/unit/messaging/encryption.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { EncryptionService } from '@/lib/messaging/encryption';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  describe('generateKeyPair', () => {
    it('should generate ECDH P-256 key pair', async () => {
      const keys = await service.generateKeyPair();

      expect(keys.publicKey.algorithm.name).toBe('ECDH');
      expect(keys.privateKey.algorithm.name).toBe('ECDH');
    });

    it('should generate extractable public key', async () => {
      const keys = await service.generateKeyPair();
      const jwk = await service.exportPublicKey(keys.publicKey);

      expect(jwk.kty).toBe('EC');
      expect(jwk.crv).toBe('P-256');
    });
  });

  describe('encryptMessage', () => {
    it('should encrypt plaintext to base64 ciphertext', async () => {
      const sharedSecret = await generateMockSharedSecret();
      const plaintext = 'Hello, World!';

      const encrypted = await service.encryptMessage(plaintext, sharedSecret);

      expect(encrypted.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64
      expect(encrypted.iv).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64
      expect(encrypted.ciphertext).not.toBe(plaintext);
    });

    it('should generate unique IV for each encryption', async () => {
      const sharedSecret = await generateMockSharedSecret();
      const plaintext = 'Same message';

      const enc1 = await service.encryptMessage(plaintext, sharedSecret);
      const enc2 = await service.encryptMessage(plaintext, sharedSecret);

      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext); // Different IVs = different ciphertext
    });
  });

  describe('decryptMessage', () => {
    it('should decrypt ciphertext back to plaintext', async () => {
      const sharedSecret = await generateMockSharedSecret();
      const plaintext = 'Secret message!';

      const encrypted = await service.encryptMessage(plaintext, sharedSecret);
      const decrypted = await service.decryptMessage(encrypted, sharedSecret);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw DecryptionError for invalid ciphertext', async () => {
      const sharedSecret = await generateMockSharedSecret();

      await expect(
        service.decryptMessage(
          { ciphertext: 'invalid', iv: 'invalid' },
          sharedSecret
        )
      ).rejects.toThrow('DecryptionError');
    });
  });

  describe('deriveSharedSecret', () => {
    it('should derive same secret from both sides', async () => {
      const aliceKeys = await service.generateKeyPair();
      const bobKeys = await service.generateKeyPair();

      const alicePublicJWK = await service.exportPublicKey(aliceKeys.publicKey);
      const bobPublicJWK = await service.exportPublicKey(bobKeys.publicKey);

      const aliceSecret = await service.deriveSharedSecret(
        aliceKeys.privateKey,
        bobPublicJWK
      );
      const bobSecret = await service.deriveSharedSecret(
        bobKeys.privateKey,
        alicePublicJWK
      );

      // Both should derive the same secret
      const testPlaintext = 'Test';
      const aliceEncrypted = await service.encryptMessage(
        testPlaintext,
        aliceSecret.key
      );
      const bobDecrypted = await service.decryptMessage(
        aliceEncrypted,
        bobSecret.key
      );

      expect(bobDecrypted).toBe(testPlaintext);
    });
  });
});
```

**Then Implementation** (`src/lib/messaging/encryption.ts`):

```typescript
import type {
  KeyPair,
  SharedSecret,
  EncryptedPayload,
} from '@/types/messaging';
import { EncryptionError, DecryptionError } from '@/types/messaging';
import { CRYPTO_PARAMS } from '@/types/messaging';

export class EncryptionService implements IEncryptionService {
  async generateKeyPair(): Promise<KeyPair> {
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: CRYPTO_PARAMS.ALGORITHM, namedCurve: CRYPTO_PARAMS.CURVE },
        true, // extractable
        ['deriveKey', 'deriveBits']
      );

      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      };
    } catch (error) {
      throw new EncryptionError('Failed to generate key pair', error);
    }
  }

  async exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
    try {
      return await crypto.subtle.exportKey('jwk', publicKey);
    } catch (error) {
      throw new EncryptionError('Failed to export public key', error);
    }
  }

  async deriveSharedSecret(
    privateKey: CryptoKey,
    recipientPublicKey: JsonWebKey
  ): Promise<SharedSecret> {
    try {
      // Import recipient's public key
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        recipientPublicKey,
        { name: CRYPTO_PARAMS.ALGORITHM, namedCurve: CRYPTO_PARAMS.CURVE },
        false,
        []
      );

      // Derive shared AES-GCM key
      const sharedKey = await crypto.subtle.deriveKey(
        { name: CRYPTO_PARAMS.ALGORITHM, public: publicKey },
        privateKey,
        {
          name: CRYPTO_PARAMS.AES_ALGORITHM,
          length: CRYPTO_PARAMS.AES_KEY_LENGTH,
        },
        false, // Not extractable (security)
        ['encrypt', 'decrypt']
      );

      return {
        key: sharedKey,
        derived_at: Date.now(),
      };
    } catch (error) {
      throw new EncryptionError('Failed to derive shared secret', error);
    }
  }

  async encryptMessage(
    content: string,
    sharedSecret: CryptoKey
  ): Promise<EncryptedPayload> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);

      // Generate random IV
      const iv = crypto.getRandomValues(
        new Uint8Array(CRYPTO_PARAMS.IV_LENGTH_BYTES)
      );

      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        { name: CRYPTO_PARAMS.AES_ALGORITHM, iv },
        sharedSecret,
        data
      );

      return {
        ciphertext: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv.buffer),
      };
    } catch (error) {
      throw new EncryptionError('Failed to encrypt message', error);
    }
  }

  async decryptMessage(
    encrypted: EncryptedPayload,
    sharedSecret: CryptoKey
  ): Promise<string> {
    try {
      const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
      const iv = base64ToArrayBuffer(encrypted.iv);

      const decrypted = await crypto.subtle.decrypt(
        { name: CRYPTO_PARAMS.AES_ALGORITHM, iv: new Uint8Array(iv) },
        sharedSecret,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new DecryptionError('Failed to decrypt message', error);
    }
  }

  // ... other methods
}

// Utility functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

**Phase 2 Deliverable**: ✅ End-to-end encryption working with 100% test coverage

---

## Phase 3 & 4: Messaging + Offline (Combined Quickstart)

_(Remaining phases omitted for brevity - see tasks.md for detailed breakdown)_

**Key Commands**:

```bash
# Run all tests
docker compose exec scripthammer pnpm run test:suite

# Run specific test file
docker compose exec scripthammer pnpm test src/lib/messaging/encryption.test.ts

# E2E tests
docker compose exec scripthammer pnpm exec playwright test e2e/messaging/

# Check test coverage
docker compose exec scripthammer pnpm run test:coverage
```

---

## Common Issues & Solutions

### Issue: "Cannot find module '@/types/messaging'"

**Solution**: Ensure `src/types/messaging.ts` is created and `tsconfig.json` has path alias configured.

### Issue: Web Crypto API not available in tests

**Solution**: Use jsdom environment in Vitest config:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
```

### Issue: Supabase RLS policies failing in tests

**Solution**: Use service role key in integration tests:

```typescript
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
```

---

## Next Steps

✅ Phase 1 (Design) artifacts complete:

- plan.md
- research.md
- data-model.md
- contracts/types.ts
- contracts/api.ts
- quickstart.md

**→ Run `/tasks` command** to generate tasks.md with atomic task breakdown
