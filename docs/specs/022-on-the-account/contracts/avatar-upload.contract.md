# API Contract: Avatar Upload

**Feature**: 022-on-the-account
**Type**: Client-Side Storage Operation (Supabase Storage SDK)
**Date**: 2025-10-08

## Overview

This contract defines the client-side operations for uploading, replacing, and removing user avatars using Supabase Storage SDK.

**Key Characteristics**:

- All operations are client-side (no custom API endpoints needed)
- Uses Supabase Storage SDK (`@supabase/storage-js` via `@supabase/supabase-js`)
- RLS policies enforce security (users can only modify own avatars)

---

## Operation 1: Upload Avatar

### Request

**Method**: `supabase.storage.from('avatars').upload(path, file, options)`

**Parameters**:

```typescript
interface UploadAvatarRequest {
  path: string; // Format: `{userId}/{timestamp}.{ext}`
  file: File | Blob; // Cropped & compressed image
  options: {
    cacheControl: string; // '3600' (1 hour)
    upsert: boolean; // false (don't overwrite existing)
    contentType: string; // 'image/webp' | 'image/jpeg' | 'image/png'
  };
}
```

**Example**:

```typescript
const userId = '123e4567-e89b-12d3-a456-426614174000';
const timestamp = Date.now();
const path = `${userId}/${timestamp}.webp`;

const { data, error } = await supabase.storage
  .from('avatars')
  .upload(path, croppedImageBlob, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'image/webp',
  });
```

### Response

**Success** (HTTP 200):

```typescript
interface UploadAvatarResponse {
  data: {
    path: string; // 'userId/timestamp.webp'
    id: string; // UUID of storage object
    fullPath: string; // 'avatars/userId/timestamp.webp'
  };
  error: null;
}
```

**Example**:

```json
{
  "data": {
    "path": "123e4567-e89b-12d3-a456-426614174000/1696800000000.webp",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fullPath": "avatars/123e4567-e89b-12d3-a456-426614174000/1696800000000.webp"
  },
  "error": null
}
```

**Error Responses**:

| Error Code                      | HTTP Status | Cause                                     | Solution                                   |
| ------------------------------- | ----------- | ----------------------------------------- | ------------------------------------------ |
| `storage/object-already-exists` | 409         | File path already exists                  | Use unique timestamp or set `upsert: true` |
| `storage/payload-too-large`     | 413         | File > 5MB                                | Compress image more or reject client-side  |
| `storage/unauthorized`          | 401         | Not authenticated                         | Redirect to sign-in page                   |
| `storage/forbidden`             | 403         | Trying to upload to another user's folder | Client bug - userId mismatch               |
| `storage/bucket-not-found`      | 404         | Avatars bucket doesn't exist              | Run migration script                       |

**Error Example**:

```json
{
  "data": null,
  "error": {
    "statusCode": "413",
    "error": "Payload too large",
    "message": "The object exceeded the maximum allowed size"
  }
}
```

### Security

**RLS Policy**:

```sql
-- Only authenticated users can upload to their own folder
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Validation**:

- ✅ User must be authenticated
- ✅ Path must start with user's UUID
- ✅ File size must be ≤ 5MB (enforced by bucket config)
- ✅ MIME type must be image/jpeg, image/png, or image/webp

---

## Operation 2: Get Avatar Public URL

### Request

**Method**: `supabase.storage.from('avatars').getPublicUrl(path)`

**Parameters**:

```typescript
interface GetPublicUrlRequest {
  path: string; // Format: `{userId}/{timestamp}.{ext}`
}
```

**Example**:

```typescript
const path = '123e4567-e89b-12d3-a456-426614174000/1696800000000.webp';

const { data } = supabase.storage.from('avatars').getPublicUrl(path);
```

### Response

**Success** (Always returns data, even if file doesn't exist):

```typescript
interface GetPublicUrlResponse {
  data: {
    publicUrl: string; // Full public URL to access file
  };
}
```

**Example**:

```json
{
  "data": {
    "publicUrl": "https://abc123.supabase.co/storage/v1/object/public/avatars/123e4567-e89b-12d3-a456-426614174000/1696800000000.webp"
  }
}
```

**Note**: This method does NOT check if the file exists. It simply constructs the URL. If the file doesn't exist, the URL will return 404 when accessed.

### Security

**RLS Policy**:

```sql
-- Anyone can view (public read)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

**No Authentication Required**: Public URLs are accessible to anyone.

---

## Operation 3: Delete Avatar

### Request

**Method**: `supabase.storage.from('avatars').remove(paths)`

**Parameters**:

```typescript
interface DeleteAvatarRequest {
  paths: string[]; // Array of paths to delete
}
```

**Example**:

```typescript
const userId = '123e4567-e89b-12d3-a456-426614174000';
const oldAvatarPath = `${userId}/1696700000000.webp`;

const { data, error } = await supabase.storage
  .from('avatars')
  .remove([oldAvatarPath]);
```

