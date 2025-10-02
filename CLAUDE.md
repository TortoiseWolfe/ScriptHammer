# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Development Principles

1. **Proper Solutions Over Quick Fixes** - Implement correctly the first time
2. **Root Cause Analysis** - Fix underlying issues, not symptoms
3. **Stability Over Speed** - This is a production template
4. **Clean Architecture** - Follow established patterns consistently
5. **No Technical Debt** - Never commit TODOs or workarounds

## Current Status: Post-Sprint 3.5 - Ready for Next Phase

**Sprint 3.5 Complete** ✅ - All technical debt eliminated (2025-09-19)
**Post-Cleanup Complete** ✅ - Next.js 15 params fixed (2025-09-30)

**Next Steps**: Choose between PRP-001 (Methodology Documentation) or Sprint 4 (Advanced Features)

## PRP/SpecKit Workflow

ScriptHammer uses Product Requirements Prompts (PRPs) integrated with SpecKit workflow commands for feature development.

**Quick Start**: See [SPECKIT-PRP-GUIDE.md](docs/prp-docs/SPECKIT-PRP-GUIDE.md)

**Full Guide**: See [PRP Methodology](docs/prp-docs/prp-methodology-prp.md)

**Workflow**:

1. Write PRP: `docs/prp-docs/<feature>-prp.md`
2. Create branch: `./scripts/prp-to-feature.sh <feature> <number>`
3. Run SpecKit: `/specify` → `/plan` → `/tasks` → `/implement`

**When to Use**: Features taking >1 day, external integrations, architectural changes

## Component Structure Requirements ⚠️ MANDATORY

**CRITICAL**: Components must follow the 5-file pattern or CI/CD will fail:

```
ComponentName/
├── index.tsx                             # Barrel export
├── ComponentName.tsx                     # Main component
├── ComponentName.test.tsx                # Unit tests (REQUIRED)
├── ComponentName.stories.tsx             # Storybook (REQUIRED)
└── ComponentName.accessibility.test.tsx  # A11y tests (REQUIRED)
```

**Always use the generator**: `docker compose exec scripthammer pnpm run generate:component`

## Essential Commands

### Docker Development (MANDATORY)

**⚠️ IMPORTANT**: This project REQUIRES Docker. Local pnpm/npm commands are NOT supported.

```bash
docker compose up                                    # Start development environment
docker compose exec scripthammer pnpm run dev            # Dev server on :3000
docker compose exec scripthammer pnpm test               # Run tests
docker compose exec scripthammer pnpm run storybook      # Start Storybook
docker compose exec scripthammer pnpm run docker:clean   # Clean start if issues
```

### Component Generator

**Interactive mode** (recommended for learning):

```bash
docker compose exec scripthammer pnpm run generate:component
# Prompts for: name, category, hasProps, includeHooks
```

**CLI mode** (for scripting/automation):

```bash
docker compose exec scripthammer pnpm run generate:component -- \
  --name ComponentName \
  --category atomic \
  --hasProps true \
  --withHooks false

# Categories: subatomic, atomic, molecular, organisms, templates
```

### Testing Commands (Inside Docker)

```bash
docker compose exec scripthammer pnpm run test:suite      # 🧪 Comprehensive test suite
docker compose exec scripthammer pnpm run test:quick      # ⚡ Quick validation
docker compose exec scripthammer pnpm run type-check      # TypeScript checking
docker compose exec scripthammer pnpm run lint             # ESLint checking
docker compose exec scripthammer pnpm run test:coverage   # Coverage report
docker compose exec scripthammer pnpm run test:a11y:dev   # Accessibility testing
```

The `test:suite` command runs all tests and provides colored output with:

- TypeScript type checking
- ESLint validation
- Code formatting check
- Unit tests with coverage
- Component structure validation
- Production build test
- Accessibility tests (if dev server is running)

## PRP Workflow

The project uses Product Requirements Prompts for feature implementation:

```bash
# Step 1: Setup feature branch (run from host machine)
./scripts/prp-to-feature.sh <prp-name> <number>

# Step 2: Generate plan (tell Claude)
"execute /plan"

# Step 3: Generate tasks (tell Claude)
"execute /tasks"
```

