# Research: UX Polish

**Feature**: 039-feature-038-ux | **Date**: 2025-11-26 | **Status**: Complete

## Summary

This research documents the root causes of 4 UX issues discovered during manual testing of Feature 037 (Unified Messaging Sidebar).

## Issue Analysis

### Issue 1: Avatar Not Updating in Navbar

**Location**: `src/components/auth/AccountSettings/AccountSettings.tsx:185-188`

**Root Cause**: `handleAvatarUploadComplete()` calls `refreshSession()` but NOT `refetchProfile()`.

```typescript
const handleAvatarUploadComplete = async (url: string) => {
  setAvatarUrl(url);
  await refreshSession(); // Refresh to get updated user metadata
  // MISSING: await refetchProfile();
};
```

**Impact**: GlobalNav at `src/components/GlobalNav.tsx:223-231` reads avatar from `profile?.avatar_url` via `useUserProfile()` hook. The hook caches the profile data and doesn't re-fetch until explicitly told to.

**Fix**: Add `await refetchProfile()` after avatar upload and removal operations.

---

### Issue 2: Password Validation Messages at Bottom of Page

**Location**: `src/components/auth/AccountSettings/AccountSettings.tsx:416-426`

**Root Cause**: Single shared error/success state for both profile AND password forms, rendered at bottom.

```typescript
// Lines 54-55: Single shared state
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState(false);

// Lines 416-426: Rendered at very bottom, far from inputs
{error && (
  <div className="alert alert-error">
    <span>{error}</span>
  </div>
)}
```

**Impact**: User must scroll to see validation messages, causing confusion.

**Fix**:

1. Split into separate states: `profileError`, `profileSuccess`, `passwordError`, `passwordSuccess`
2. Move alerts inline within each form card
3. Remove bottom-of-page alerts

---

### Issue 3: Password Update Not Working

**Location**: `src/components/auth/AccountSettings/AccountSettings.tsx:126-175`

**Root Cause**: Investigation needed. The code at line 144 appears correct:

```typescript
const { error: updateError } = await supabase.auth.updateUser({
  password,
});
```

**Potential Causes**:

1. Supabase session expired or invalid
2. Password not meeting Supabase minimum requirements (separate from app validation)
3. Rate limiting on password changes
4. Missing re-authentication requirement for sensitive operations

**Diagnostic Path**:

1. Check browser console for API errors
2. Verify Supabase dashboard auth settings
3. Test if error is returned and displayed (may be masked by Issue 2)

**Most Likely**: Error IS being returned but user doesn't see it due to Issue 2 (validation messages at bottom). Fixing Issue 2 may reveal the actual error.

---

### Issue 4: Find People Tab Missing

**Location**: `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx:87-94`

**Root Cause**: The tab IS defined in code but may not be rendering due to:

1. CSS issue (hidden/overflow)
2. Tab container width insufficient
3. JavaScript error preventing render
4. Parent container constraint

Code shows tab exists:

```typescript
<button
  role="tab"
  aria-selected={activeTab === 'find'}
  className={`tab min-h-11 ${activeTab === 'find' ? 'tab-active' : ''}`}
  onClick={() => onTabChange('find')}
>
  Find People
</button>
```

**Diagnostic Path**:

1. Check browser DevTools for element presence
2. Verify parent container allows 3 tabs
3. Check for JS console errors
4. Test with explicit width on tabs container

---

## Component Inventory

| Component          | Location                                 | Modification Needed                      |
| ------------------ | ---------------------------------------- | ---------------------------------------- |
| AccountSettings    | src/components/auth/AccountSettings/     | Yes - error states, refetchProfile calls |
| GlobalNav          | src/components/GlobalNav.tsx             | No - reads correctly from useUserProfile |
| useUserProfile     | src/hooks/useUserProfile.ts              | No - refetch() method exists             |
| UnifiedSidebar     | src/components/organisms/UnifiedSidebar/ | Investigate - may need CSS fix           |
| password-validator | src/lib/auth/password-validator.ts       | No - validation works correctly          |

## Existing Patterns

### Error State Pattern (Current - Flawed)

```typescript
// Single shared state for entire page
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState(false);
```

### Error State Pattern (Target - Per-Form)

```typescript
// Separate states per form
const [profileError, setProfileError] = useState<string | null>(null);
const [profileSuccess, setProfileSuccess] = useState(false);
const [passwordError, setPasswordError] = useState<string | null>(null);
const [passwordSuccess, setPasswordSuccess] = useState(false);
```

### Profile Refresh Pattern

```typescript
// useUserProfile hook provides refetch
const { profile, refetch: refetchProfile } = useUserProfile();

// Call after any profile data change
await refetchProfile();
```

## Test Coverage Analysis

| File                                   | Has Tests | Coverage                            |
| -------------------------------------- | --------- | ----------------------------------- |
| AccountSettings.test.tsx               | Yes       | Needs update for split error states |
| AccountSettings.accessibility.test.tsx | Yes       | Needs update for inline alerts      |
| UnifiedSidebar.test.tsx                | Yes       | May need visibility assertions      |

## Risk Assessment

| Change                   | Risk   | Mitigation                                |
| ------------------------ | ------ | ----------------------------------------- |
| Split error states       | Low    | Straightforward state management refactor |
| Add refetchProfile calls | Low    | Adding calls, not changing flow           |
| Move alerts inline       | Medium | Must maintain ARIA attributes             |
| Fix Find People tab      | Low    | Likely CSS or container issue             |
