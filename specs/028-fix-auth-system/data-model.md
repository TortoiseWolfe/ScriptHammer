# Data Model: Auth System

**Feature**: 028-fix-auth-system
**Date**: 2025-11-24

## State Model Changes

### Current AuthState

```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
```

### Updated AuthState

```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null; // NEW: Error state for UI display
  retryCount: number; // NEW: Track retry attempts
}

interface AuthError {
  code: 'TIMEOUT' | 'NETWORK' | 'AUTH_FAILED' | 'UNKNOWN';
  message: string;
  retryable: boolean;
}
```

### Updated AuthContextType

```typescript
interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>; // CHANGED: No longer returns error (fail-safe)
  refreshSession: () => Promise<void>;
  retry: () => Promise<void>; // NEW: Manual retry for auth init
  clearError: () => void; // NEW: Clear error state
}
```

## State Transitions

```
Initial Load:
  LOADING → [getSession] → SUCCESS (user set)
                        → RETRY_1 (1s delay) → RETRY_2 (2s) → RETRY_3 (4s) → ERROR

Sign In:
  IDLE → LOADING → SUCCESS (user set)
                → ERROR (show message)

Sign Out:
  AUTHENTICATED → [clear local state] → [supabase.signOut] → REDIRECT (/)
                                                          → REDIRECT (/) // even on failure

Cross-Tab Sign Out:
  ANY_STATE → [onAuthStateChange: SIGNED_OUT] → REDIRECT (/)
```

## Error Codes

| Code        | Meaning                            | Retryable | User Message                                         |
| ----------- | ---------------------------------- | --------- | ---------------------------------------------------- |
| TIMEOUT     | getSession() didn't complete in 5s | Yes       | "Authentication taking longer than expected"         |
| NETWORK     | Network/connection failure         | Yes       | "Unable to connect. Check your internet connection." |
| AUTH_FAILED | Invalid credentials or session     | No        | "Sign in failed. Please try again."                  |
| UNKNOWN     | Unexpected error                   | Yes       | "Something went wrong. Please try again."            |

## Local Storage

No changes to local storage schema. Supabase manages session storage:

```
supabase.auth.token = {
  access_token: string,
  refresh_token: string,
  expires_at: number,
  user: User
}
```

## No Database Changes

This feature modifies client-side state only. No Supabase database schema changes required.