### Response

**Success** (HTTP 200):

```typescript
interface DeleteAvatarResponse {
  data: {
    name: string; // File name that was deleted
    bucket_id: string; // 'avatars'
    owner: string; // User ID
    id: string; // Storage object UUID
    updated_at: string; // ISO timestamp
    created_at: string; // ISO timestamp
    last_accessed_at: string; // ISO timestamp
  }[];
  error: null;
}
```

**Example**:

```json
{
  "data": [
    {
      "name": "123e4567-e89b-12d3-a456-426614174000/1696700000000.webp",
      "bucket_id": "avatars",
      "owner": "123e4567-e89b-12d3-a456-426614174000",
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "updated_at": "2025-10-08T10:00:00.000Z",
      "created_at": "2025-10-07T14:30:00.000Z",
      "last_accessed_at": "2025-10-08T09:55:00.000Z"
    }
  ],
  "error": null
}
```

**Error Responses**:

| Error Code                 | HTTP Status | Cause                                | Solution                                   |
| -------------------------- | ----------- | ------------------------------------ | ------------------------------------------ |
| `storage/object-not-found` | 404         | File doesn't exist                   | Acceptable - may have been deleted already |
| `storage/unauthorized`     | 401         | Not authenticated                    | Redirect to sign-in page                   |
| `storage/forbidden`        | 403         | Trying to delete another user's file | Client bug - path mismatch                 |

**Error Example**:

```json
{
  "data": null,
  "error": {
    "statusCode": "404",
    "error": "Not found",
    "message": "The resource was not found"
  }
}
```

### Security

**RLS Policy**:

```sql
-- Only authenticated users can delete their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Validation**:

- ✅ User must be authenticated
- ✅ Path must start with user's UUID
- ✅ Cannot delete other users' files (enforced by RLS)

---

## Operation 4: Update User Profile Avatar URL

### Request

**Method**: `supabase.auth.updateUser({ data: { avatar_url } })`

**Note**: Avatar URL is stored in `user_metadata`, not directly in `user_profiles` table. The `user_profiles` table is updated via database trigger.

**Parameters**:

```typescript
interface UpdateProfileAvatarRequest {
  data: {
    avatar_url: string; // Public URL from getPublicUrl()
  };
}
```

**Example**:

```typescript
const publicUrl =
  'https://abc123.supabase.co/storage/v1/object/public/avatars/123e4567-e89b-12d3-a456-426614174000/1696800000000.webp';

const { data, error } = await supabase.auth.updateUser({
  data: { avatar_url: publicUrl },
});
```

### Response

**Success** (HTTP 200):

```typescript
interface UpdateProfileAvatarResponse {
  data: {
    user: {
      id: string;
      email: string;
      user_metadata: {
        avatar_url: string; // Updated URL
        username?: string;
        bio?: string;
      };
      // ... other user fields
    };
  };
  error: null;
}
```

**Example**:

```json
{
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "user_metadata": {
        "avatar_url": "https://abc123.supabase.co/storage/v1/object/public/avatars/123e4567-e89b-12d3-a456-426614174000/1696800000000.webp",
        "username": "testuser"
      }
    }
  },
  "error": null
}
```

**Error Responses**:

| Error Code          | HTTP Status | Cause              | Solution                       |
| ------------------- | ----------- | ------------------ | ------------------------------ |
| `unauthorized`      | 401         | Not authenticated  | Redirect to sign-in page       |
| `validation_failed` | 422         | Invalid URL format | Validate URL before submission |

---

## Complete Upload Flow (End-to-End)

```typescript
/**
 * Complete avatar upload flow
 * @param croppedImageBlob - Processed image from crop interface
 * @returns Public URL of uploaded avatar
 */
async function uploadAvatar(croppedImageBlob: Blob): Promise<string> {
  const supabase = createClient();

  // Step 1: Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('User not authenticated');
  }

  // Step 2: Generate unique file path
  const userId = user.id;
  const timestamp = Date.now();
  const fileExt = 'webp'; // Always use WebP for consistency
  const filePath = `${userId}/${timestamp}.${fileExt}`;

  // Step 3: Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, croppedImageBlob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/webp',
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Step 4: Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(uploadData.path);

  const publicUrl = urlData.publicUrl;

  // Step 5: Update user profile with new avatar URL
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl },
  });

  if (updateError) {
    // Rollback: Delete uploaded file
    await supabase.storage.from('avatars').remove([uploadData.path]);
    throw new Error(`Profile update failed: ${updateError.message}`);
  }

  // Step 6: Delete old avatar if exists
  const oldAvatarUrl = user.user_metadata?.avatar_url;
  if (oldAvatarUrl) {
    const oldPath = extractPathFromUrl(oldAvatarUrl);
    await supabase.storage.from('avatars').remove([oldPath]);
    // Note: Ignore errors on old file deletion (file may not exist)
  }

  return publicUrl;
}

