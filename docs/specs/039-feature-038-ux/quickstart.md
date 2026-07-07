# Quickstart: UX Polish

**Feature**: 039-feature-038-ux | **Date**: 2025-11-26

## Overview

Fix 4 UX issues in existing components. No new components needed.

## Prerequisites

- Docker environment running (`docker compose up`)
- Feature branch `039-feature-038-ux` checked out
- Dev server available at `http://localhost:3000`

## Files to Modify

| Priority | File                                                                         | Changes                                                          |
| -------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| P1       | `src/components/auth/AccountSettings/AccountSettings.tsx`                    | Split error states, add refetchProfile calls, move alerts inline |
| P1       | `src/components/auth/AccountSettings/AccountSettings.test.tsx`               | Update tests for split error states                              |
| P1       | `src/components/auth/AccountSettings/AccountSettings.accessibility.test.tsx` | Update for inline alerts                                         |
| P2       | `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx`                 | Investigate/fix Find People tab visibility                       |

## Implementation Steps

### Step 1: Fix Avatar Reactive Updates

**File**: `src/components/auth/AccountSettings/AccountSettings.tsx`

Add `refetchProfile()` call after avatar operations:

```typescript
// Line ~187: handleAvatarUploadComplete
const handleAvatarUploadComplete = async (url: string) => {
  setAvatarUrl(url);
  await refreshSession();
  await refetchProfile();  // ADD THIS LINE
};

// Line ~206: handleRemoveAvatar (inside success block)
} else {
  setAvatarUrl(null);
  await refreshSession();
  await refetchProfile();  // ADD THIS LINE
}
```

### Step 2: Split Error States

**File**: `src/components/auth/AccountSettings/AccountSettings.tsx`

Replace shared state:

```typescript
// REMOVE these lines (~54-55):
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState(false);

// ADD these lines:
const [profileError, setProfileError] = useState<string | null>(null);
const [profileSuccess, setProfileSuccess] = useState(false);
const [passwordError, setPasswordError] = useState<string | null>(null);
const [passwordSuccess, setPasswordSuccess] = useState(false);
```

### Step 3: Update Profile Form Handlers

**File**: `src/components/auth/AccountSettings/AccountSettings.tsx`

Update `handleUpdateProfile`:

```typescript
const handleUpdateProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  setProfileError(null); // CHANGE from setError
  setProfileSuccess(false); // CHANGE from setSuccess

  // ... validation and API call ...

  if (updateError) {
    setProfileError('Failed to update profile.'); // CHANGE
  } else if (!data) {
    setProfileError('Profile update failed.'); // CHANGE
  } else {
    setProfileSuccess(true); // CHANGE
    await refetchProfile();
    setTimeout(() => setProfileSuccess(false), 3000);
  }
};
```

### Step 4: Update Password Form Handlers

**File**: `src/components/auth/AccountSettings/AccountSettings.tsx`

Update `handleChangePassword`:

```typescript
const handleChangePassword = async (e: React.FormEvent) => {
  e.preventDefault();
  setPasswordError(null); // CHANGE from setError
  setPasswordSuccess(false); // CHANGE from setSuccess

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    setPasswordError(passwordValidation.error); // CHANGE
    return;
  }

  if (password !== confirmPassword) {
    setPasswordError('Passwords do not match'); // CHANGE
    return;
  }

  // ... API call ...

  if (updateError) {
    setPasswordError(updateError.message); // CHANGE
  } else {
    setPasswordSuccess(true); // CHANGE
    setPassword('');
    setConfirmPassword('');
  }
};
```

### Step 5: Move Alerts Inline

**File**: `src/components/auth/AccountSettings/AccountSettings.tsx`

Add alerts INSIDE each card, after the submit button:

```tsx
{
  /* Inside Profile Settings card, after Update Profile button */
}
{
  profileError && (
    <div role="alert" aria-live="assertive" className="alert alert-error mt-4">
      <span>{profileError}</span>
    </div>
  );
}
{
  profileSuccess && (
    <div role="status" aria-live="polite" className="alert alert-success mt-4">
      <span>Profile updated successfully!</span>
    </div>
  );
}

{
  /* Inside Change Password card, after Change Password button */
}
{
  passwordError && (
    <div role="alert" aria-live="assertive" className="alert alert-error mt-4">
      <span>{passwordError}</span>
    </div>
  );
}
{
  passwordSuccess && (
    <div role="status" aria-live="polite" className="alert alert-success mt-4">
      <span>Password changed successfully!</span>
    </div>
  );
}
```

### Step 6: Remove Bottom Alerts

**File**: `src/components/auth/AccountSettings/AccountSettings.tsx`

DELETE the alerts at the bottom of the component (~lines 416-426):

```tsx
// DELETE THESE LINES:
{
  error && (
    <div className="alert alert-error">
      <span>{error}</span>
    </div>
  );
}

{
  success && (
    <div className="alert alert-success">
      <span>Settings updated successfully!</span>
    </div>
  );
}
```

### Step 7: Investigate Find People Tab

**File**: `src/components/organisms/UnifiedSidebar/UnifiedSidebar.tsx`

1. Open browser DevTools on `/messages` page
2. Inspect the tabs container for:
   - All 3 tab buttons present in DOM
   - CSS `overflow: hidden` cutting off tabs
   - JavaScript errors in console
3. If tabs truncated, add `flex-shrink-0` to each tab:

```tsx
<button
  role="tab"
  className={`tab min-h-11 flex-shrink-0 ${activeTab === 'find' ? 'tab-active' : ''}`}
>
  Find People
</button>
```

## Testing

### Manual Verification

1. **Avatar Update Test**:
   - Go to `/account`
   - Upload new avatar
   - Verify navbar avatar updates within 1 second (no refresh)

2. **Password Validation Test**:
   - Go to `/account`
   - Enter invalid password
   - Verify error appears in Change Password card (not bottom)

3. **Password Update Test**:
   - Enter valid password meeting all requirements
   - Submit and verify success message
   - Log out and log back in with new password

4. **Find People Tab Test**:
   - Go to `/messages`
   - Verify 3 tabs visible: Chats, Connections, Find People
   - Click Find People, verify UserSearch renders

### Automated Tests

```bash
# Run AccountSettings tests
docker compose exec scripthammer pnpm test -- AccountSettings

# Run all tests
docker compose exec scripthammer pnpm test

# Type check
docker compose exec scripthammer pnpm run type-check
```

## Verification Checklist

- [ ] Avatar updates in navbar immediately after upload
- [ ] Avatar updates in navbar immediately after removal
- [ ] Profile validation errors appear in Profile Settings card
- [ ] Profile success appears in Profile Settings card
- [ ] Password validation errors appear in Change Password card
- [ ] Password success appears in Change Password card
- [ ] No alerts at bottom of page
- [ ] Password update actually works (can login with new password)
- [ ] Find People tab visible on desktop
- [ ] Find People tab visible on mobile drawer
- [ ] All existing tests pass
- [ ] No accessibility regressions (ARIA attributes maintained)
