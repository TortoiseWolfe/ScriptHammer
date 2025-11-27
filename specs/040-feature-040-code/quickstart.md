# Quickstart: Code Quality Improvements

**Feature**: 040-feature-040-code | **Date**: 2025-11-27

This guide covers how to use the new logger service and result pattern introduced in this feature.

---

## 1. Logger Service

### Basic Usage

```typescript
import { createLogger } from '@/lib/logger';

// Create a logger with a category
const logger = createLogger('auth');

// Log messages at different levels
logger.debug('Checking user session'); // Dev only
logger.info('User logged in', { userId: '123' }); // Dev only
logger.warn('Session expiring soon'); // Always
logger.error('Login failed', { error: 'Invalid credentials' }); // Always
```

### Output Format

**Development:**

```
[2025-11-27T10:30:45.123Z] [auth] DEBUG: Checking user session
[2025-11-27T10:30:45.124Z] [auth] INFO: User logged in { userId: '123' }
[2025-11-27T10:30:45.125Z] [auth] WARN: Session expiring soon
[2025-11-27T10:30:45.126Z] [auth] ERROR: Login failed { error: 'Invalid credentials' }
```

**Production:**

```
[auth] ERROR: Login failed { error: 'Invalid credentials' }
```

### Categories

Use descriptive categories to group related logs:

| Category    | Use For                         |
| ----------- | ------------------------------- |
| `auth`      | Authentication, sessions, OAuth |
| `messaging` | Chat, conversations, encryption |
| `payment`   | Stripe, PayPal, transactions    |
| `profile`   | User profiles, avatars          |
| `api`       | External API calls              |
| `db`        | Database operations             |
| `pwa`       | Service worker, offline         |

### Logging Errors

Always include error context:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId: currentUser?.id,
    operation: 'riskyOperation',
  });
}
```

---

## 2. Result Type Pattern

### Basic Usage

```typescript
import { ServiceResult, success, failure } from '@/types/result';

async function getUser(id: string): Promise<ServiceResult<User>> {
  try {
    const user = await db.users.findUnique({ where: { id } });

    if (!user) {
      return failure('User not found');
    }

    return success(user);
  } catch (error) {
    logger.error('getUser failed', { id, error });
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}
```

### Consuming Results

```typescript
const { data: user, error } = await getUser(userId);

if (error) {
  // Handle error - TypeScript knows `error` is Error
  showToast(`Failed: ${error.message}`);
  return;
}

// Use data - TypeScript knows `user` is User (not null)
console.log(user.name);
```

### Type Guards

```typescript
import { isSuccess, isFailure } from '@/types/result';

const result = await getUser(id);

if (isSuccess(result)) {
  // result.data is User
  return result.data;
}

if (isFailure(result)) {
  // result.error is Error
  throw result.error;
}
```

### Async Wrapper

For simple try-catch scenarios:

```typescript
import { tryCatch } from '@/types/result';

const result = await tryCatch(async () => {
  const response = await fetch('/api/users');
  if (!response.ok) throw new Error('Fetch failed');
  return response.json();
});

if (result.error) {
  logger.error('API call failed', { error: result.error });
}
```

---

## 3. Migration Guide

### Replacing console.log

**Before:**

```typescript
console.log('User logged in:', userId);
console.error('Failed to load data:', error);
```

**After:**

```typescript
import { createLogger } from '@/lib/logger';
const logger = createLogger('auth');

logger.info('User logged in', { userId });
logger.error('Failed to load data', {
  error: error instanceof Error ? error.message : String(error),
});
```

### Replacing Silent Catch Blocks

**Before:**

```typescript
async function getData() {
  try {
    return await fetchData();
  } catch {
    return null; // Silent failure
  }
}
```

**After:**

```typescript
import { createLogger } from '@/lib/logger';
import { ServiceResult, success, failure } from '@/types/result';

const logger = createLogger('data');

async function getData(): Promise<ServiceResult<Data>> {
  try {
    const data = await fetchData();
    return success(data);
  } catch (error) {
    logger.error('getData failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return failure(
      error instanceof Error ? error : new Error('Failed to get data')
    );
  }
}
```

### Replacing `as any` in Supabase Queries

**Before:**

```typescript
const { data, error } = await (supabase as any)
  .from('messages')
  .select('*')
  .eq('conversation_id', id);
```

**After:**

```typescript
import { getMessagingClient } from '@/lib/supabase/messaging-client';

const supabase = getMessagingClient();
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', id);
// data is now properly typed as Message[]
```

---

## 4. Testing

### Mocking the Logger

```typescript
import { vi } from 'vitest';

// Mock the entire module
vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// In your test
import { createLogger } from '@/lib/logger';

test('logs error on failure', async () => {
  const mockLogger = createLogger('test');

  await someFunction();

  expect(mockLogger.error).toHaveBeenCalledWith(
    'Operation failed',
    expect.objectContaining({ error: expect.any(String) })
  );
});
```

### Testing Result Functions

```typescript
import { success, failure, isSuccess, isFailure } from '@/types/result';

test('success creates valid result', () => {
  const result = success({ id: '1', name: 'Test' });

  expect(isSuccess(result)).toBe(true);
  expect(result.data).toEqual({ id: '1', name: 'Test' });
  expect(result.error).toBeNull();
});

test('failure creates valid result', () => {
  const result = failure('Something went wrong');

  expect(isFailure(result)).toBe(true);
  expect(result.data).toBeNull();
  expect(result.error.message).toBe('Something went wrong');
});
```

---

## 5. Best Practices

### Do

- Use descriptive categories (`auth`, `payment`, not `utils`, `helper`)
- Include relevant context in logs (userId, operation name)
- Return `ServiceResult` from all service functions
- Log before returning failures
- Use type guards for result checking

### Don't

- Log sensitive data (passwords, tokens, PII)
- Use console.log/warn/error directly
- Return `null` or `false` on errors
- Swallow errors silently
- Use `as any` for Supabase queries
