# Data Model: UX Polish

**Feature**: 039-feature-038-ux | **Date**: 2025-11-26

## Overview

This feature involves UX fixes only - no schema changes required. Documentation focuses on component state changes.

## No Schema Changes Required

This feature fixes existing functionality without database modifications:

- Avatar URLs already stored in `user_profiles.avatar_url`
- Password updates use Supabase Auth (no custom tables)
- UnifiedSidebar reads from existing data sources

## Component State Changes

### AccountSettings State Model

**Current State (Flawed)**

```typescript
interface AccountSettingsState {
  // Profile form
  displayName: string;
  bio: string;
  avatarUrl: string | null;

  // Password form
  password: string;
  confirmPassword: string;

  // PROBLEM: Shared state for both forms
  error: string | null; // Single error for all forms
  success: boolean; // Single success for all forms
  loading: boolean;

  // UI state
  removingAvatar: boolean;
  isDeleteModalOpen: boolean;
  isUpdatingProfile: boolean;
}
```

**Target State (Fixed)**

```typescript
interface AccountSettingsState {
  // Profile form
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  profileError: string | null; // NEW: Isolated profile error
  profileSuccess: boolean; // NEW: Isolated profile success

  // Password form
  password: string;
  confirmPassword: string;
  passwordError: string | null; // NEW: Isolated password error
  passwordSuccess: boolean; // NEW: Isolated password success

  // UI state
  loading: boolean;
  removingAvatar: boolean;
  isDeleteModalOpen: boolean;
  isUpdatingProfile: boolean;
}
```

### State Transitions

```
Profile Update Flow:
┌─────────────────────────────────────────────────────┐
│ User clicks "Update Profile"                        │
│      ↓                                              │
│ setProfileError(null); setProfileSuccess(false);    │
│      ↓                                              │
│ [Validation] → Invalid → setProfileError(msg)       │
│      ↓ Valid                                        │
│ setIsUpdatingProfile(true)                          │
│      ↓                                              │
│ await supabase.from('user_profiles').upsert()       │
│      ↓                                              │
│ Error → setProfileError(msg)                        │
│ Success → setProfileSuccess(true); refetchProfile() │
│      ↓                                              │
│ setTimeout → setProfileSuccess(false)               │
└─────────────────────────────────────────────────────┘

Password Update Flow:
┌─────────────────────────────────────────────────────┐
│ User clicks "Change Password"                       │
│      ↓                                              │
│ setPasswordError(null); setPasswordSuccess(false);  │
│      ↓                                              │
│ [Validation] → Invalid → setPasswordError(msg)      │
│      ↓ Valid                                        │
│ setLoading(true)                                    │
│      ↓                                              │
│ await supabase.auth.updateUser({ password })        │
│      ↓                                              │
│ Error → setPasswordError(msg)                       │
│ Success → setPasswordSuccess(true); clear fields    │
└─────────────────────────────────────────────────────┘

Avatar Update Flow:
┌─────────────────────────────────────────────────────┐
│ User uploads avatar successfully                    │
│      ↓                                              │
│ handleAvatarUploadComplete(url)                     │
│      ↓                                              │
│ setAvatarUrl(url)                                   │
│      ↓                                              │
│ await refreshSession()  // Auth metadata            │
│      ↓                                              │
│ await refetchProfile()  // NEW: Update cache        │
│      ↓                                              │
│ GlobalNav re-renders with new avatar                │
└─────────────────────────────────────────────────────┘
```

## UI Component Structure

### AccountSettings Layout (Target)

```
┌─────────────────────────────────────────────────────┐
│ [Profile Settings Card]                             │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Display Name: [__________]                      │ │
│ │ Bio: [__________]                               │ │
│ │                                                 │ │
│ │ [Update Profile]                                │ │
│ │                                                 │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ ✓ Profile updated successfully!  [INLINE]   │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Avatar Settings Card]                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [Avatar Display] [Upload] [Remove]              │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Change Password Card]                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ New Password: [__________]                      │ │
│ │ Confirm Password: [__________]                  │ │
│ │                                                 │ │
│ │ [Change Password]                               │ │
│ │                                                 │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ ✗ Password must be 8+ characters  [INLINE]  │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Privacy & Data Card]                               │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [Export Data] [Delete Account]                  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ← REMOVED: Bottom-of-page alerts                    │
└─────────────────────────────────────────────────────┘
```

## Accessibility Requirements

### ARIA Attributes for Inline Alerts

```typescript
// Error alert
<div
  role="alert"
  aria-live="assertive"
  className="alert alert-error mt-4"
>
  <span>{passwordError}</span>
</div>

// Success alert
<div
  role="status"
  aria-live="polite"
  className="alert alert-success mt-4"
>
  <span>Password changed successfully!</span>
</div>
```

### Focus Management

- After validation error: Focus should remain on the form that had the error
- After successful password change: Focus returns to password form for potential follow-up
- Tab order maintained within each card

## Type Definitions

No new types required. Existing types used:

- `UserProfile` from `src/hooks/useUserProfile.ts`
- `SidebarTab` from `src/types/messaging.ts` (values: 'chats' | 'connections' | 'find')
