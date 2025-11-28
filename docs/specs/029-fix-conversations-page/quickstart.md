# Quickstart: Conversations Page Loading Fix

**Feature**: 029-fix-conversations-page
**Date**: 2025-11-25

## Overview

This fix addresses the infinite loading spinner on the conversations page by:

1. Adding diagnostic logging to identify root cause
2. Implementing query timeout
3. Ensuring all code paths reach a terminal state

## Implementation Steps

### Step 1: Add Diagnostic Logging

Add these console.logs to `src/app/conversations/page.tsx`:

```typescript
// At top of component (after hooks)
console.log('[Conversations] Render', {
  authLoading,
  user: !!user,
  loading,
  error,
});

// In useEffect
useEffect(() => {
  console.log('[Conversations] useEffect triggered', {
    authLoading,
    user: !!user,
  });
  // ... existing code
}, [user, authLoading, loadConversations]);

// In loadConversations
const loadConversations = useCallback(async () => {
  console.log('[Conversations] loadConversations START');
  if (!user) {
    console.log('[Conversations] No user, returning');
    return;
  }
  // ... existing code
  console.log('[Conversations] Query result', {
    count: convos?.length,
    error: convError,
  });
  // ... in finally
  console.log('[Conversations] loadConversations END');
}, [user]);
```

### Step 2: Reproduce and Check Console

1. Sign in as test user
2. Navigate to /conversations
3. Open browser dev tools → Console
4. Look for where the logs stop

### Step 3: Implement Timeout

```typescript
// Helper function
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Query timeout')), ms)
  );
  return Promise.race([promise, timeout]);
};

// Usage in loadConversations
const { data: convos, error: convError } = await withTimeout(
  supabase.from('conversations').select('*').or(...),
  10000 // 10 second timeout
);
```

### Step 4: Verify Fix

1. All console.logs show expected flow
2. Page shows content within 5 seconds
3. No infinite spinner under any condition

## Testing

```bash
# Run E2E test
docker compose exec scripthammer pnpm exec playwright test tests/e2e/conversations/

# Manual test
# 1. Sign in as test@example.com
# 2. Navigate to /conversations
# 3. Verify page loads within 5 seconds
```

## Files Modified

| File                             | Changes                           |
| -------------------------------- | --------------------------------- |
| `src/app/conversations/page.tsx` | Add logging, timeout, state fixes |
