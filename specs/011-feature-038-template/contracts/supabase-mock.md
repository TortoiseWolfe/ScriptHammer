# Contract: Supabase Test Mock

## Purpose

Provide a comprehensive mock of the Supabase client for unit tests to pass without requiring actual Supabase environment variables.

## Interface

```typescript
// tests/setup.ts
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
  getSupabase: vi.fn(() => mockSupabaseClient),
  supabase: mockSupabaseClient,
}));
```

## Mock Structure

```typescript
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { session: null },
        error: null,
      })
    ),
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: null },
        error: null,
      })
    ),
    signInWithPassword: vi.fn(() =>
      Promise.resolve({
        data: {},
        error: null,
      })
    ),
    signUp: vi.fn(() =>
      Promise.resolve({
        data: {},
        error: null,
      })
    ),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
    updateUser: vi.fn(() =>
      Promise.resolve({
        data: {},
        error: null,
      })
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
  from: vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      order: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
    upsert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  })),
  channel: vi.fn((name: string) => {
    const channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(),
      send: vi.fn(() => Promise.resolve('ok')),
    };
    return channel;
  }),
  removeChannel: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() =>
        Promise.resolve({ data: { path: 'test.png' }, error: null })
      ),
      getPublicUrl: vi.fn(() => ({
        data: { publicUrl: 'https://example.com/test.png' },
      })),
      remove: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
};
```

## Test Override Pattern

Individual tests can override specific methods:

```typescript
import { vi } from 'vitest';
import { createClient } from '@/lib/supabase/client';

// Override for specific test
vi.mocked(createClient).mockReturnValueOnce({
  ...mockSupabaseClient,
  auth: {
    ...mockSupabaseClient.auth,
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: 'test-id', email: 'test@example.com' } },
        error: null,
      })
    ),
  },
});
```

## Behaviors

### Default Responses

| Method                  | Default Response             |
| ----------------------- | ---------------------------- |
| `auth.getSession`       | `{ session: null }`          |
| `auth.getUser`          | `{ user: null }`             |
| `from().select()`       | `{ data: [], error: null }`  |
| `channel().subscribe()` | Returns channel for chaining |

### Error Simulation

```typescript
// Simulate auth error
vi.mocked(createClient().auth.signInWithPassword).mockResolvedValueOnce({
  data: {},
  error: { message: 'Invalid credentials', status: 401 },
});
```

## Verification

Tests pass with:

- No `.env` file
- No `NEXT_PUBLIC_SUPABASE_URL`
- No `NEXT_PUBLIC_SUPABASE_ANON_KEY`
