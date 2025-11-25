# Research: Auth System Failures

**Feature**: 028-fix-auth-system
**Date**: 2025-11-24

## Problem Statement

Three critical auth failures in production:

1. Sign-in intermittent - button clicks sometimes do nothing
2. Sign-out broken - cannot sign out once signed in
3. Conversations page stuck on spinner

## Root Cause Analysis

### Primary Issue: `getSession()` Not Completing

The `AuthContext` has a 5-second timeout fallback (lines 56-59):

```typescript
const loadingTimeout = setTimeout(() => {
  console.warn('Auth loading timeout - forcing isLoading to false');
  setIsLoading(false);
}, 5000);
```

When `supabase.auth.getSession()` doesn't complete (network issues, cold start, etc.), the timeout fires but:

- No error state is set
- No retry mechanism exists
- User sees no feedback about what happened

### Secondary Issue: Sign-Out Not Fail-Safe

Current `signOut` implementation (lines 136-143):

```typescript
const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error) {
    return { error: error as Error };
  }
};
```

Problems:

- Waits for Supabase API response before clearing state
- If API call hangs/fails, user appears still signed in
- No page reload to clear stale React state

### Tertiary Issue: Cross-Tab Behavior

The `onAuthStateChange` listener exists (line 79) but only updates local state:

```typescript
supabase.auth.onAuthStateChange(async (_event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
  setIsLoading(false);
  // ...
});
```

When user signs out in one tab:

- Other tabs don't redirect
- User sees stale authenticated UI
- API calls eventually fail with 401

## Existing Code Analysis

### AuthContext.tsx (192 lines)

**Good**:

- Has timeout fallback (prevents infinite loading)
- Has `onAuthStateChange` listener (foundation for cross-tab sync)
- Proper error handling structure

**Issues**:

- No `error` state exposed to consumers
- No retry mechanism
- signOut is not fail-safe
- Cross-tab sync incomplete

### client.ts (139 lines)

**Good**:

- Singleton pattern prevents multiple clients
- Lazy initialization
- Has `isSupabaseOnline()` helper

**Issues**:

- None directly related to auth failures
- Could add connection retry logic

### SignInForm.tsx (173 lines)

**Good**:

- Proper loading states
- Error display with DaisyUI alert
- Rate limiting integration

**Potential Issue**:

- `checkRateLimit()` call on line 51 - if this throws, form hangs
- Should wrap in try/catch

### conversations/page.tsx (182 lines)

**Good**:

- Already uses `useCallback` for `loadConversations`
- Has error state display

**Issues**:

- Depends on `authLoading` flag - if auth times out, still shows spinner
- Should handle auth error state

## Solution Design

### 1. Add Error State to AuthContext

```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null; // NEW
}
```

### 2. Implement Retry Logic

```typescript
async function getSessionWithRetry(
  maxRetries = 3,
  delays = [1000, 2000, 4000]
): Promise<Session | null> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error) return data.session;
      if (i < maxRetries) await sleep(delays[i]);
    } catch (e) {
      if (i < maxRetries) await sleep(delays[i]);
    }
  }
  throw new Error('Auth initialization failed after retries');
}
```

### 3. Fail-Safe Sign-Out

```typescript
const signOut = async () => {
  // Clear local state FIRST (fail-safe)
  setUser(null);
  setSession(null);

  // Then try Supabase (don't await/block on failure)
  supabase.auth.signOut().catch(() => {
    console.warn('Supabase signOut failed, local state already cleared');
  });

  // Force page reload to clear all React state
  window.location.href = '/';
};
```

### 4. Cross-Tab Sync

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT') {
    // Another tab signed out - redirect to home
    window.location.href = '/';
    return;
  }
  // ... existing logic
});
```

## Risk Assessment

| Risk                           | Likelihood | Impact | Mitigation                                  |
| ------------------------------ | ---------- | ------ | ------------------------------------------- |
| Retry logic causes delay       | Medium     | Low    | Show "Retrying..." feedback                 |
| Page reload loses unsaved data | Low        | Medium | Only reload on signOut (intentional action) |
| Cross-tab redirect race        | Low        | Low    | Use hard redirect (window.location.href)    |

## Testing Strategy

1. **Unit Tests**: Retry logic, fail-safe signOut
2. **Integration Tests**: AuthContext state transitions
3. **E2E Tests**: Full sign-in, sign-out, cross-tab flows

## References

- Supabase Auth Docs: https://supabase.com/docs/reference/javascript/auth-getsession
- Exponential Backoff: https://cloud.google.com/iot/docs/how-tos/exponential-backoff