**Remaining PRPs** (0.3.0) - Priority Order:

- ~~PRP-001: PRP Methodology~~ ✅ Completed (merged before blog posts)
- ~~PRP-010: EmailJS Integration~~ ✅ Completed
- ~~PRP-011: PWA Background Sync~~ ✅ Completed
- ~~PRP-013: Calendar Integration~~ ✅ Completed
- ~~PRP-014: Geolocation Map~~ ✅ Completed (2025-09-18)
- ~~**Auto-Configuration System**~~ ✅ Completed (2025-09-18) - Auto-detects project name from git remote (not a formal PRP)
- ~~**Lighthouse Phases 3 & 4**~~ ✅ Completed (2025-09-30) - Best Practices 100/100, PWA deprecated in Lighthouse 12.0
- ~~**PRP-017: Mobile-First Design**~~ ✅ Completed (2025-10-01) - Full mobile-first overhaul with 44px touch targets
- PRP-012: Visual Regression Testing (P2 - deferred until UI stable)

**Future PRPs** (0.4.0):

- PRP-015: Enhanced Geolocation Accuracy (P2 - hybrid desktop/mobile approach)

## Lighthouse Scores (September 2025)

**Current Scores** (verified via Lighthouse CLI):

- ✅ Performance: 95/100
- ✅ Accessibility: 96/100
- ✅ Best Practices: 100/100 (all console statements removed)
- ✅ SEO: 100/100
- ⚠️ PWA: N/A (scoring deprecated in Lighthouse 12.0, May 2024)

**PWA Status**: Despite no Lighthouse score, the app IS a fully functional PWA:

- Service worker registered and active
- Valid web app manifest
- Served over HTTPS
- Meets all Chrome installability criteria
- Offline support enabled

**Note**: PWA scoring was completely removed from Lighthouse 12.0+. Use Chrome DevTools → Application tab to verify PWA installability.

## Architecture Overview

- **Next.js 15.5.2** with App Router, static export
- **React 19.1.0** with TypeScript strict mode
- **Tailwind CSS 4** + DaisyUI (32 themes)
- **PWA** with Service Worker (offline support)
- **Testing**: Vitest (58% coverage), Playwright E2E
- **CI/CD**: GitHub Actions with Husky hooks

### Key Paths

```
src/
├── app/           # Next.js pages
├── components/    # Atomic design pattern
│   ├── subatomic/ # Primitives
│   ├── atomic/    # Basic components (includes CalendarEmbed)
│   ├── calendar/  # Calendar providers and consent
│   └── privacy/   # GDPR components
├── config/        # Project configuration
├── contexts/      # React contexts
└── utils/         # Utilities
```

## Testing Requirements

- **Unit Tests**: Vitest + React Testing Library (25% minimum)
- **E2E Tests**: Playwright (40+ tests, local only)
- **Accessibility**: Pa11y CI configured
- **Visual**: Chromatic package installed
- **Coverage**: Currently 58%, target 60%

## Mobile-First Design Standards (PRP-017)

**⚠️ MANDATORY**: All new components and pages MUST follow mobile-first design principles.

### Touch Target Requirements

- **Minimum Size**: 44×44px (WCAG AAA / Apple HIG compliance)
- **Apply to ALL**: Buttons, links, form inputs, interactive icons
- **Implementation**: Use `min-h-11 min-w-11` utility classes (Tailwind: 44px = 11 × 4px)

```tsx
// ✅ CORRECT - Mobile-first touch targets
<button className="btn btn-primary min-h-11 min-w-11">Click Me</button>
<Link href="/page" className="inline-block min-h-11 min-w-11">Link</Link>
<input className="input input-bordered min-h-11" />

// ❌ WRONG - Touch targets too small for mobile
<button className="btn btn-xs">Too Small</button>
<a href="/page" className="text-sm">No touch target</a>
```

### Responsive Spacing Pattern

Use mobile-first progressive enhancement for padding/margins:

