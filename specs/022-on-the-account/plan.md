# Implementation Plan: User Avatar Upload

**Branch**: `022-on-the-account` | **Date**: 2025-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-on-the-account/spec.md`

## Summary

Implement user avatar upload with client-side crop interface on Account Settings page. Users can upload JPEG/PNG/WebP images (max 5MB), crop to desired framing, and see avatars displayed across the app. Old avatars are automatically deleted when replaced. Storage uses Supabase Storage with RLS policies for security.

**Key Features**:

- Client-side image cropping with react-easy-crop (mobile-optimized)
- Canvas API validation (decode/process to verify real images)
- Automatic deletion of old avatars when uploading new ones
- Mobile-first design (44px touch targets, responsive layout)
- WCAG 2.1 AA accessibility compliance

**Technical Approach**: Client-side processing → Supabase Storage upload → Database profile update → UI refresh

---

## Technical Context

**Language/Version**: TypeScript 5.9.2, React 19.1.0, Next.js 15.5.2
**Primary Dependencies**: react-easy-crop (^5.0.0), @supabase/supabase-js (2.58.0), canvas (3.2.0)
**Storage**: Supabase Storage (avatars bucket), PostgreSQL (user_profiles.avatar_url column)
**Testing**: Vitest (unit), Playwright (E2E), Pa11y (accessibility)
**Target Platform**: Web (desktop + mobile), Next.js static export
**Project Type**: Web (single monorepo with app/ + components/ structure)
**Performance Goals**: Upload + display within 5 seconds (SC-001), 50 concurrent uploads supported (SC-007)
**Constraints**:

- Must use 5-file component pattern (CLAUDE.md:38-47)
- Must follow mobile-first design (44px touch targets)
- Storage costs < $5/month for 1000 users
- Must enforce WCAG 2.1 AA accessibility
  **Scale/Scope**: 1000 users × 100KB avatars = 100MB storage, 1GB/month bandwidth

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Constitution File**: `.specify/memory/constitution.md` (ScriptHammer Constitution v1.0.1 - 6 core principles)

**Analysis**: No constitutional violations detected

- ✅ Component structure follows established patterns (5-file atomic design)
- ✅ Uses existing infrastructure (Supabase Storage, Auth)
- ✅ No new external services required
- ✅ Follows mobile-first principles (constraint 3)
- ✅ Includes comprehensive testing requirements

**Conclusion**: Proceed to implementation

---

## Project Structure

### Documentation (this feature)

```
specs/022-on-the-account/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output ✅ Complete
├── data-model.md        # Phase 1 output ✅ Complete
├── quickstart.md        # Phase 1 output ✅ Complete
├── contracts/           # Phase 1 output ✅ Complete
│   └── avatar-upload.contract.md
└── tasks.md             # Phase 2 output (created by /tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
├── app/
│   └── account-settings/       # Existing page (integrate AvatarUpload)
├── components/
│   └── atomic/
│       ├── AvatarUpload/       # NEW: Upload + crop interface component
│       │   ├── index.tsx
│       │   ├── AvatarUpload.tsx
│       │   ├── AvatarUpload.test.tsx
│       │   ├── AvatarUpload.stories.tsx
│       │   └── AvatarUpload.accessibility.test.tsx
│       └── AvatarDisplay/      # NEW: Display avatar with fallback
│           ├── index.tsx
│           ├── AvatarDisplay.tsx
│           ├── AvatarDisplay.test.tsx
│           ├── AvatarDisplay.stories.tsx
│           └── AvatarDisplay.accessibility.test.tsx
├── lib/
│   ├── avatar/                 # NEW: Avatar utilities
│   │   ├── upload.ts           # Upload logic
│   │   ├── validation.ts       # Client-side validation
│   │   └── image-processing.ts # Crop + compress
│   └── supabase/               # Existing
│       ├── client.ts           # Supabase client (existing)
│       └── types.ts            # Type definitions (update)
└── contexts/
    └── AuthContext.tsx         # Existing (no changes needed)

