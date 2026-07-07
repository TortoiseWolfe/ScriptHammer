# Data Model: User Avatar Upload

**Feature**: 022-on-the-account
**Date**: 2025-10-08
**Status**: Phase 1 Complete

## Database Schema Changes

### 1. user_profiles Table Modification

**Add Column**:

```sql
ALTER TABLE user_profiles
ADD COLUMN avatar_url TEXT;

COMMENT ON COLUMN user_profiles.avatar_url IS 'URL to user avatar in Supabase Storage (public read)';
```

**Column Specification**:

- **Name**: `avatar_url`
- **Type**: `TEXT` (NULL allowed - users may not have avatar)
- **Purpose**: Store public URL to avatar image in Supabase Storage
- **Format**: `https://{project}.supabase.co/storage/v1/object/public/avatars/{user_id}/{timestamp}.{ext}`
- **Example**: `https://abc123.supabase.co/storage/v1/object/public/avatars/123e4567-e89b-12d3-a456-426614174000/1696800000000.webp`

**Indexes** (none required):

- No index needed - avatar_url only accessed when loading user profile
- User lookups already indexed on `id` column

### 2. Supabase Storage Configuration

**Bucket Creation**:

```sql
-- Create avatars bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public read access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);
```

**Bucket Properties**:

- **Name**: `avatars`
- **Public**: `true` (anyone can read via public URL)
- **File Size Limit**: 5MB (5,242,880 bytes)
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`

**File Path Structure**:

```
avatars/
└── {user_id}/
    ├── {timestamp1}.webp  (current avatar)
    └── {timestamp2}.webp  (replaced - will be deleted)
```

**Example**:

```
avatars/123e4567-e89b-12d3-a456-426614174000/1696800000000.webp
```

---

## Row Level Security (RLS) Policies

### Storage Object Policies

**Policy 1: Users Can Upload Own Avatar**

```sql
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Explanation**:

- Users must be authenticated to upload
- Files must be in `avatars` bucket
- Folder name (first part of path) must match user's UUID
- Prevents users from uploading to other users' folders

**Policy 2: Users Can Update Own Avatar**

```sql
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Explanation**:

- Users can only update (replace) files in their own folder
- Ensures users can't modify other users' avatars

**Policy 3: Users Can Delete Own Avatar**

```sql
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Explanation**:

- Users can only delete files in their own folder
- Required for "Remove Avatar" and "Replace Avatar" operations

**Policy 4: Anyone Can View Avatars**

```sql
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

**Explanation**:

- Public read access to all avatars (no authentication required)
- Allows avatars to be displayed on public profiles, comment sections, etc.
- Files served via public URL: `/storage/v1/object/public/avatars/{path}`

---

## Data Flow Diagrams

### Upload Flow (P1 - Core MVP)

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ 1. Select image file
       ├──────────────────────────────────────┐
       │                                      │
       │ 2. Validate (Canvas API)             │
       │    - MIME type check                 │
       │    - File size < 5MB                 │
       │    - Decode image (validation)       │
       │                                      │
       ├──────────────────────────────────────┤
       │                                      │
       │ 3. Open crop interface               │
       │    (react-easy-crop)                 │
       │    - User positions/zooms image      │
       │    - Click "Save"                    │
       │                                      │
       ├──────────────────────────────────────┤
       │                                      │
       │ 4. Process cropped image             │
       │    - Crop to square                  │
       │    - Resize to 800x800px             │
       │    - Compress to WebP                │
       │                                      │
       │ 5. Upload to Supabase Storage        │
       ├──────────────────────────────────────▼──────────┐
       │                                    ┌─────────────┴──────────┐
       │                                    │  Supabase Storage      │
       │                                    │  (/avatars/{uid}/)     │
       │                                    └─────────────┬──────────┘
       │                                                  │
       │ 6. Get public URL                                │
       │◄─────────────────────────────────────────────────┘
       │
       │ 7. Update user_profiles.avatar_url
       ├──────────────────────────────────────▼──────────┐
       │                                    ┌─────────────┴──────────┐
       │                                    │  PostgreSQL            │
       │                                    │  user_profiles table   │
       │                                    └─────────────┬──────────┘
       │                                                  │
       │ 8. Success response                              │
       │◄─────────────────────────────────────────────────┘
       │
       │ 9. Display avatar in UI
       └──────────────────────────────────────────────────┘
```