/**
 * Extract storage path from public URL
 * @param url - Full public URL
 * @returns Storage path (userId/timestamp.ext)
 */
function extractPathFromUrl(url: string): string {
  // URL format: https://{project}.supabase.co/storage/v1/object/public/avatars/{path}
  const parts = url.split('/avatars/');
  return parts[1];
}
```

---

## Error Handling Strategy

### Client-Side Validation (Before API Call)

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateAvatarFile(file: File): ValidationResult {
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
    };
  }

  // Check file size (5MB = 5,242,880 bytes)
  if (file.size > 5242880) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit. Please choose a smaller image.',
    };
  }

  return { valid: true };
}
```

### Server-Side Errors (From Supabase Storage)

```typescript
function handleStorageError(error: StorageError): string {
  switch (error.statusCode) {
    case '401':
      return 'Please sign in to upload an avatar.';
    case '403':
      return 'You do not have permission to perform this action.';
    case '404':
      return 'Storage bucket not found. Please contact support.';
    case '409':
      return 'File already exists. Please try again.';
    case '413':
      return 'File size exceeds maximum limit (5MB).';
    default:
      return `Upload failed: ${error.message}`;
  }
}
```

---

## Performance Considerations

### Upload Optimization

**Strategy 1: Client-Side Compression**

```typescript
// Compress image to WebP format before upload
async function compressImage(blob: Blob): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const img = await createImageBitmap(blob);

  // Resize to 800x800px
  canvas.width = 800;
  canvas.height = 800;
  ctx.drawImage(img, 0, 0, 800, 800);

  // Convert to WebP with 85% quality
  return new Promise((resolve) => {
    canvas.toBlob(
      (compressedBlob) => {
        resolve(compressedBlob!);
      },
      'image/webp',
      0.85
    );
  });
}
```

**Strategy 2: Progress Indicator**

```typescript
// Supabase Storage SDK doesn't provide upload progress
// Use optimistic UI updates instead
setUploadStatus('uploading');
setProgress(50);  // Show indeterminate progress

const { data, error } = await supabase.storage.from('avatars').upload(...);

setProgress(100);
setUploadStatus('complete');
```

### Caching Strategy

**Browser Cache**:

```typescript
// Set cache control header on upload
{
  cacheControl: '3600'; // Cache for 1 hour
}
```

**CDN Caching**: Supabase Storage uses CDN by default - no additional configuration needed.

---

## Testing Contracts

### Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { uploadAvatar } from '@/lib/avatar/upload';

describe('Avatar Upload Contract', () => {
  it('should upload avatar and return public URL', async () => {
    const mockBlob = new Blob(['fake-image'], { type: 'image/webp' });

    const result = await uploadAvatar(mockBlob);

    expect(result).toMatch(
      /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/avatars\/.+$/
    );
  });

  it('should reject files > 5MB', async () => {
    const largeBlob = new Blob([new ArrayBuffer(6 * 1024 * 1024)], {
      type: 'image/webp',
    });

    await expect(uploadAvatar(largeBlob)).rejects.toThrow('exceeds 5MB limit');
  });

  it('should delete old avatar when uploading new one', async () => {
    const mockDelete = vi.spyOn(supabase.storage, 'remove');

    await uploadAvatar(mockBlob);

    expect(mockDelete).toHaveBeenCalledWith([
      expect.stringMatching(/\d+\.webp/),
    ]);
  });
});
```

### Integration Test Example

```typescript
import { test, expect } from '@playwright/test';

test('avatar upload flow', async ({ page }) => {
  // Sign in
  await page.goto('/sign-in');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Navigate to account settings
  await page.goto('/account-settings');

  // Upload avatar
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('e2e/fixtures/avatars/valid-medium.png');

  // Crop interface appears
  await expect(page.locator('[aria-label="Crop Your Avatar"]')).toBeVisible();

  // Save cropped avatar
  await page.click('button:has-text("Save")');

  // Avatar appears in UI
  await expect(page.locator('img[alt*="avatar"]')).toHaveAttribute(
    'src',
    /avatars/
  );
});
```

---

## Contract Versioning

**Version**: 1.0.0
**Last Updated**: 2025-10-08
**Breaking Changes**: N/A (initial version)

**Backward Compatibility**: N/A (new feature)

---

## Contract Conclusion

✅ **Upload Operation**: Defined with RLS security
✅ **Public URL Generation**: Simple, no authentication required
✅ **Delete Operation**: Secure, user-isolated
✅ **Profile Update**: Integrated with auth system
✅ **Error Handling**: Comprehensive error mapping
✅ **Performance**: Client-side compression + CDN caching
✅ **Testing**: Unit + Integration examples provided

**Status**: Ready for implementation.