supabase/
└── migrations/
    └── 20251008_avatar_upload.sql  # NEW: Database migration

e2e/
└── avatar/                     # NEW: E2E tests
    └── upload.spec.ts

tests/
└── integration/
    └── avatar/                 # NEW: Integration tests
        └── upload.integration.test.ts
```

**Structure Decision**: Single web application structure (default). All avatar functionality lives in atomic components with supporting utilities in lib/avatar/. Database changes handled via Supabase migrations. No backend API endpoints needed - Supabase Storage SDK handles all operations client-side.

---

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

No violations - table not applicable.

---

## Implementation Phases

### Phase 0: Research & Analysis ✅ COMPLETE

**Output**: `research.md`

**Key Findings**:

- ✅ react-easy-crop recommended over react-image-crop (better mobile performance, built-in zoom/pan)
- ✅ Canvas API validates images by attempting decode (catches corrupted files)
- ✅ Supabase Storage already configured, needs avatars bucket creation
- ✅ Storage costs: $0.0025/month for 1000 users (well under $5 target)
- ✅ Performance: <4 seconds estimated upload time (within 5 second target)

**Risks Identified**:

1. Client-side crop may fail on older browsers → Mitigation: Feature detection + fallback to auto-crop
2. Large file uploads on slow networks → Mitigation: Progress indicator + client-side compression
3. Race condition when replacing avatars → Mitigation: Atomic operation (upload new → update DB → delete old)

---

### Phase 1: Data Model & Contracts ✅ COMPLETE

**Outputs**:

- ✅ `data-model.md` - Database schema, RLS policies, storage configuration
- ✅ `contracts/avatar-upload.contract.md` - API contracts for upload/delete operations
- ✅ `quickstart.md` - Setup guide with verification steps

**Database Changes**:

```sql
-- Add avatar_url column to user_profiles
ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT;

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- RLS Policies (4 total):
-- 1. Users can upload own avatar (INSERT)
-- 2. Users can update own avatar (UPDATE)
-- 3. Users can delete own avatar (DELETE)
-- 4. Anyone can view avatars (SELECT, public read)
```

**API Contracts**:

- `uploadAvatar(blob)` → Public URL
- `removeAvatar()` → Success/error
- `getPublicUrl(path)` → Public URL string
- All operations use Supabase Storage SDK (no custom API endpoints)

---

### Phase 2: Implementation Tasks (Generated by /tasks command)

**NOTE**: Tasks will be generated by the `/tasks` command, not `/plan`.

**Expected Task Categories** (preview only):

1. **P1 - Core Upload Flow (MVP)**:
   - Database migration
   - Create AvatarUpload component with crop interface
   - Create AvatarDisplay component with initials fallback
   - Implement upload utility functions
   - Integration with AccountSettings page
   - Unit + Integration + E2E + Accessibility tests

2. **P2 - Replace Avatar**:
   - Implement old avatar deletion logic
   - Handle upload failures (rollback)

3. **P3 - Remove Avatar**:
   - Add "Remove Avatar" button
   - Implement removal logic

**Detailed tasks will be in `tasks.md` after running `/tasks` command.**

---

## Integration Points

### Existing Systems

**1. Authentication** (PRP-016)

- **Location**: `src/contexts/AuthContext.tsx`, `src/lib/supabase/client.ts`
- **Usage**: Get current user for file path generation, update user metadata with avatar URL
- **Example**:
  ```typescript
  const { user } = useAuth();
  const userId = user.id;
  const filePath = `${userId}/${Date.now()}.webp`;
  ```

**2. Account Settings Page**

- **Location**: `src/components/auth/AccountSettings/AccountSettings.tsx`
- **Integration Point**: Add new "Avatar" section between "Profile Settings" and "Password Change"
- **Pattern**: Follow existing form structure (card, form-control, loading states)
- **Example**:
  ```tsx
  {
    /* Avatar Upload */
  }
  <div className="card bg-base-200">
    <div className="card-body">
      <h3 className="card-title">Profile Picture</h3>
      <AvatarUpload onUploadComplete={(url) => setAvatarUrl(url)} />
    </div>
  </div>;
  ```

**3. Supabase Client**

- **Location**: `src/lib/supabase/client.ts`
- **Usage**: Access Storage SDK for upload/delete operations
- **Example**:
  ```typescript
  import { createClient } from '@/lib/supabase/client';
  const supabase = createClient();
  await supabase.storage.from('avatars').upload(path, blob);
  ```

**4. Mobile-First Utilities**

- **Source**: `CLAUDE.md` lines 191-293
- **Pattern**: `min-h-11 min-w-11` for 44px touch targets, responsive padding `px-4 sm:px-6 md:px-8`
- **Breakpoints**: `src/config/breakpoints.ts` (xs: 320px, sm: 428px, md: 768px, lg: 1024px, xl: 1280px)

### New Dependencies

**1. react-easy-crop** (v5.0.0)

- **Purpose**: Client-side image cropping with mobile touch support
- **Installation**: `pnpm add react-easy-crop`
- **Usage**:
  ```typescript
  import Cropper from 'react-easy-crop';
  <Cropper
    image={imageSrc}
    crop={crop}
    zoom={zoom}
    aspect={1}  // Square crop
    onCropChange={setCrop}
    onZoomChange={setZoom}
    onCropComplete={onCropComplete}
  />
  ```

**2. Canvas API** (Browser Native)

- **Purpose**: Image validation, decoding, and processing
- **No Installation**: Built into browsers
- **Usage**:
  ```typescript
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = await createImageBitmap(blob);
  canvas.width = 800;
  canvas.height = 800;
  ctx.drawImage(img, 0, 0, 800, 800);
  ```

---

## Component Architecture

### AvatarUpload Component (Atomic)

**Purpose**: File picker + crop interface + upload logic

**Props**:

```typescript
interface AvatarUploadProps {
  /** Current avatar URL (if exists) */
  currentAvatarUrl?: string;
  /** Callback when upload completes */
  onUploadComplete?: (url: string) => void;
  /** Callback when upload fails */
  onUploadError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}