### Replace Avatar Flow (P2)

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ 1. Upload new avatar (same flow as above)
       │    ...steps 1-6...
       │
       │ 7. Parse old avatar URL from user_profiles
       │    Extract path: avatars/{uid}/{old_timestamp}.webp
       │
       │ 8. Update user_profiles.avatar_url (new URL)
       ├──────────────────────────────────────▼──────────┐
       │                                    ┌─────────────┴──────────┐
       │                                    │  PostgreSQL            │
       │                                    │  user_profiles table   │
       │                                    └─────────────┬──────────┘
       │                                                  │
       │ 9. Success response                              │
       │◄─────────────────────────────────────────────────┘
       │
       │ 10. Delete old avatar file
       ├──────────────────────────────────────▼──────────┐
       │                                    ┌─────────────┴──────────┐
       │                                    │  Supabase Storage      │
       │                                    │  (delete old file)     │
       │                                    └─────────────┬──────────┘
       │                                                  │
       │ 11. Deletion complete                            │
       │◄─────────────────────────────────────────────────┘
       │
       │ 12. Display new avatar in UI
       └──────────────────────────────────────────────────┘
```

**Note**: If step 10 (delete old file) fails, the orphaned file remains in storage. This is acceptable - a cleanup job can be implemented later to remove orphaned files.

### Remove Avatar Flow (P3)

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ 1. Click "Remove Avatar"
       │
       │ 2. Clear user_profiles.avatar_url (set to NULL)
       ├──────────────────────────────────────▼──────────┐
       │                                    ┌─────────────┴──────────┐
       │                                    │  PostgreSQL            │
       │                                    │  user_profiles table   │
       │                                    └─────────────┬──────────┘
       │                                                  │
       │ 3. Success response                              │
       │◄─────────────────────────────────────────────────┘
       │
       │ 4. Delete avatar file from storage
       ├──────────────────────────────────────▼──────────┐
       │                                    ┌─────────────┴──────────┐
       │                                    │  Supabase Storage      │
       │                                    │  (delete file)         │
       │                                    └─────────────┬──────────┘
       │                                                  │
       │ 5. Deletion complete                             │
       │◄─────────────────────────────────────────────────┘
       │
       │ 6. Display default avatar (initials)
       └──────────────────────────────────────────────────┘
```

---

## Entity Relationships

### Updated User Profile Entity

```
user_profiles
├── id: UUID (PK, FK → auth.users.id)
├── username: TEXT
├── display_name: TEXT
├── bio: TEXT
├── avatar_url: TEXT [NEW] ← Points to Supabase Storage
├── email_verified: BOOLEAN
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ
```

**Relationship to Storage**:

- **Type**: One-to-Zero-or-One
- **Direction**: user_profiles → storage.objects (via URL string)
- **Cascade**: Manual (not enforced by FK constraint)
  - When user deleted: Auth trigger deletes user_profiles row
  - Storage file cleanup: Must be handled in application logic

### Avatar Metadata (Logical Entity)

**Not Stored in Database** (no dedicated table needed)

Metadata extracted from Supabase Storage object:

```typescript
interface AvatarMetadata {
  url: string; // From user_profiles.avatar_url
  fileName: string; // From URL path
  uploadedAt: number; // Timestamp extracted from fileName
  fileSize: number; // From storage.objects metadata
  mimeType: string; // From storage.objects metadata
  userId: string; // Extracted from URL path
}
```

**Why No Dedicated Table**:

- Metadata is derivable from URL and storage.objects table
- Reduces complexity (no additional joins required)
- Storage.objects already tracks metadata (size, MIME type, etc.)

---

## Storage Capacity Planning

### Per-User Storage

**Assumptions**:

- Target sizes: 800x800px WebP
- Compression quality: 85%
- Estimated file size: 80-120KB

**Calculation**:

```
Average avatar size: 100KB
1000 users × 100KB = 100MB total
```

### Supabase Free Tier Limits

**Storage**:

- Free tier: 1GB included
- Usage: 100MB for 1000 users (10% of free tier)
- Headroom: 900MB remaining

