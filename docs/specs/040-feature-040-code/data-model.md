# Data Model: Code Quality Improvements

**Feature**: 040-feature-040-code | **Date**: 2025-11-27

## Overview

This feature introduces two new TypeScript constructs:

1. **Logger Service** - Structured logging with log levels and categories
2. **Result Type** - Consistent error handling pattern

No database schema changes required.

---

## 1. Logger Service

### LogLevel Enum

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}
```

### LoggerConfig Interface

```typescript
interface LoggerConfig {
  /** Minimum log level to output (default: DEBUG in dev, ERROR in prod) */
  minLevel: LogLevel;

  /** Include timestamps in output (default: true in dev, false in prod) */
  timestamps: boolean;

  /** Include category prefix in output (default: true) */
  showCategory: boolean;
}
```

### Logger Interface

```typescript
interface Logger {
  /** Category/namespace for this logger instance */
  readonly category: string;

  /** Log debug message (suppressed in production) */
  debug(message: string, context?: Record<string, unknown>): void;

  /** Log info message (suppressed in production) */
  info(message: string, context?: Record<string, unknown>): void;

  /** Log warning message */
  warn(message: string, context?: Record<string, unknown>): void;

  /** Log error message (always shown) */
  error(message: string, context?: Record<string, unknown>): void;
}
```

### Log Entry Shape (Internal)

```typescript
interface LogEntry {
  level: LogLevel;
  category: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string; // ISO 8601
}
```

---

## 2. Result Type

### ServiceResult<T> Generic Type

```typescript
/**
 * Supabase-style result tuple for service functions.
 * Consistent with existing Supabase client pattern.
 */
type ServiceResult<T> = {
  data: T | null;
  error: Error | null;
};
```

### Usage Pattern

```typescript
// Service function returning result
async function getUser(id: string): Promise<ServiceResult<User>> {
  try {
    const user = await fetchUser(id);
    return { data: user, error: null };
  } catch (err) {
    logger.error('getUser', 'Failed to fetch user', { id, error: err });
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

// Consumer handling result
const { data: user, error } = await getUser(id);
if (error) {
  // Handle error
  return;
}
// Use user (TypeScript knows it's not null here)
```

---

## 3. Messaging Types (New)

### Database Tables Missing from Generated Types

These types need to be added to `src/lib/supabase/messaging-types.ts`:

#### ConnectionStatus Enum

```typescript
type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
```

#### UserConnection Table

```typescript
interface UserConnection {
  id: string; // UUID
  requester_id: string; // UUID (FK: auth.users)
  addressee_id: string; // UUID (FK: auth.users)
  status: ConnectionStatus;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
```

#### Conversation Table

```typescript
interface Conversation {
  id: string; // UUID
  participant_1_id: string; // UUID (FK: auth.users)
  participant_2_id: string; // UUID (FK: auth.users)
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  last_message_at: string | null; // ISO timestamp
}
```

#### Message Table

```typescript
interface Message {
  id: string; // UUID
  conversation_id: string; // UUID (FK: conversations)
  sender_id: string; // UUID (FK: auth.users)
  encrypted_content: string; // Base64 encrypted message
  iv: string; // Initialization vector
  read_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  is_deleted: boolean;
  edited_at: string | null; // ISO timestamp
}
```

#### MessagingDatabase Type Extension

```typescript
interface MessagingTables {
  user_connections: {
    Row: UserConnection;
    Insert: Omit<UserConnection, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<UserConnection, 'id'>>;
  };
  conversations: {
    Row: Conversation;
    Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<Conversation, 'id'>>;
  };
  messages: {
    Row: Message;
    Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<Message, 'id'>>;
  };
}
```

---

## Entity Relationship Diagram

```
┌─────────────────────┐
│    auth.users       │
│  (Supabase Auth)    │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│  user_connections   │     │   conversations     │
│                     │     │                     │
│ requester_id (FK)───┼─────┤─participant_1_id    │
│ addressee_id (FK)───┼─────┤─participant_2_id    │
│ status              │     │                     │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       │ 1:N
                                       ▼
                            ┌─────────────────────┐
                            │     messages        │
                            │                     │
                            │ conversation_id (FK)│
                            │ sender_id (FK)──────┼──► auth.users
                            │ encrypted_content   │
                            └─────────────────────┘
```

---

## Logger Categories (Recommended)

| Category    | Use For                         | Example Files                 |
| ----------- | ------------------------------- | ----------------------------- |
| `auth`      | Authentication, sessions, OAuth | `src/services/auth/*.ts`      |
| `messaging` | Chat, conversations, encryption | `src/services/messaging/*.ts` |
| `payment`   | Stripe, PayPal, transactions    | `src/lib/payments/*.ts`       |
| `profile`   | User profiles, avatars          | `src/services/profile/*.ts`   |
| `api`       | External API calls              | `src/lib/api/*.ts`            |
| `db`        | Database operations             | `src/lib/supabase/*.ts`       |
| `pwa`       | Service worker, offline         | `src/utils/pwa/*.ts`          |
| `app`       | General application             | Default fallback              |

---

## Validation Rules

### Logger

| Field        | Rule                                                                | Default/Behavior                        |
| ------------ | ------------------------------------------------------------------- | --------------------------------------- |
| category     | Non-empty string, lowercase, alphanumeric + hyphens only            | `'app'` if empty/invalid                |
| message      | Non-empty string, max 10KB                                          | Truncate with `...[truncated]` if >10KB |
| context      | Optional, JSON-serializable object (no circular refs, no functions) | `undefined`                             |
| context keys | Must not contain PII-related keys                                   | Redact to `[REDACTED]`                  |

**PII Keys to Redact**: `password`, `token`, `secret`, `apiKey`, `api_key`, `email`, `phone`, `ssn`, `creditCard`, `credit_card`

### ServiceResult

| Field     | Rule                                  | Notes                                                    |
| --------- | ------------------------------------- | -------------------------------------------------------- |
| data      | Non-null on success, null on error    | Empty array `[]` and empty object `{}` are valid success |
| error     | Non-null on error, null on success    | Empty string `''` creates `Error('Unknown error')`       |
| Invariant | Exactly one of data/error is non-null | Use `success(undefined)` for void returns                |

**Anti-patterns**:

- `success(null)` - Invalid, ambiguous with error case
- Nested `ServiceResult<ServiceResult<T>>` - Flatten to single result

---

## State Transitions

### Logger Levels by Environment

```
Development:
  DEBUG → INFO → WARN → ERROR (all visible)

Production:
  ERROR only (DEBUG, INFO, WARN suppressed)
```

### ConnectionStatus Transitions

```
         ┌──────────────┐
         │   pending    │
         └──────┬───────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐
│accepted│ │declined│ │blocked │
└────────┘ └────────┘ └────────┘
```