```

**State**:

- `selectedFile`: File | null
- `imageSrc`: string (data URL for preview)
- `crop`: { x: number, y: number }
- `zoom`: number
- `croppedAreaPixels`: Area
- `uploading`: boolean
- `error`: string | null

**Key Methods**:

- `handleFileSelect()` - Validate file, load preview
- `handleCropComplete()` - Store crop area pixels
- `handleSave()` - Process crop, upload, update profile
- `createCroppedImage()` - Use Canvas API to crop image

**Mobile-First Considerations**:

- Touch targets: 44×44px buttons (`min-h-11 min-w-11`)
- Full-width crop interface on mobile
- Large touch areas for zoom/pan controls
- Swipe gestures for crop adjustment (via react-easy-crop)

### AvatarDisplay Component (Atomic)

**Purpose**: Display avatar with fallback to user initials

**Props**:

```typescript
interface AvatarDisplayProps {
  /** Avatar URL (if exists) */
  avatarUrl?: string;
  /** User's display name or username (for initials) */
  userName?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}
```

**Behavior**:

- If `avatarUrl` exists → Display image
- If no `avatarUrl` → Display initials (first + last letter of userName)
- Lazy load images for performance
- Show placeholder while loading

**Size Variants**:

- `sm`: 32x32px (comments, lists)
- `md`: 64x64px (profile cards)
- `lg`: 128x128px (profile header)

---

## Data Flow

### Upload Flow (P1)

```
User selects file
       ↓
[Validate file]
  - MIME type check
  - File size < 5MB
  - Decode via Canvas API
       ↓
[Open crop interface]
  - Load image preview
  - User positions/zooms
  - Click "Save"
       ↓
