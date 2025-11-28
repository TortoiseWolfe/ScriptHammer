# Quickstart: User Avatar Upload

**Feature**: 022-on-the-account
**Date**: 2025-10-08
**Time to Complete**: 10 minutes setup + implementation

## Prerequisites

- ✅ Supabase project configured (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- ✅ User authentication implemented (PRP-016)
- ✅ Docker environment running
- ✅ Account Settings page exists (`/src/components/auth/AccountSettings/`)

---

## Step 1: Database Migration (2 minutes)

### Run Migration Script

```bash
# Copy migration script to Supabase migrations directory
cp specs/022-on-the-account/data-model.md /tmp/migration-content.md

# Extract SQL from data-model.md and create migration file
cat > supabase/migrations/20251008_avatar_upload.sql << 'EOF'
-- [Paste the SQL from data-model.md "Complete Migration" section]
EOF

# Apply migration
docker compose exec scripthammer npx supabase db push
```

**Verify Migration**:

```bash
# Check if avatar_url column exists
docker compose exec scripthammer npx supabase db execute \
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'avatar_url';"

# Check if avatars bucket exists
docker compose exec scripthammer npx supabase db execute \
  "SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';"
```

**Expected Output**:

```
column_name
-----------
avatar_url

id      | name    | public
--------|---------|-------
avatars | avatars | t
```

---

## Step 2: Install Dependencies (1 minute)

### Add react-easy-crop Library

```bash
docker compose exec scripthammer pnpm add react-easy-crop
```

**Verify Installation**:

```bash
docker compose exec scripthammer pnpm list react-easy-crop
```

**Expected Output**:

```
react-easy-crop 5.0.0
```

---

## Step 3: Generate Components (2 minutes)

### Generate AvatarUpload Component

```bash
docker compose exec scripthammer pnpm run generate:component -- \
  --name AvatarUpload \
  --category atomic \
  --hasProps true \
  --withHooks true
```

**Expected Output**:

```
✔ Component AvatarUpload created successfully!
  Created: src/components/atomic/AvatarUpload/index.tsx
  Created: src/components/atomic/AvatarUpload/AvatarUpload.tsx
  Created: src/components/atomic/AvatarUpload/AvatarUpload.test.tsx
  Created: src/components/atomic/AvatarUpload/AvatarUpload.stories.tsx
  Created: src/components/atomic/AvatarUpload/AvatarUpload.accessibility.test.tsx
```

### Generate AvatarDisplay Component

```bash
docker compose exec scripthammer pnpm run generate:component -- \
  --name AvatarDisplay \
  --category atomic \
  --hasProps true \
  --withHooks false
```

**Expected Output**:

```
✔ Component AvatarDisplay created successfully!
  Created: src/components/atomic/AvatarDisplay/index.tsx
  Created: src/components/atomic/AvatarDisplay/AvatarDisplay.tsx
  Created: src/components/atomic/AvatarDisplay/AvatarDisplay.test.tsx
  Created: src/components/atomic/AvatarDisplay/AvatarDisplay.stories.tsx
  Created: src/components/atomic/AvatarDisplay/AvatarDisplay.accessibility.test.tsx
```

---

## Step 4: Implement Core Upload Logic (Guided)

### File: `src/lib/avatar/upload.ts`

Create utility functions for avatar upload:

```typescript
import { createClient } from '@/lib/supabase/client';

export interface UploadAvatarResult {
  url: string;
  error?: string;
}

/**
 * Upload cropped avatar to Supabase Storage
 * @param croppedImageBlob - Processed image from crop interface
 * @returns Public URL of uploaded avatar or error
 */
export async function uploadAvatar(
  croppedImageBlob: Blob
): Promise<UploadAvatarResult> {
  const supabase = createClient();

  // Step 1: Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { url: '', error: 'User not authenticated' };
  }

  // Step 2: Generate unique file path
  const userId = user.id;
  const timestamp = Date.now();
  const filePath = `${userId}/${timestamp}.webp`;

  // Step 3: Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, croppedImageBlob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp',
    });

  if (uploadError) {
    return { url: '', error: `Upload failed: ${uploadError.message}` };
  }

  // Step 4: Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(uploadData.path);

  const publicUrl = urlData.publicUrl;

  // Step 5: Update user profile
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl },
  });

  if (updateError) {
    // Rollback: Delete uploaded file
    await supabase.storage.from('avatars').remove([uploadData.path]);
    return { url: '', error: `Profile update failed: ${updateError.message}` };
  }

  // Step 6: Delete old avatar if exists
  const oldAvatarUrl = user.user_metadata?.avatar_url;
  if (oldAvatarUrl) {
    const oldPath = extractPathFromUrl(oldAvatarUrl);
    await supabase.storage.from('avatars').remove([oldPath]);
    // Ignore errors on old file deletion
  }

  return { url: publicUrl };
}

/**
 * Remove user avatar
 */
export async function removeAvatar(): Promise<{ error?: string }> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'User not authenticated' };
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  if (!avatarUrl) {
    return {}; // No avatar to remove
  }

  // Step 1: Clear avatar URL from profile
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: null },
  });

  if (updateError) {
    return { error: `Failed to remove avatar: ${updateError.message}` };
  }

  // Step 2: Delete file from storage
  const path = extractPathFromUrl(avatarUrl);
  await supabase.storage.from('avatars').remove([path]);
  // Ignore errors on file deletion

  return {};
}

/**
 * Extract storage path from public URL
 */
function extractPathFromUrl(url: string): string {
  const parts = url.split('/avatars/');
  return parts[1] || '';
}
```

**Create File**:

```bash
mkdir -p src/lib/avatar
# Then paste the code above into src/lib/avatar/upload.ts
```

---

## Step 5: Test Setup (2 minutes)

### Create Test Fixtures

```bash
# Create fixtures directory
mkdir -p e2e/fixtures/avatars

# Download test images (or use your own)
# Place these files in e2e/fixtures/avatars/:
# - valid-small.jpg (200x200px, ~10KB)
# - valid-medium.png (1024x1024px, ~500KB)
# - invalid-toolarge.jpg (>5MB)
```

### Run Initial Tests

```bash
# Type check
docker compose exec scripthammer pnpm run type-check

# Unit tests
docker compose exec scripthammer pnpm test src/lib/avatar

# Lint
docker compose exec scripthammer pnpm run lint
```

---

## Step 6: Quick Verification (3 minutes)

### Manual Test (Browser)

1. **Start dev server**:

   ```bash
   docker compose exec scripthammer pnpm run dev
   ```

2. **Navigate to Account Settings**:

   ```
   http://localhost:3000/account-settings
   ```

3. **Test upload** (after implementing UI):
   - Click "Upload Avatar"
   - Select test image
   - Verify crop interface appears
   - Save cropped avatar
   - Verify avatar displays

### Database Verification

```bash
# Check if avatar_url was updated
docker compose exec scripthammer npx supabase db execute \
  "SELECT id, username, avatar_url FROM user_profiles WHERE avatar_url IS NOT NULL LIMIT 5;"
```

**Expected Output**:

```
id                                   | username  | avatar_url
-------------------------------------|-----------|------------------------------------------
123e4567-e89b-12d3-a456-426614174000 | testuser  | https://.../avatars/123.../1696800000.webp
```

### Storage Verification

```bash
# List uploaded avatars
docker compose exec scripthammer npx supabase storage ls avatars
```

**Expected Output**:

```
┌────────────────────────────────────────┐
│ name                                   │
├────────────────────────────────────────┤
│ 123e4567-e89b-12d3-a456-426614174000/  │
└────────────────────────────────────────┘
```

---

## Common Issues & Solutions

### Issue 1: Migration Fails with "bucket already exists"

**Cause**: Re-running migration on existing bucket

**Solution**:

```sql
-- Use ON CONFLICT in migration script
INSERT INTO storage.buckets (...)
VALUES (...)
ON CONFLICT (id) DO NOTHING;
```

### Issue 2: Upload Returns 403 Forbidden

**Cause**: RLS policies not applied correctly

**Solution**:

```bash
# Re-run migration to create policies
docker compose exec scripthammer npx supabase db push

# Verify policies exist
docker compose exec scripthammer npx supabase db execute \
  "SELECT policyname FROM pg_policies WHERE tablename = 'objects';"
```

### Issue 3: Avatar URL Not Updating in UI

**Cause**: Auth context not refreshing after profile update

**Solution**:

```typescript
// In AvatarUpload component, manually refresh user session
const { data, error } = await supabase.auth.updateUser({
  data: { avatar_url },
});
if (!error) {
  // Trigger context refresh
  window.location.reload(); // Or use AuthContext refresh method
}
```

### Issue 4: TypeScript Errors in Generated Components

**Cause**: Component generator templates don't match avatar-specific logic

**Solution**:

```bash
# Regenerate with correct types
docker compose exec scripthammer pnpm run generate:component -- \
  --name AvatarUpload \
  --category atomic \
  --hasProps true \
  --withHooks true

# Then manually update prop types in AvatarUpload.tsx
```

---

## Development Workflow

### Daily Development Commands

```bash
# Start dev server
docker compose exec scripthammer pnpm run dev

# Run tests in watch mode
docker compose exec scripthammer pnpm test -- --watch

# Type checking
docker compose exec scripthammer pnpm run type-check

# Lint
docker compose exec scripthammer pnpm run lint
```

### Before Committing

```bash
# Run full test suite
docker compose exec scripthammer pnpm run test:suite

# Run accessibility tests
docker compose exec scripthammer pnpm run test:a11y:dev
```

---

## Next Steps

After completing quickstart:

1. **Implement AvatarUpload UI** (see tasks.md when generated)
   - File picker
   - Crop interface with react-easy-crop
   - Progress indicator
   - Error handling

2. **Implement AvatarDisplay Component**
   - Display avatar from URL
   - Fallback to initials when no avatar
   - Lazy loading for performance

3. **Integrate with AccountSettings**
   - Add "Avatar" section
   - Include AvatarUpload component
   - Add "Remove Avatar" button

4. **Write Tests**
   - Unit tests for upload logic
   - Integration tests for API operations
   - E2E tests for user flow
   - Accessibility tests (Pa11y + manual)

5. **Performance Optimization**
   - Image compression
   - Lazy loading
   - CDN caching

6. **Edge Case Handling**
   - Network failures
   - Storage quota exceeded
   - Invalid files
   - Concurrent uploads

---

## Resources

### Documentation

- **Supabase Storage**: https://supabase.com/docs/guides/storage
- **react-easy-crop**: https://github.com/ValentinH/react-easy-crop
- **Canvas API**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

### Internal Documentation

- **Feature Spec**: `/specs/022-on-the-account/spec.md`
- **Data Model**: `/specs/022-on-the-account/data-model.md`
- **API Contract**: `/specs/022-on-the-account/contracts/avatar-upload.contract.md`
- **Tasks** (when generated): `/specs/022-on-the-account/tasks.md`

### Project Guides

- **Component Generator**: `CLAUDE.md` lines 65-84
- **Mobile-First Design**: `CLAUDE.md` lines 191-293
- **Testing**: `CLAUDE.md` lines 86-105

---

## Quickstart Checklist

Before moving to implementation, verify:

- [x] Database migration applied successfully
- [x] Avatars bucket exists in Supabase Storage
- [x] RLS policies created (4 policies)
- [x] react-easy-crop dependency installed
- [x] AvatarUpload component generated (5 files)
- [x] AvatarDisplay component generated (5 files)
- [x] Upload utility functions created (`src/lib/avatar/upload.ts`)
- [x] Test fixtures prepared (`e2e/fixtures/avatars/`)
- [x] Dev server running without errors
- [x] Type checking passes
- [x] All documentation read

**Status**: ✅ Ready to implement avatar upload UI

---

## Time Estimate

**Total Setup Time**: ~10 minutes

- Step 1 (Migration): 2 minutes
- Step 2 (Dependencies): 1 minute
- Step 3 (Generate Components): 2 minutes
- Step 4 (Upload Logic): 3 minutes (copy-paste)
- Step 5 (Test Setup): 2 minutes

**Implementation Time** (after quickstart): ~4-6 hours

- AvatarUpload UI: 2-3 hours
- AvatarDisplay component: 1 hour
- Integration: 30 minutes
- Testing: 1-2 hours

**Total Feature Time**: ~5-7 hours from start to production-ready
