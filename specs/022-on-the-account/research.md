# Research: User Avatar Upload

**Feature**: 022-on-the-account
**Date**: 2025-10-08
**Status**: Phase 0 Complete

## Executive Summary

User avatar upload feature requires:

1. **Supabase Storage** with RLS policies (already available)
2. **Client-side image cropping** library (react-easy-crop recommended)
3. **Canvas API** for image validation/processing (already in dependencies)
4. **Database migration** to add avatar_url to user_profiles

**Key Decision**: Use `react-easy-crop` over `react-image-crop` for superior mobile touch support and performance.

---

## Technology Stack Analysis

### 1. Image Cropping Libraries

#### Comparison: react-easy-crop vs react-image-crop vs react-advanced-cropper

| Feature                 | react-easy-crop           | react-image-crop | react-advanced-cropper |
| ----------------------- | ------------------------- | ---------------- | ---------------------- |
| Weekly Downloads (2025) | 611,186                   | 664,541          | Lower                  |
| Mobile Touch Support    | ✅ Excellent              | ✅ Good          | ✅ Good                |
| Performance             | ✅ Lightweight, optimized | Good             | Feature-heavy          |
| Bundle Size             | Small                     | Medium           | Large                  |
| Zoom/Pan Gestures       | ✅ Built-in               | Manual           | ✅ Built-in            |
| TypeScript Support      | ✅ Full                   | ✅ Full          | ✅ Full                |
| Maintenance             | Active                    | Active           | Active                 |

**Decision**: **react-easy-crop**

- **Reason 1**: Best mobile performance (critical for mobile-first design)
- **Reason 2**: Built-in zoom/pan gestures (better UX)
- **Reason 3**: Smaller bundle size (performance)
- **Reason 4**: Similar popularity to react-image-crop (611K vs 664K weekly downloads)

### 2. Image Processing & Validation

**Existing Tools**:

- ✅ `canvas` package (v3.2.0) - Already in package.json
- ✅ Browser Canvas API - Available in all modern browsers

**Validation Strategy**:

```typescript
// Client-side validation flow (FR-004: decode/process to validate)
1. File selected → Check MIME type (quick filter)
2. Load image → Canvas.drawImage() (decodes image)
3. If decoding succeeds → Valid image
4. If decoding fails → Reject with error message
```

**Why Canvas API**:

- Native browser support (no external library needed)
- Validates by attempting to decode image (catches corrupted files)
- Enables client-side resize/crop before upload (reduces bandwidth)

### 3. Supabase Storage

**Current Setup** (from migration analysis):

- ✅ Supabase configured (`@supabase/supabase-js` v2.58.0)
- ✅ `user_profiles` table exists with RLS policies
- ✅ Auth system complete (PRP-016)

**Required Setup**:

- ❌ `avatars` storage bucket does not exist yet (needs creation)
- ❌ `avatar_url` column not in user_profiles (needs migration)

**Storage Bucket Configuration**:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- RLS Policy: Users can upload only their own avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can update only their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Users can delete only their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policy: Anyone can view avatars (public read)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

**Filename Strategy** (FR-007):

```
{user_id}/{timestamp}.{ext}
Example: 123e4567-e89b-12d3-a456-426614174000/1696800000000.webp
```

### 4. Existing Component Patterns

**Analysis of AccountSettings Component**:

- ✅ Already uses Supabase client (`createClient()`)
- ✅ Mobile-first design (44px touch targets: `min-h-11`)
- ✅ Form validation patterns established
- ✅ Error/success state management
- ✅ Loading states with disabled buttons
- ✅ Uses `useAuth()` context for user session

**Integration Points**:

```typescript
// AccountSettings.tsx (line 1-236)
- Line 4: import { createClient } from '@/lib/supabase/client'
- Line 5: import { useAuth } from '@/contexts/AuthContext'
- Line 24: const { user } = useAuth() // Get current user
- Line 23: const supabase = createClient() // Supabase client

// New section to add:
// Between "Profile Settings" and "Password Change" sections
// Add "Avatar Upload" section with AvatarUpload component
```

---

## Technical Constraints

### Storage Costs (Constraint 4: <$5/month for 1000 users)

**Calculation**:

```
Target sizes: 200x200px thumbnail + 800x800px full
Estimated file size: 20KB thumbnail + 100KB full = 120KB per user
1000 users × 120KB = 120MB total storage

Supabase Pricing (Free tier):
- 1GB storage included
- $0.021/GB/month for additional storage

Cost: 120MB = 0.12GB = ~$0.0025/month (well under $5 target)
```

### Mobile-First Requirements (Constraint 3)

**Touch Target Requirements** (from CLAUDE.md):

- Minimum size: 44×44px (WCAG AAA / Apple HIG)
- Implementation: `min-h-11 min-w-11` Tailwind classes
- Applies to: Upload button, crop controls, save/cancel buttons

**Responsive Design**:

```tsx
// Container padding: mobile → tablet → desktop
<div className="px-4 py-6 sm:px-6 sm:py-8 md:py-12">

// Crop interface: full-width on mobile, constrained on desktop
<div className="w-full md:max-w-2xl mx-auto">
```

