import { vi } from 'vitest';

/**
 * Mock Supabase Client for Unit Tests
 *
 * Purpose: Provides a lightweight mock of Supabase client for unit testing
 * without requiring a real database connection.
 *
 * Usage:
 * ```typescript
 * import { createMockSupabaseClient } from '@tests/mocks/supabase';
 *
 * vi.mock('@/lib/supabase/client', () => ({
 *   supabase: createMockSupabaseClient()
 * }));
 * ```
 */

export interface MockSupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

export interface MockSupabaseBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  containedBy: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock query builder that chains methods
 */
export function createMockQueryBuilder(
  mockData: any = [],
  mockError: Error | null = null
): MockSupabaseBuilder {
  const builder: any = {
    data: mockData,
    error: mockError,
  };

  // All methods return the builder for chaining
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'in',
    'contains',
    'containedBy',
    'range',
    'match',
    'not',
    'or',
    'filter',
    'order',
    'limit',
  ];

  methods.forEach((method) => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  // Terminal methods that return a promise
  builder.single = vi.fn().mockResolvedValue({
    data: Array.isArray(mockData) ? mockData[0] : mockData,
    error: mockError,
  });

  builder.maybeSingle = vi.fn().mockResolvedValue({
    data: Array.isArray(mockData) ? mockData[0] : mockData,
    error: mockError,
  });

  // Default promise resolution (for await)
  builder.then = function (resolve: any) {
    return Promise.resolve({ data: this.data, error: this.error }).then(
      resolve
    );
  };

  return builder;
}

/**
 * Creates a mock Supabase client with configurable responses
 */
export function createMockSupabaseClient(config?: {
  from?: Record<string, { data?: any; error?: Error | null }>;
  rpc?: Record<string, { data?: any; error?: Error | null }>;
  auth?: {
    getUser?: { data?: any; error?: Error | null };
    getSession?: { data?: any; error?: Error | null };
    signUp?: { data?: any; error?: Error | null };
    signInWithPassword?: { data?: any; error?: Error | null };
    signInWithOAuth?: { data?: any; error?: Error | null };
    signOut?: { error?: Error | null };
  };
}) {
  const fromMock = vi.fn((table: string) => {
    const tableConfig = config?.from?.[table] || { data: [], error: null };
    return createMockQueryBuilder(tableConfig.data, tableConfig.error);
  });

  const rpcMock = vi.fn((functionName: string, params?: any) => {
    const rpcConfig = config?.rpc?.[functionName] || { data: {}, error: null };
    return Promise.resolve({
      data: rpcConfig.data,
      error: rpcConfig.error,
    });
  });

  const authMock = {
    getUser: vi
      .fn()
      .mockResolvedValue(config?.auth?.getUser || { data: null, error: null }),
    getSession: vi
      .fn()
      .mockResolvedValue(
        config?.auth?.getSession || { data: null, error: null }
      ),
    signUp: vi
      .fn()
      .mockResolvedValue(config?.auth?.signUp || { data: null, error: null }),
    signInWithPassword: vi
      .fn()
      .mockResolvedValue(
        config?.auth?.signInWithPassword || { data: null, error: null }
      ),
    signInWithOAuth: vi
      .fn()
      .mockResolvedValue(
        config?.auth?.signInWithOAuth || { data: null, error: null }
      ),
    signOut: vi
      .fn()
      .mockResolvedValue(config?.auth?.signOut || { error: null }),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  };

  return {
    from: fromMock,
    rpc: rpcMock,
    auth: authMock,
  };
}

/**
 * Mock rate limiting function responses
 */
export function createRateLimitMockResponse(
  allowed: boolean,
  remaining: number
) {
  return {
    allowed,
    remaining,
    locked_until: allowed
      ? null
      : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    reason: allowed ? undefined : 'rate_limited',
  };
}

/**
 * Creates a mock for rate limit check RPC function
 */
export function createMockRateLimitClient(
  attempts: number = 0,
  maxAttempts: number = 5
) {
  const remaining = Math.max(0, maxAttempts - attempts);
  const allowed = remaining > 0;

  return createMockSupabaseClient({
    rpc: {
      check_rate_limit: {
        data: createRateLimitMockResponse(allowed, remaining),
        error: null,
      },
      record_failed_attempt: {
        data: { success: true },
        error: null,
      },
    },
  });
}