```tsx
// Container padding: mobile → tablet → desktop
<div className="px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">

// Vertical rhythm: progressively increase spacing
<header className="mb-6 sm:mb-8 md:mb-10 lg:mb-12">

// Gap spacing: start small, grow larger
<div className="flex gap-2 sm:gap-3 md:gap-4">
```

### Layout Patterns

**Stack on mobile, horizontal on tablet+:**

```tsx
// Cards, forms, navigation
<div className="flex flex-col gap-4 sm:flex-row sm:gap-6">

// Card side-by-side layout
<Card side>  {/* Automatically applies md:card-side - stacks on mobile */}
```

### Breakpoints

Mobile-first breakpoints (defined in `src/config/breakpoints.ts`):

- **xs**: 320px (minimum supported - iPhone SE)
- **sm**: 428px (standard phones - iPhone 14 Pro Max)
- **md**: 768px (tablets - iPad Mini)
- **lg**: 1024px (desktop - iPad Pro landscape)
- **xl**: 1280px (large desktop)

### Device Detection

Use the `useDeviceType` hook for runtime device awareness:

```tsx
import { useDeviceType } from '@/hooks/useDeviceType';

function MyComponent() {
  const device = useDeviceType();

  if (device.category === 'mobile') {
    // Mobile-specific behavior
  }

  // Access: width, height, breakpoint, category, orientation, hasTouch
}
```

### Testing Mobile-First

Playwright is configured with 8 mobile + 2 tablet viewports:

```bash
docker compose exec scripthammer pnpm exec playwright test
# Tests automatically run against all configured mobile viewports
```

### Common Patterns

**Navigation controls:**

```tsx
<div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
  <button className="btn btn-ghost btn-circle min-h-11 min-w-11">
```

**Blog/article content:**

```tsx
<article className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
  <div className="max-w-3xl">  {/* Constrain line length for readability */}
```

**Modal/dialog close buttons:**

```tsx
<button className="btn btn-circle btn-xs sm:btn-sm min-h-11 min-w-11">✕</button>
```

## Configuration After Using Template

**NEW: Auto-Configuration!** The project name is now automatically detected from your GitHub fork!

1. ~~Update `/src/config/project-status.json` with your project info~~ Auto-detected from git remote
2. ~~Replace GitHub Pages URLs in configs~~ Auto-configured
3. Copy `.env.example` to `.env` and set your UID/GID (required for Docker)
4. ~~Update `basePath` in `next.config.ts` if needed~~ Auto-detected

### Environment Setup

```bash
# Copy the example file
cp .env.example .env

# Get your system's UID and GID
echo "UID=$(id -u)" >> .env
echo "GID=$(id -g)" >> .env
```

See `.env.example` for all available environment variables including:

- Google Analytics, EmailJS, Web3Forms integration
- Calendar providers (Calendly/Cal.com)
- Author information and social links
- Project overrides for special deployment scenarios

See `/docs/TEMPLATE-GUIDE.md` for details on the auto-configuration system.

## Common Issues & Solutions

### ✅ FIXED: Docker .next Permission Issues

**Feature 017-fix-docker-next has permanently resolved the .next permission issues!**

- No more `EACCES` errors
- No more manual cleanup needed
- Works across restarts automatically
- Solution: Anonymous Docker volume for `/app/.next`

### Tailwind CSS Not Loading

If CSS styles aren't appearing:

1. Ensure Leaflet CSS import is NOT in `globals.css` (causes build issues)
2. Import Leaflet CSS only in map components that use it
3. Restart Docker container after CSS changes

### Webpack Cache Corruption (Rare)

```bash
pnpm run docker:clean  # Clean start if needed
```

### Docker UID/GID Setup

The `.env` file with UID/GID is now created from `.env.example`:

```bash
# Quick setup
cp .env.example .env
# The default values (UID=1000, GID=1000) work for most Linux/WSL systems

# Or set your specific values
echo "UID=$(id -u)" > .env
echo "GID=$(id -g)" >> .env
```

### Port 3000 In Use

```bash
docker compose down
lsof -i :3000
kill -9 <PID>
```

### pnpm Version Mismatch

```bash
corepack enable
corepack prepare pnpm@10.16.1 --activate
```

## Sprint 4 (0.4.0) - Future Features