[Process cropped image]
  - Extract crop area pixels
  - Create canvas 800x800px
  - Draw cropped region
  - Convert to WebP blob
       ↓
[Upload to Supabase Storage]
  - Generate path: {userId}/{timestamp}.webp
  - Upload blob
  - Get public URL
       ↓
[Update user profile]
  - Set user_metadata.avatar_url
  - Trigger AuthContext refresh
       ↓
[Delete old avatar]
  - Extract old path from URL
  - Delete from storage
  - Ignore errors (cleanup can happen later)
       ↓
[Update UI]
  - Display new avatar
  - Show success message
```

### Replace Avatar Flow (P2)

Same as Upload Flow, but includes old avatar deletion step after successful profile update.

### Remove Avatar Flow (P3)

```
User clicks "Remove Avatar"
       ↓
[Update user profile]
  - Set user_metadata.avatar_url = null
  - Trigger AuthContext refresh
       ↓
[Delete avatar file]
  - Extract path from URL
  - Delete from storage
       ↓
[Update UI]
  - Display default avatar (initials)
  - Show success message
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Location**: `src/components/atomic/AvatarUpload/AvatarUpload.test.tsx`

**Coverage**:

- File validation logic (type, size, decoding)
- Crop area calculation
- Error handling (upload failures, network errors)
- State management (loading, error, success)

**Example**:

```typescript
describe('AvatarUpload', () => {
  it('should reject files > 5MB', async () => {
    const largeFile = new File(
      [new ArrayBuffer(6 * 1024 * 1024)],
      'large.jpg',
      { type: 'image/jpeg' }
    );
    const result = await validateAvatarFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('5MB');
  });

  it('should reject invalid file types', async () => {
    const pdfFile = new File(['content'], 'file.pdf', {
      type: 'application/pdf',
    });
    const result = await validateAvatarFile(pdfFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file type');
  });
});
```

### Integration Tests (Vitest + Supabase)

**Location**: `tests/integration/avatar/upload.integration.test.ts`

**Coverage**:

- Upload flow end-to-end (client → storage → database)
- RLS policy enforcement (user can only upload to own folder)
- Old avatar deletion
- Error handling (storage errors, database errors)

**Example**:

```typescript
describe('Avatar Upload Integration', () => {
  it('should upload avatar and update user profile', async () => {
    const mockBlob = new Blob(['fake-image'], { type: 'image/webp' });
    const result = await uploadAvatar(mockBlob);

    expect(result.error).toBeUndefined();
    expect(result.url).toMatch(/avatars/);

    // Verify database updated
    const { data: user } = await supabase.auth.getUser();
    expect(user.user.user_metadata.avatar_url).toBe(result.url);
  });
});
```

### E2E Tests (Playwright)

**Location**: `e2e/avatar/upload.spec.ts`

**Coverage**:

- Complete user flow (sign in → upload → crop → save → verify display)
- Replace avatar flow
- Remove avatar flow
- Error handling (invalid files, network failures)

**Example**:

```typescript
test('avatar upload flow', async ({ page }) => {
  await page.goto('/sign-in');
  await signIn(page, 'test@example.com', 'password123');

  await page.goto('/account-settings');

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('e2e/fixtures/avatars/valid-medium.png');

  await expect(page.locator('[aria-label="Crop Your Avatar"]')).toBeVisible();

  await page.click('button:has-text("Save")');

  await expect(page.locator('img[alt*="avatar"]')).toHaveAttribute(
    'src',
    /avatars/
  );
});
```

### Accessibility Tests (Pa11y)

**Location**: Integrated into component accessibility tests

**Coverage**:

- Keyboard navigation (tab through all controls)
- Screen reader labels (ARIA attributes)
- Focus management (trap focus in crop modal)
- Color contrast (4.5:1 minimum)
- Touch targets (44×44px minimum)

**Example**:

