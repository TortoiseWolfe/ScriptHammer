# Research: Fix Conversations Page Infinite Loading Spinner

**Feature**: 029-fix-conversations-page
**Date**: 2025-11-25

## Current Code Analysis

### File: `src/app/conversations/page.tsx`

**Current Loading Logic**:

```typescript
const [loading, setLoading] = useState(true); // Starts true

// useEffect triggers loadConversations when auth completes
useEffect(() => {
  if (!authLoading && user) {
    loadConversations();
  } else if (!authLoading && !user) {
    setLoading(false);
    setError('Please sign in to view conversations');
  }
}, [user, authLoading, loadConversations]);
```

**Potential Failure Points**:

1. `authLoading` never becomes false → spinner forever
2. `user` is null even after auth completes → shows error (correct)
3. `loadConversations()` is called but never completes → spinner forever
4. Supabase query hangs → `finally` block never reached → spinner forever

### AuthContext State

From `src/contexts/AuthContext.tsx`:

- `isLoading` (authLoading) starts `true`
- `getSession()` with retry logic sets it to `false`
- 5-second fallback timeout sets it to `false` with error

**Key Finding**: Auth context has timeout, but conversations query does NOT.

## Root Cause Hypothesis

The most likely cause is the **Supabase query hanging** in `loadConversations()`:

- No timeout on the query
- If RLS blocks or network issues, the promise may never resolve
- `finally` block never executes
- `loading` stays `true` forever

## Decision: Debug First Approach

Per clarification, we'll add logging before fixing:

1. Log auth state on each render
2. Log when useEffect triggers
3. Log query start/complete/error with timestamps
4. Log all setLoading calls

## Diagnostic Code Pattern

```typescript
console.log(
  '[Conversations] Render - authLoading:',
  authLoading,
  'user:',
  !!user,
  'loading:',
  loading
);

// In useEffect
console.log(
  '[Conversations] useEffect - authLoading:',
  authLoading,
  'user:',
  !!user
);

// In loadConversations
console.log('[Conversations] loadConversations START');
// ... after query
console.log(
  '[Conversations] Query complete - convos:',
  convos?.length,
  'error:',
  convError
);
// ... in finally
console.log('[Conversations] loadConversations END - setting loading=false');
```

## Fix Strategy (Post-Debug)

1. **Query Timeout**: Wrap Supabase query with `Promise.race` and 10-second timeout
2. **Guaranteed State Resolution**: Ensure every code path calls `setLoading(false)`
3. **Error Boundary**: Add fallback timeout at component level (backup safety)

## Alternatives Considered

| Approach                 | Pros                  | Cons                     | Decision     |
| ------------------------ | --------------------- | ------------------------ | ------------ |
| Direct fix without debug | Faster                | May not fix actual issue | Rejected     |
| Debug first              | Identifies root cause | Takes longer             | **Selected** |
| Replace with Suspense    | Modern pattern        | Major refactor           | Deferred     |

## Next Steps

1. Add diagnostic logging
2. Reproduce issue and check console
3. Identify exact failure point
4. Implement targeted fix