### Performance Goals (SC-001: <5 seconds upload + display)

**Breakdown**:

1. File selection: instant
2. Image load + validation: <500ms
3. Crop interface render: <200ms
4. Upload to Supabase Storage: <3 seconds (2MB compressed @ 5Mbps = 3.2s)
5. Database update: <100ms
6. UI update: <200ms

**Total**: ~4 seconds (within 5 second target)

**Optimization Strategy**:

- Client-side compression to WebP format (reduces upload time)
- Progressive upload with progress indicator (perceived performance)
- Optimistic UI updates (show avatar immediately after upload)

---

## Image Processing Libraries Already Available

**From package.json analysis**:

- ✅ `canvas` (v3.2.0) - Server-side canvas implementation
- ✅ `sharp` (v0.34.4) - High-performance image processing (dev dependency)

**Note**: `sharp` is in devDependencies (used for static image optimization during build). For runtime avatar processing, we'll use browser Canvas API.

---

## Component 5-File Pattern (Constraint 2)

**Required Structure** (from CLAUDE.md:38-47):

```
src/components/atomic/AvatarUpload/
├── index.tsx                        # Barrel export
├── AvatarUpload.tsx                 # Main component
├── AvatarUpload.test.tsx            # Unit tests (REQUIRED)
├── AvatarUpload.stories.tsx         # Storybook (REQUIRED)
└── AvatarUpload.accessibility.test.tsx  # A11y tests (REQUIRED)

src/components/atomic/AvatarDisplay/
├── index.tsx
├── AvatarDisplay.tsx
├── AvatarDisplay.test.tsx
├── AvatarDisplay.stories.tsx
└── AvatarDisplay.accessibility.test.tsx
```

**Generator Command**:

```bash
docker compose exec scripthammer pnpm run generate:component -- \
  --name AvatarUpload \
  --category atomic \
  --hasProps true \
  --withHooks true
```

---

## Dependencies to Add

**Required**:

```json
{
  "dependencies": {
    "react-easy-crop": "^5.0.0"
  }
}
```

**Optional** (for future enhancement):

```json
{
  "dependencies": {
    "browser-image-compression": "^2.0.0" // Better compression than Canvas
  }
}
```

---

## Risk Analysis

### Risk 1: Client-side Crop Failing on Older Browsers

**Likelihood**: Low (modern browsers support Canvas API)
**Impact**: Medium (users can't upload avatar)
**Mitigation**:

- Feature detection with fallback to auto-crop (center-crop square)
- Display clear error message if browser unsupported
- Provide alternative: "Upload a square image for best results"

### Risk 2: Large File Uploads on Slow Networks

**Likelihood**: Medium (mobile users on 3G/4G)
**Impact**: Low (frustrating UX, but not blocking)
**Mitigation**:

- Client-side compression before upload
- Progress indicator with estimated time
- Allow cancellation of upload
- Retry mechanism for failed uploads

### Risk 3: Race Condition (Replace Avatar)

**Likelihood**: Low (users rarely spam-upload)
**Impact**: High (orphaned files in storage)
**Mitigation**:

- Atomic operation: Upload new → Get URL → Update DB → Delete old
- If upload fails: Keep old avatar
- If delete old fails: Log error but don't block (cleanup job can handle)

### Risk 4: Storage Quota Exceeded

**Likelihood**: Very Low (120MB for 1000 users)
**Impact**: High (users can't upload)
**Mitigation**:

- Monitor storage usage via Supabase dashboard
- Implement storage cleanup for deleted users
- Show clear error message if quota exceeded

---

## Accessibility Requirements (FR-015, SC-004)

**WCAG 2.1 AA Compliance**:

- ✅ Keyboard navigation: Tab through upload button, crop controls, save/cancel
- ✅ Screen reader support: ARIA labels for all controls
- ✅ Focus management: Trap focus in crop modal, restore on close
- ✅ Color contrast: 4.5:1 minimum for all text
- ✅ Touch targets: 44×44px minimum (mobile-first)

**Implementation**:

```tsx
// Upload button
<button
  className="btn btn-primary min-h-11 min-w-11"
  aria-label="Upload profile picture"
>
  Upload Avatar
</button>

// Crop modal
<dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="crop-title"
>
  <h2 id="crop-title">Crop Your Avatar</h2>
  {/* Crop interface */}
</dialog>
```

**Testing** (from CLAUDE.md:94):

```bash
docker compose exec scripthammer pnpm run test:a11y:dev
```

---

## Research Conclusions

### Ready to Proceed

✅ Technology stack validated (react-easy-crop, Canvas API, Supabase Storage)
✅ Performance targets achievable (<5 seconds)
✅ Cost analysis favorable ($0.0025/month for 1000 users)
✅ Existing patterns identified (AccountSettings integration)
✅ Risks mitigated with clear strategies

### Open Questions (None)

All clarifications resolved in spec.md Session 2025-10-08.

### Next Phase

Proceed to **Phase 1: Data Model & Contracts**

- Database migration for avatar_url column
- Supabase Storage bucket + RLS policies
- API contracts for upload/delete operations