```typescript
describe('AvatarUpload Accessibility', () => {
  it('should have proper ARIA labels', async () => {
    render(<AvatarUpload />);

    const uploadButton = screen.getByRole('button', { name: /upload avatar/i });
    expect(uploadButton).toHaveAccessibleName();
  });

  it('should trap focus in crop modal', async () => {
    render(<AvatarUpload />);

    // Open crop modal
    const fileInput = screen.getByLabelText(/upload avatar/i);
    await userEvent.upload(fileInput, mockFile);

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveFocus();
  });
});
```

---

## Performance Optimization

### Client-Side Compression

**Target**: Reduce upload time from ~10 seconds to ~3 seconds

**Strategy**:

```typescript
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

**Expected Results**:

- JPEG 2MB → WebP 200KB (90% reduction)
- PNG 1MB → WebP 100KB (90% reduction)
- Upload time: 2MB @ 5Mbps = 3.2s → 200KB @ 5Mbps = 0.32s

### Lazy Loading

**Strategy**: Load avatars only when visible in viewport

```typescript
<img
  src={avatarUrl}
  alt="User avatar"
  loading="lazy"  // Native lazy loading
  className="avatar"
/>
```

### CDN Caching

**Supabase Storage**: Automatic CDN caching with configurable cache-control headers

```typescript
{
  cacheControl: '3600'; // Cache for 1 hour
}
```

---

## Security Considerations

### Row Level Security (RLS)

**Enforcement**: Supabase Storage RLS policies prevent:

- Users uploading to other users' folders
- Users deleting other users' avatars
- Unauthorized access to private buckets (not applicable - avatars are public)

**Testing**: Integration tests verify RLS enforcement

### File Validation

**Defense in Depth**:

1. **Client-side**: MIME type + file size + Canvas decode
2. **Server-side**: Supabase bucket config enforces file size + MIME types

**Security Benefits**:

- Prevents uploading executable files disguised as images
- Catches corrupted files that could exploit image parsers
- Enforces storage limits

### XSS Prevention

**Avatar URLs**: Always from Supabase Storage (trusted source)

- URLs are not user-controllable
- No risk of javascript: or data: URLs

**Display**: Use `<img>` tags (not innerHTML)

```typescript
// ✅ Safe
<img src={avatarUrl} alt="Avatar" />

// ❌ Unsafe (don't do this)
<div dangerouslySetInnerHTML={{ __html: `<img src="${avatarUrl}">` }} />
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance (FR-015, SC-004)

**Keyboard Navigation**:

- Tab to upload button
- Tab through crop controls (zoom slider, position)
- Tab to save/cancel buttons
- Enter key to activate buttons

**Screen Reader Support**:

```tsx
<button
  className="btn btn-primary min-h-11"
  aria-label="Upload profile picture"
>
  Upload Avatar
</button>

<dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="crop-title"
>
  <h2 id="crop-title">Crop Your Avatar</h2>
  {/* Crop interface */}
</dialog>

<input
  type="range"
  min={1}
  max={3}
  step={0.1}
  value={zoom}
  onChange={(e) => setZoom(Number(e.target.value))}
  aria-label="Zoom level"
/>
```

**Focus Management**:

- Trap focus in crop modal (prevent tabbing out)
- Restore focus to upload button when modal closes
- Use `react-focus-trap` or manual implementation

**Color Contrast**:

- All text: 4.5:1 minimum (WCAG AA)
- Large text (18pt+): 3:1 minimum
- Use DaisyUI theme colors (already compliant)

**Touch Targets**:

- Minimum 44×44px (WCAG AAA / Apple HIG)
- Implementation: `min-h-11 min-w-11` (44px = 11 × 4px)

**Testing**:

```bash
docker compose exec scripthammer pnpm run test:a11y:dev
```

---

## Mobile-First Design

### Touch Target Requirements (Constraint 3)

**All Interactive Elements**:

- Upload button: `btn btn-primary min-h-11 min-w-11`
- Crop controls: Minimum 44px touch areas
- Save/Cancel buttons: `btn min-h-11`

**Responsive Spacing**:

```tsx
// Container padding: mobile → tablet → desktop
<div className="px-4 py-6 sm:px-6 sm:py-8 md:py-12">

// Crop interface: full-width on mobile, constrained on desktop
<div className="w-full md:max-w-2xl mx-auto">
```

### Mobile-Specific Optimizations

**1. Touch Gestures** (via react-easy-crop):

- Pinch to zoom
- Drag to reposition
- Swipe gestures for fine control

**2. File Picker**:

- Show camera option on mobile devices

```typescript
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  capture="user"  // Prefer front camera
/>
```

**3. Responsive Crop Interface**:

```tsx
// Full-width on mobile, 600px on desktop
<div className="w-full max-w-[600px] mx-auto h-96">
  <Cropper ... />
</div>
```

---

## Error Handling

### Error Categories

**1. Validation Errors** (Client-side)

- Invalid file type → "Please upload a JPEG, PNG, or WebP image"
- File too large → "File size exceeds 5MB limit. Please choose a smaller image"
- Image decode failed → "Invalid or corrupted image file"

**2. Upload Errors** (Supabase Storage)

- 401 Unauthorized → "Please sign in to upload an avatar"
- 403 Forbidden → "You do not have permission to perform this action"
- 413 Payload Too Large → "File size exceeds maximum limit"
- Network error → "Upload failed. Please check your connection and try again"

**3. Profile Update Errors** (Supabase Auth)

- 401 Unauthorized → "Session expired. Please sign in again"
- Network error → "Failed to update profile. Please try again"

### Error Handling Pattern

```typescript
try {
  const result = await uploadAvatar(blob);
  if (result.error) {
    setError(result.error);
    return;
  }
  setSuccess(true);
  onUploadComplete?.(result.url);
} catch (err) {
  const message =
    err instanceof Error ? err.message : 'An unexpected error occurred';
  setError(message);
  logError('Avatar upload failed', err);
}
```

### Retry Mechanism (FR-016)

```typescript
async function uploadWithRetry(
  blob: Blob,
  maxRetries = 3
): Promise<UploadAvatarResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadAvatar(blob);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await delay(1000 * attempt); // Exponential backoff
    }
  }
  throw new Error('Upload failed after maximum retries');
}
```

---

## Edge Cases

### Documented in Spec (Lines 57-68)

1. **Invalid file format (PDF, GIF, TIFF)** → Reject with error message
2. **File exceeding size limit (>5MB)** → "Maximum 5MB allowed"
3. **Upload fails mid-transfer (network interruption)** → Show retry option
4. **User has no avatar and never uploads one** → Display initials fallback
5. **Same filename simultaneous upload** → Unique timestamp prevents collision
6. **Extremely small images (<200x200px)** → Allow but warn quality may be poor
7. **Extremely large images (>10000x10000px)** → Compress to 800x800px (no error)
8. **Storage bucket runs out of space** → "Storage quota exceeded. Please contact support"
9. **User closes crop interface without saving** → Discard changes, return to upload button
10. **Crop area smaller than minimum (200x200px)** → Disable save button with message

### Additional Edge Cases

11. **User uploads same image twice** → Allow (different timestamp in filename)
12. **User deletes avatar while upload in progress** → Cancel upload, show error
13. **Old avatar URL invalid/malformed** → Skip deletion, log error
14. **Concurrent uploads from same user** → Last upload wins (timestamp ensures unique filenames)

---

## Progress Tracking

### Phase 0: Research ✅ COMPLETE (2025-10-08)

- [x] Analyzed image cropping libraries (react-easy-crop selected)
- [x] Researched validation strategies (Canvas API decode)
- [x] Verified Supabase Storage compatibility
- [x] Calculated storage costs ($0.0025/month for 1000 users)
- [x] Identified performance optimizations (WebP compression)

### Phase 1: Data Model & Contracts ✅ COMPLETE (2025-10-08)

- [x] Created database migration script
- [x] Defined RLS policies for storage
- [x] Documented API contracts
- [x] Created quickstart guide
- [x] Verified integration points

