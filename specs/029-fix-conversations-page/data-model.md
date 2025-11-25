# Data Model: Conversations Page State

**Feature**: 029-fix-conversations-page
**Date**: 2025-11-25

## State Variables

### Component State

| Variable        | Type             | Initial | Description                   |
| --------------- | ---------------- | ------- | ----------------------------- |
| `conversations` | `Conversation[]` | `[]`    | List of user's conversations  |
| `loading`       | `boolean`        | `true`  | Whether data is being fetched |
| `error`         | `string \| null` | `null`  | Error message to display      |

### Auth Context State (External)

| Variable                  | Type                | Description                     |
| ------------------------- | ------------------- | ------------------------------- |
| `user`                    | `User \| null`      | Authenticated user or null      |
| `isLoading` (authLoading) | `boolean`           | Auth initialization in progress |
| `error` (authError)       | `AuthError \| null` | Auth-level error                |

## Conversation Entity

```typescript
interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string | null;
  created_at: string;
  participant_name: string; // Derived from user_profiles
  participant_username: string; // Derived from user_profiles
}
```

## State Transitions

### Loading State Machine

```
INITIAL (loading=true)
    │
    ├─[authError]──────────────────────► ERROR (authError displayed)
    │
    ├─[authLoading=false, user=null]───► ERROR ("Please sign in")
    │
    └─[authLoading=false, user exists]─► FETCHING
                                            │
         ┌──────────────────────────────────┤
         │                                  │
         ▼                                  ▼
    TIMEOUT (10s)                      QUERY COMPLETE
         │                                  │
         ▼                           ┌──────┴──────┐
    ERROR (timeout)                  │             │
                                     ▼             ▼
                               SUCCESS         ERROR
                            (conversations)    (query error)
```

### Valid End States

1. **Content**: `loading=false`, `error=null`, `conversations.length > 0`
2. **Empty**: `loading=false`, `error=null`, `conversations.length === 0`
3. **Error**: `loading=false`, `error !== null`

### Invalid States (Must Prevent)

- `loading=true` indefinitely (infinite spinner)
- `loading=true` with `error !== null` (conflicting state)