After completing remaining PRPs, these features from previous constitutions need implementation:

- **Advanced Tooling**: OKLCH color system scripts
- **Validation**: Multi-level validation patterns
- **Security**: Automated dependency scanning
- **Performance**: Bundle analysis dashboard
- **State Management**: Zustand/Jotai implementation
- **Animations**: Framer Motion integration
- **UI Components**: Command palette, DataTable, Modal system
- **Developer Tools**: Component generator CLI

See `/SPRINT-4-ROADMAP.md` for detailed planning.

## PRP-011 Implementation Notes

### PWA Background Sync (Completed 2025-09-17)

Successfully implemented offline form submission with automatic synchronization:

- **IndexedDB Queue**: Persistent storage for offline submissions
- **Service Worker Sync**: Background sync API integration
- **React Integration**: Custom `useOfflineQueue` hook
- **User Feedback**: Clear UI indicators for offline state

#### Known Test Issues

**4 integration tests fail** in `/src/tests/offline-integration.test.tsx` due to React Hook Form async validation timing in test environment. Production functionality works correctly.

**Root Cause**: Complex interaction between mocked hooks and form validation lifecycle. The submit button remains disabled in tests despite valid form data.

**Verification**: See `/docs/testing/KNOWN-TEST-ISSUES.md` for detailed analysis and manual verification steps.

**Future Fix**: Split into focused unit tests + Playwright E2E tests for real browser validation.

## PRP-014 Implementation Notes

### Geolocation Map (Completed 2025-09-18)

Successfully implemented interactive maps with geolocation support:

- **Leaflet.js Integration**: Open-source maps with OpenStreetMap tiles
- **GDPR Compliance**: Consent modal before location access
- **Dynamic Loading**: SSR disabled for map components
- **Known Limitation**: Desktop browsers use IP-based geolocation (city-level accuracy)
- **Future Enhancement**: See PRP-015 for desktop accuracy improvements

## Offline-First Blog Development (Feature 018)

### Key Technologies

- **Dexie.js**: TypeScript-friendly IndexedDB wrapper
- **LZ-String**: Text compression for 5MB storage limit
- **markdown-to-jsx**: React-compatible markdown rendering
- **Workbox**: Service Worker management for offline support

### Blog-Specific Patterns

#### IndexedDB with Dexie

```typescript
// Always use transactions for bulk operations
await db.transaction('rw', db.posts, db.images, async () => {
  // All operations in same transaction
});

// Handle quota errors
try {
  await db.posts.add(post);
} catch (e) {
  if (e.name === 'QuotaExceededError') {
    // Handle storage limit
  }
}
```

#### Text Compression

```typescript
// Compress before storing
const compressed = LZString.compress(content);
// Decompress when reading
const original = LZString.decompress(compressed);
```

#### Service Worker Testing

```bash
# Test offline mode
docker compose exec scripthammer pnpm test:offline

# Debug service worker
chrome://inspect/#service-workers
```

### Storage Debugging

```javascript
// Check IndexedDB usage
const dbs = await indexedDB.databases();
console.log('Databases:', dbs);

// Inspect Dexie tables
await db.posts.toArray();
await db.syncQueue.count();
```

## Offline-First Blog System (Feature 018)

### ⚠️ CRITICAL: Blog Content Source of Truth

**IMPORTANT**: When editing blog content, ONLY edit files in `/public/blog/*.md`

- **DO NOT EDIT**: `/out/blog/*.md` - These are build outputs
- **DO NOT EDIT**: `/src/lib/blog/blog-data.json` - This is generated from markdown files
- **ONLY EDIT**: `/public/blog/*.md` - The source markdown files

The build process flow:

1. Source markdown files: `/public/blog/*.md`
2. Generate JSON at build time: `pnpm run generate:blog` → `/src/lib/blog/blog-data.json`
3. Static export copies to: `/out/blog/*.md` (for GitHub Pages deployment)

After editing blog markdown files, regenerate the JSON:

```bash
docker compose exec scripthammer pnpm run generate:blog
```

### Overview

Successfully implemented a complete offline-first blog system with IndexedDB, PWA support, and background sync.