**Bandwidth**:

- Free tier: 2GB/month egress
- Scenario: 1000 users × 10 page loads/month × 100KB = 1GB/month
- Usage: 50% of free tier (acceptable)

**Verdict**: ✅ Well within free tier limits

---

## Data Validation Rules

### Client-Side Validation (Before Upload)

```typescript
interface ValidationRules {
  fileTypes: ['image/jpeg', 'image/png', 'image/webp'];
  maxFileSize: 5242880; // 5MB in bytes
  minDimensions: { width: 200; height: 200 };
  maxDimensions: { width: 10000; height: 10000 };
}
```

**Validation Steps**:

1. **MIME Type Check**: File extension vs. actual MIME type
2. **File Size Check**: Reject files > 5MB
3. **Image Decoding**: Load image via Canvas API (validates it's a real image)
4. **Dimension Check**: Reject images < 200x200px or > 10000x10000px

### Server-Side Validation (Supabase Storage)

Configured in bucket creation:

```sql
file_size_limit: 5242880,
allowed_mime_types: ARRAY['image/jpeg', 'image/png', 'image/webp']
```

**Defense in Depth**: Even if client-side validation is bypassed, server rejects invalid files.

---

## Migration Scripts

### Complete Migration (Feature 022)

**File**: `/supabase/migrations/20251008_avatar_upload.sql`

```sql
-- ============================================================================
-- FEATURE 022: USER AVATAR UPLOAD
-- ============================================================================
-- Purpose: Add avatar support to user profiles with Supabase Storage
-- Created: 2025-10-08
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: DATABASE SCHEMA
-- ============================================================================

-- Add avatar_url column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN user_profiles.avatar_url IS 'Public URL to user avatar in Supabase Storage';

-- ============================================================================
-- PART 2: STORAGE BUCKET
-- ============================================================================

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public read access
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;  -- Idempotent

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Policy: Users can upload own avatar (INSERT)
CREATE POLICY IF NOT EXISTS "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update own avatar (UPDATE)
CREATE POLICY IF NOT EXISTS "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete own avatar (DELETE)
CREATE POLICY IF NOT EXISTS "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Anyone can view avatars (SELECT) - Public read
CREATE POLICY IF NOT EXISTS "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Verify avatar_url column exists
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_profiles' AND column_name = 'avatar_url';

-- Verify avatars bucket exists
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id = 'avatars';

-- Verify RLS policies exist
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
```

### Rollback Script (If Needed)

**File**: `/supabase/migrations/20251008_avatar_upload_rollback.sql`

```sql
-- ============================================================================
-- ROLLBACK: FEATURE 022 - USER AVATAR UPLOAD
-- ============================================================================

BEGIN;

-- Drop RLS policies
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;

-- Delete avatars bucket (cascades to all files)
DELETE FROM storage.buckets WHERE id = 'avatars';

-- Remove avatar_url column
ALTER TABLE user_profiles DROP COLUMN IF EXISTS avatar_url;

COMMIT;
```

---

## Testing Data

### Test User Profile

```sql
-- Create test user profile (for integration tests)
INSERT INTO user_profiles (id, username, display_name, avatar_url)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'testuser',
  'Test User',
  NULL  -- Initially no avatar
)
ON CONFLICT (id) DO NOTHING;
```

### Test Avatar Files

**Upload test avatars** (for E2E tests):

```
e2e/fixtures/avatars/
├── valid-small.jpg       (10KB, 200x200px)
├── valid-medium.png      (500KB, 1024x1024px)
├── valid-large.webp      (4MB, 4000x4000px)
├── invalid-toolarge.jpg  (6MB, exceeds 5MB limit)
├── invalid-pdf.pdf       (not an image)
└── invalid-corrupted.jpg (corrupted file header)
```

---

## Data Model Conclusion

✅ **Schema Changes**: Add `avatar_url` TEXT column to user_profiles
✅ **Storage**: Create `avatars` bucket with 5MB limit, public read
✅ **RLS Policies**: 4 policies for user isolation + public read
✅ **Migration Script**: Complete with rollback support
✅ **Capacity Planning**: 100MB for 1000 users (well within free tier)

**Next Phase**: Create API contracts and quickstart guide.