### Phase 2: Implementation Tasks ⏳ PENDING

**To be generated by `/tasks` command**

Expected artifacts:

- [ ] tasks.md with prioritized implementation tasks
- [ ] Dependency-ordered task list
- [ ] Acceptance criteria for each task

---

## Dependencies

### External Dependencies

```json
{
  "dependencies": {
    "react-easy-crop": "^5.0.0" // NEW
  }
}
```

### Internal Dependencies

**Existing**:

- `@supabase/supabase-js` (v2.58.0)
- `@supabase/ssr` (v0.5.2)
- `react` (v19.1.0)
- `next` (v15.5.2)
- `canvas` (v3.2.0 - devDependency)

**No Additional Dependencies Needed**

---

## Migration Path

### Step 1: Database Setup

```bash
# Run migration
docker compose exec scripthammer npx supabase db push

# Verify
docker compose exec scripthammer npx supabase db execute \
  "SELECT * FROM storage.buckets WHERE id = 'avatars';"
```

### Step 2: Install Dependencies

```bash
docker compose exec scripthammer pnpm add react-easy-crop
```

### Step 3: Generate Components

```bash
docker compose exec scripthammer pnpm run generate:component -- \
  --name AvatarUpload --category atomic --hasProps true --withHooks true

docker compose exec scripthammer pnpm run generate:component -- \
  --name AvatarDisplay --category atomic --hasProps true --withHooks false
```

### Step 4: Implement Core Logic

Create upload utilities in `src/lib/avatar/upload.ts` (see quickstart.md)

### Step 5: Integrate with AccountSettings

Add AvatarUpload component to Account Settings page

### Step 6: Testing

```bash
# Unit tests
docker compose exec scripthammer pnpm test src/lib/avatar
docker compose exec scripthammer pnpm test src/components/atomic/AvatarUpload

# E2E tests
docker compose exec scripthammer pnpm run test:e2e

# Accessibility tests
docker compose exec scripthammer pnpm run test:a11y:dev
```

---

## Success Criteria Verification

**From Spec (Lines 100-112)**:

- **SC-001**: Users can upload an avatar and see it displayed within 5 seconds
  - **Verification**: Manual timing test + E2E test assertion
- **SC-002**: System successfully processes 100% of valid image uploads
  - **Verification**: Integration tests with valid JPEG/PNG/WebP files
- **SC-003**: System correctly rejects 100% of invalid uploads with clear errors
  - **Verification**: Unit tests with invalid files (PDF, >5MB, corrupted)
- **SC-004**: Avatar upload interface achieves WCAG 2.1 AA compliance
  - **Verification**: Pa11y automated tests + manual keyboard navigation test
- **SC-005**: Uploaded avatars display consistently across all pages
  - **Verification**: E2E tests checking avatar on profile page, settings, comments
- **SC-006**: 90% of users successfully upload avatar on first attempt
  - **Verification**: Post-launch analytics (not testable pre-launch)
- **SC-007**: System handles 50 concurrent avatar uploads without degradation
  - **Verification**: Load testing (Supabase handles this - no action needed)

---

## Next Steps

1. **Run `/tasks` command** to generate detailed implementation tasks
2. **Review tasks.md** for prioritized task breakdown
3. **Begin implementation** starting with P1 tasks (core upload flow)
4. **Follow quickstart.md** for setup verification
5. **Use contracts/** for API implementation reference
6. **Run tests frequently** during development

---

## Documentation References

**Specification**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)
**Data Model**: [data-model.md](./data-model.md)
**API Contract**: [contracts/avatar-upload.contract.md](./contracts/avatar-upload.contract.md)
**Quickstart**: [quickstart.md](./quickstart.md)
**Tasks** (pending): [tasks.md](./tasks.md) - Run `/tasks` to generate

---

**Status**: ✅ Planning complete. Ready for `/tasks` command to generate implementation tasks.