#### Key Features

- **Offline-First**: Full functionality without internet using IndexedDB
- **Storage Management**: 5MB text, 200MB images with quota tracking
- **Background Sync**: Automatic synchronization when coming online
- **Conflict Resolution**: Smart handling of concurrent edits
- **Post Scheduling**: Future publication with cron-like scheduling

#### Architecture

```
src/
├── app/api/blog/       # API routes (posts, sync, storage, images)
├── app/blog/           # UI pages (list, editor, schedule, [slug])
├── components/blog/    # React components (5-file pattern)
├── lib/blog/          # Core libraries (database, sync, compression)
├── services/blog/     # Business logic (post, storage, schedule, offline)
└── types/blog.ts      # TypeScript interfaces
```

#### Common Tasks

```bash
# Run blog tests
docker compose exec scripthammer pnpm test src/tests/**/blog-*.test.ts

# Check storage usage
curl http://localhost:3000/api/blog/storage

# Trigger sync manually
curl -X POST http://localhost:3000/api/blog/sync?action=process

# Clean up old content
curl -X POST http://localhost:3000/api/blog/storage?action=cleanup
```

#### Debugging Tips

- **IndexedDB Issues**: Check DevTools > Application > IndexedDB
- **Sync Problems**: Monitor Network tab for failed requests
- **Storage Quota**: Check at `/blog/storage` or API endpoint
- **Service Worker**: Ensure registered in Application tab

#### Known Issues

- Desktop browsers use IP geolocation (city-level accuracy)
- Some integration tests fail due to React Hook Form timing (production works)
- Service worker requires HTTPS in production

## Important Notes

- Never create components manually - use the generator
- All PRs must pass component structure validation
- Tests run on pre-push (Husky v9 shows deprecation warning - non-breaking)
- E2E tests are local-only, not in CI pipeline
- Docker-first development is mandatory for consistency
- PRP-011 has 4 known test failures that don't affect production - see test issues doc
- Blog system (Feature 018) is fully functional with 69/77 tasks complete
- Blog feature uses IndexedDB - test in multiple browsers

## Feature 022: NEW Markdown-First Blog System (Building from Scratch)

**IMPORTANT**: This is a completely NEW blog system being built from scratch. The previous blog system (Feature 018) was removed entirely. This feature creates a fresh implementation with enhanced capabilities.

### Technologies Added (NEW for this blog system)

- **Dexie.js**: Enhanced IndexedDB wrapper for offline storage
- **LZ-String**: Compression library for text content
- **markdown-to-jsx**: React-compatible markdown rendering
- **gray-matter**: Frontmatter parsing for metadata
- **Prism.js**: Syntax highlighting for code blocks
- **Chokidar**: File watching for hot reload

### New Blog Commands

```bash
# Generate blog data from markdown files
docker compose exec scripthammer pnpm run generate:blog

# Test offline functionality
docker compose exec scripthammer pnpm test:offline

# Check storage quota
curl http://localhost:3000/api/blog/storage

# Trigger manual sync
curl -X POST http://localhost:3000/api/blog/sync?action=process
```

### Blog System Architecture

```
public/blog/           # Source markdown files (EDIT HERE ONLY)
src/
├── app/api/blog/      # REST API endpoints
├── app/blog/          # Blog UI pages
├── components/blog/   # Blog components (5-file pattern)
├── lib/blog/          # Core blog libraries
├── services/blog/     # Blog business logic
└── data/authors.json  # Author registry

/out/blog/             # Build output (DO NOT EDIT)
```

### Key Features Implemented

- Hybrid build/runtime markdown processing
- Three-way merge conflict resolution UI
- Automatic TOC generation with showToc flag
- Social sharing with Open Graph metadata
- Author profiles with social links
- Hot reload in <500ms for development
- Offline editing with IndexedDB
- Background sync when online
- Storage quota management (5MB text, 200MB images)
- Content compression with LZ-String

### Recent Changes (Feature 022)

- Unified markdown content pipeline from specs 019 and 021
- Enhanced offline sync with conflict detection
- Improved social sharing integration
- Author profile system with registry
- Performance optimizations for hot reload
